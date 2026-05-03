export interface Settings {
  id: number
  saldo_inicial: number
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

export interface RadarItem {
  id: string
  tipo: 'entrada' | 'saida'
  item: string
  previsao: string
  valor: number
  position: number
  created_at: string
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
