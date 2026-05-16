export type SaldoModo = 'atual' | 'projetado'

export interface Settings {
  id: number
  saldo_inicial: number
  saldo_projetado: number
  saldo_modo: SaldoModo
  start_date: string
  end_date: string
  updated_at: string
}

export interface Entry {
  id: string
  date: string
  entrada: number
  saida: number
  descricao: string
  updated_by: string | null
  updated_at: string
}

export type DudaSlotTipo = 'diaria' | 'producao'

export interface DudaAgendaSlot {
  id: string
  weekday: number  // 0=domingo
  clinica_id: string
  tipo: DudaSlotTipo
  minimo: number | null
  created_at: string
  updated_at: string
}

export interface DudaEntry {
  id: string
  date: string
  clinica_id: string
  valor: number
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface DudaClinica {
  id: string
  nome: string
  sigla: string | null
  cor: string
  position: number
  ativa: boolean
  created_at: string
  updated_at: string
}

export interface RadarItem {
  id: string
  tipo: 'entrada' | 'saida'
  item: string
  previsao: string
  valor: number
  position: number
  created_at: string
}

export interface ContaFixa {
  id: string
  nome: string
  position: number
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface ContaFixaVigencia {
  id: string
  conta_id: string
  mes_inicio: string  // YYYY-MM-01
  mes_fim: string | null  // YYYY-MM-01, null = aberto
  valor: number
  created_at: string
  updated_at: string
}

export interface ContaFixaCelula {
  id: string
  conta_id: string
  mes: string  // YYYY-MM-01
  valor_override: number | null
  pago: boolean
  created_at: string
  updated_at: string
}

// A day row shown in the timeline (real entry or virtual empty day)
export interface DayRow {
  date: string        // ISO YYYY-MM-DD
  entrada: number
  saida: number
  descricao: string
  acumulado: number
  isToday: boolean
  isEmpty: boolean    // no real entry in DB for this day
  entryId: string | null
}
