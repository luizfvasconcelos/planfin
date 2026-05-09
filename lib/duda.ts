import { addDays, dateRange, monthRange, isoToday } from "@/lib/utils"
import type { DudaAgendaSlot, DudaClinica, DudaEntry } from "@/lib/types"

export interface ClinicaStats {
  clinica: DudaClinica
  total: number          // realizado no mês
  count: number          // dias lançados
  avg: number            // média/dia (geral, p/ display)
  avgDiaria: number      // média dos dias de diária
  avgProducao: number    // média dos dias de produção
  agendaDays: number     // dias previstos no mês pela agenda
  remainingDays: number  // dias da agenda ainda não lançados
  projetado: number      // projeção total para o fim do mês
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
  const count = clinicaEntries.length
  const avg = count > 0 ? total / count : 0

  const slots = agenda.filter((a) => a.clinica_id === clinica.id)
  const hasAgenda = slots.length > 0

  // Map weekday → slot tipo for this clinic
  const slotByWeekday = new Map<number, DudaAgendaSlot>()
  slots.forEach((s) => slotByWeekday.set(s.weekday, s))

  // Split entries by tipo (diaria/producao) based on the slot's weekday tipo.
  // Entries on a weekday without a slot for this clinic are treated as "outro".
  let diariaTotal = 0, diariaCount = 0
  let producaoTotal = 0, producaoCount = 0
  for (const e of clinicaEntries) {
    const slot = slotByWeekday.get(getJsWeekday(e.date))
    const valor = Number(e.valor)
    if (slot?.tipo === 'diaria') {
      diariaTotal += valor
      diariaCount++
    } else if (slot?.tipo === 'producao') {
      producaoTotal += valor
      producaoCount++
    }
  }
  // Diária avg only when we have diária entries — no overall fallback,
  // because the contractual floor (minimo) is the right baseline when no data.
  const avgDiaria = diariaCount > 0 ? diariaTotal / diariaCount : 0
  // Produção avg only when we have produção entries — no fallback;
  // sample a different tipo would mislead the projection.
  const avgProducao = producaoCount > 0 ? producaoTotal / producaoCount : 0

  if (!hasAgenda) {
    return {
      clinica, total, count, avg, avgDiaria, avgProducao,
      agendaDays: 0, remainingDays: 0,
      projetado: total,
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

  let projetado = total
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
    clinica, total, count, avg, avgDiaria, avgProducao,
    agendaDays, remainingDays, projetado, hasAgenda: true, projetavel,
  }
}
