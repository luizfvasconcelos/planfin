import type { ContaFixaVigencia, ContaFixaCelula } from "@/lib/types"
import { addMonths } from "@/lib/utils"

// Converte "YYYY-MM" para "YYYY-MM-01" (formato armazenado no DB).
export function mesToISO(mes: string): string {
  return `${mes}-01`
}

// Converte "YYYY-MM-01" para "YYYY-MM".
export function isoToMes(iso: string): string {
  return iso.slice(0, 7)
}

// Lista dos meses ("YYYY-MM") entre start e end, inclusivos.
export function monthsBetween(start: string, end: string): string[] {
  if (end < start) return []
  const result: string[] = []
  let cur = start
  while (cur <= end) {
    result.push(cur)
    cur = addMonths(cur, 1)
  }
  return result
}

export type CelulaSource = "override" | "vigencia" | "empty"

export interface ResolvedCell {
  value: number | null  // null = sem valor (vazia, herda nada)
  source: CelulaSource
  pago: boolean
  celulaId: string | null
}

// Acha a vigência ativa para uma conta naquele mês ("YYYY-MM").
function findVigencia(
  contaId: string,
  mes: string,
  vigencias: ContaFixaVigencia[]
): ContaFixaVigencia | null {
  for (const v of vigencias) {
    if (v.conta_id !== contaId) continue
    const inicio = isoToMes(v.mes_inicio)
    const fim = v.mes_fim ? isoToMes(v.mes_fim) : null
    if (mes < inicio) continue
    if (fim !== null && mes > fim) continue
    return v
  }
  return null
}

// Resolve o valor exibido em uma célula: override > vigência > vazio.
export function resolveCell(
  contaId: string,
  mes: string,
  vigencias: ContaFixaVigencia[],
  celulas: ContaFixaCelula[]
): ResolvedCell {
  const cel = celulas.find(
    (c) => c.conta_id === contaId && isoToMes(c.mes) === mes
  )
  if (cel && cel.valor_override !== null) {
    return {
      value: Number(cel.valor_override),
      source: "override",
      pago: cel.pago,
      celulaId: cel.id,
    }
  }
  const vig = findVigencia(contaId, mes, vigencias)
  if (vig) {
    return {
      value: Number(vig.valor),
      source: "vigencia",
      pago: cel?.pago ?? false,
      celulaId: cel?.id ?? null,
    }
  }
  return {
    value: null,
    source: "empty",
    pago: cel?.pago ?? false,
    celulaId: cel?.id ?? null,
  }
}
