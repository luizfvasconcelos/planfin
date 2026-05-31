import { addDays, dateRange, monthRange, isoToday } from "@/lib/utils"
import type { DudaAgendaSlot, DudaClinica, DudaEntry } from "@/lib/types"

export interface ClinicaStats {
  clinica: DudaClinica
  total: number          // realizado no mês (bruto, inclui M+2)
  count: number          // dias lançados
  avg: number            // média/dia geral (inclui M+2)
  avgProj: number        // média/dia da renda planejável (exclui M+2)
  avgDiaria: number      // média dos dias de diária (exclui M+2)
  avgProducao: number    // média dos dias de produção (exclui M+2)
  agendaDays: number     // dias previstos no mês pela agenda
  remainingDays: number  // dias da agenda ainda não lançados
  projetado: number      // projeção de caixa planejável fim de mês (exclui M+2)
  hasAgenda: boolean     // se a clínica tem slots configurados na agenda
  projetavel: boolean    // se há dados suficientes pra estimar todos os dias remanescentes
}

function getJsWeekday(date: string): number {
  const [y, m, d] = date.split("-").map(Number)
  return new Date(y, m - 1, d).getDay()
}

export function computeClinicaStats(
  clinica: DudaClinica,
  entries: DudaEntry[],
  agenda: DudaAgendaSlot[],
  daysOff: Set<string>,
  month: string,
): ClinicaStats {
  const clinicaEntries = entries.filter((e) => e.clinica_id === clinica.id)
  const total = clinicaEntries.reduce((s, e) => s + Number(e.valor), 0)
  // Conta dias distintos — não entries. Quando um dia é quebrado em N
  // linhas (Amil M+1 + MetLife M+2 etc.), continua sendo 1 dia trabalhado;
  // contar entries inflaria o denominador da média.
  const count = new Set(clinicaEntries.map((e) => e.date)).size
  const avg = count > 0 ? total / count : 0

  // Projeção é "caixa planejável" — exclui entries que só caem em M+2 ou
  // depois (planos esporádicos que distorcem o planejamento mensal).
  // M+0 e M+1 continuam no cálculo: M+1 é a regra padrão da maioria das
  // clínicas (recebimento previsível mês a mês).
  const projEntries = clinicaEntries.filter((e) => e.meses_recebimento < 2)
  const totalProj = projEntries.reduce((s, e) => s + Number(e.valor), 0)
  const countProj = new Set(projEntries.map((e) => e.date)).size
  const avgProj = countProj > 0 ? totalProj / countProj : 0

  const slots = agenda.filter((a) => a.clinica_id === clinica.id)
  const hasAgenda = slots.length > 0

  // Map weekday → slot tipo for this clinic
  const slotByWeekday = new Map<number, DudaAgendaSlot>()
  slots.forEach((s) => slotByWeekday.set(s.weekday, s))

  // Médias por tipo usam só projEntries — pra projeção dos dias futuros
  // ser estimada com base em renda planejável (sem viés de M+2).
  // Conta dias distintos (Set por data) — quando um dia é quebrado em N
  // entries, soma os valores mas conta como 1 dia.
  let diariaTotal = 0, producaoTotal = 0
  const diariaDates = new Set<string>()
  const producaoDates = new Set<string>()
  for (const e of projEntries) {
    const slot = slotByWeekday.get(getJsWeekday(e.date))
    const valor = Number(e.valor)
    if (slot?.tipo === 'diaria') {
      diariaTotal += valor
      diariaDates.add(e.date)
    } else if (slot?.tipo === 'producao') {
      producaoTotal += valor
      producaoDates.add(e.date)
    }
  }
  const diariaCount = diariaDates.size
  const producaoCount = producaoDates.size
  // Diária avg only when we have diária entries — no overall fallback,
  // because the contractual floor (minimo) is the right baseline when no data.
  const avgDiaria = diariaCount > 0 ? diariaTotal / diariaCount : 0
  // Produção avg only when we have produção entries — no fallback;
  // sample a different tipo would mislead the projection.
  const avgProducao = producaoCount > 0 ? producaoTotal / producaoCount : 0

  if (!hasAgenda) {
    return {
      clinica, total, count, avg, avgProj, avgDiaria, avgProducao,
      agendaDays: 0, remainingDays: 0,
      projetado: totalProj,
      hasAgenda: false,
      projetavel: false,
    }
  }

  const { start, end } = monthRange(month)
  const allDates = dateRange(start, end)

  const agendaDateInfos: { date: string; tipo: 'diaria' | 'producao'; minimo: number | null }[] = []
  for (const date of allDates) {
    if (daysOff.has(date)) continue
    const wd = getJsWeekday(date)
    const slot = slotByWeekday.get(wd)
    if (slot) {
      agendaDateInfos.push({ date, tipo: slot.tipo, minimo: slot.minimo })
    }
  }

  const agendaDays = agendaDateInfos.length

  const entryDates = new Set(clinicaEntries.map((e) => e.date))
  // Project agenda days that come AFTER the last logged entry for this clinic
  // (or today, if there are no logs yet). Days before the last log are assumed
  // "skipped" (she didn't work — e.g. holiday) since she's already moved past
  // them by logging later days; otherwise old missed days would silently
  // inflate the projection. Unlogged days after the last log are still
  // projected, so a freshly-passed day she hasn't entered yet stays neutral.
  const lastLoggedDate = clinicaEntries.length > 0
    ? clinicaEntries.reduce((max, e) => (e.date > max ? e.date : max), "")
    : null
  const cutoff = lastLoggedDate ?? addDays(isoToday(), -1)
  const remaining = agendaDateInfos.filter(
    (a) => !entryDates.has(a.date) && a.date > cutoff,
  )
  const remainingDays = remaining.length

  let projetado = totalProj
  let projetavel = true
  for (const r of remaining) {
    if (r.tipo === 'diaria') {
      // Project diária using the larger of (historical diária avg, contractual minimum).
      // The minimum alone is enough signal even without history.
      if (r.minimo != null) {
        projetado += Math.max(avgDiaria, r.minimo)
      } else if (diariaCount > 0) {
        projetado += avgDiaria
      } else {
        // no minimo and no history — can't project this day
        projetavel = false
      }
    } else {
      // produção: needs at least 1 produção entry to estimate
      if (producaoCount > 0) {
        projetado += avgProducao
      } else {
        projetavel = false
      }
    }
  }

  return {
    clinica, total, count, avg, avgProj, avgDiaria, avgProducao,
    agendaDays, remainingDays, projetado, hasAgenda: true, projetavel,
  }
}
