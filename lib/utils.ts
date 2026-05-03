import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})

export function formatBRL(value: number): string {
  return BRL.format(value)
}

// Parse user input that may use comma or dot as decimal separator
export function parseDecimal(raw: string): number {
  const normalized = raw.trim().replace(/\./g, "").replace(",", ".")
  const n = parseFloat(normalized)
  return isNaN(n) ? 0 : n
}

const SHORT_DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

export function getDayOfWeek(date: string): string {
  const [y, m, d] = date.split("-").map(Number)
  const dt = new Date(y, m - 1, d)
  return SHORT_DAYS[dt.getDay()]
}

export function formatDateBR(date: string): string {
  const [y, m, d] = date.split("-")
  return `${d}/${m}/${y}`
}

const SHORT_MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]

export function formatDateShort(date: string): string {
  const [, m, d] = date.split("-").map(Number)
  return `${String(d).padStart(2, "0")}/${SHORT_MONTHS[m - 1]}`
}

export function isoToday(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number)
  const dt = new Date(y, m - 1, d + days)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`
}

export function dateRange(start: string, end: string): string[] {
  const dates: string[] = []
  let current = start
  while (current <= end) {
    dates.push(current)
    current = addDays(current, 1)
  }
  return dates
}
