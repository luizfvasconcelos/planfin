import type { GastoVariavel, Orcamento } from "./types"
import { addDays, formatDateShort, isoToday } from "./utils"

export type OrcamentoStatus = "ativo" | "futuro" | "passado"

export interface OrcamentoStats {
  status: OrcamentoStatus
  // Valores agregados
  gasto: number
  restante: number          // teto - gasto (pode ser negativo se estourou)
  pctConsumido: number      // 0..1 (pode passar de 1)
  // Tempo
  diasTotal: number
  diasDecorridos: number    // limitado entre 0 e diasTotal
  diasRestantes: number     // limitado entre 0 e diasTotal
  // Ritmo
  mediaDiariaAtual: number     // gasto / diasDecorridos (0 se diasDecorridos = 0)
  mediaDiariaRecomendada: number  // restante / diasRestantes (0 se sem dias restantes; negativo se estourou)
  // Projeção (só relevante quando ativo; senão = gasto)
  projecaoTotal: number
  deltaProjecao: number     // projecaoTotal - teto (positivo = estourar; negativo = sobrar)
}

export function diasNoPeriodo(o: Pick<Orcamento, "data_inicio" | "data_fim">): number {
  const [y1, m1, d1] = o.data_inicio.split("-").map(Number)
  const [y2, m2, d2] = o.data_fim.split("-").map(Number)
  const a = new Date(y1, m1 - 1, d1).getTime()
  const b = new Date(y2, m2 - 1, d2).getTime()
  return Math.round((b - a) / 86_400_000) + 1
}

export function statusOf(o: Orcamento, today: string = isoToday()): OrcamentoStatus {
  if (today < o.data_inicio) return "futuro"
  if (today > o.data_fim) return "passado"
  return "ativo"
}

export function isGastoInOrcamento(g: GastoVariavel, o: Orcamento): boolean {
  if (g.excluido_orcamento) return false
  return g.date >= o.data_inicio && g.date <= o.data_fim
}

export function computeStats(
  o: Orcamento,
  gastos: GastoVariavel[],
  today: string = isoToday(),
): OrcamentoStats {
  const status = statusOf(o, today)
  const gasto = gastos
    .filter((g) => isGastoInOrcamento(g, o))
    .reduce((s, g) => s + Number(g.valor), 0)
  const restante = Number(o.valor_teto) - gasto
  const pctConsumido = Number(o.valor_teto) > 0 ? gasto / Number(o.valor_teto) : 0

  const diasTotal = diasNoPeriodo(o)
  // Dias decorridos = do início até hoje (limitado à data_fim).
  let diasDecorridos: number
  if (status === "futuro") diasDecorridos = 0
  else if (status === "passado") diasDecorridos = diasTotal
  else diasDecorridos = diasNoPeriodo({ data_inicio: o.data_inicio, data_fim: today })

  const diasRestantes = Math.max(0, diasTotal - diasDecorridos)

  const mediaDiariaAtual = diasDecorridos > 0 ? gasto / diasDecorridos : 0
  const mediaDiariaRecomendada = diasRestantes > 0 ? restante / diasRestantes : 0

  // Projeção: extrapola a média atual pro período inteiro (faz sentido só quando ativo).
  // Quando futuro: gasto será 0; quando passado: já é o valor final.
  const projecaoTotal = status === "ativo" && diasDecorridos > 0
    ? mediaDiariaAtual * diasTotal
    : gasto
  const deltaProjecao = projecaoTotal - Number(o.valor_teto)

  return {
    status,
    gasto,
    restante,
    pctConsumido,
    diasTotal,
    diasDecorridos,
    diasRestantes,
    mediaDiariaAtual,
    mediaDiariaRecomendada,
    projecaoTotal,
    deltaProjecao,
  }
}

// "10–25/mai" se mesmo mês, "28/mai – 5/jun" se cruzar mês.
export function formatPeriodo(o: Pick<Orcamento, "data_inicio" | "data_fim">): string {
  const [, mIni] = o.data_inicio.split("-")
  const [, mFim] = o.data_fim.split("-")
  const ini = formatDateShort(o.data_inicio)  // "10/mai"
  const fim = formatDateShort(o.data_fim)
  if (mIni === mFim) {
    const [diaIni] = ini.split("/")
    return `${diaIni}–${fim}`
  }
  return `${ini} – ${fim}`
}

// Cor da barra de progresso conforme pct consumido.
export function barColor(pct: number): string {
  if (pct >= 0.95) return "#ef4444"  // vermelho
  if (pct >= 0.7) return "#f59e0b"   // amarelo
  return "#10b981"                    // verde
}

// Sugestão de próximo orçamento: começa no dia seguinte ao último data_fim,
// com a mesma duração e mesmo teto. Se não há histórico, começa hoje, 15 dias.
export function suggestNext(orcamentos: Orcamento[]): { data_inicio: string; data_fim: string; valor_teto: number } {
  if (orcamentos.length === 0) {
    const today = isoToday()
    return { data_inicio: today, data_fim: addDays(today, 14), valor_teto: 0 }
  }
  const last = orcamentos
    .slice()
    .sort((a, b) => a.data_fim.localeCompare(b.data_fim))
    .at(-1)!
  const dur = diasNoPeriodo(last)
  const inicio = addDays(last.data_fim, 1)
  const fim = addDays(inicio, dur - 1)
  return { data_inicio: inicio, data_fim: fim, valor_teto: Number(last.valor_teto) }
}
