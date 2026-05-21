import type { ResponsavelGasto } from "./types"

// Email → responsavel. App tem exatamente 2 usuários autenticados; default
// 'casal' só é usado se algum email novo aparecer (defensivo).
const EMAIL_TO_RESPONSAVEL: Record<string, ResponsavelGasto> = {
  "lfvasconcelos1.lfv@gmail.com": "luiz",
  "duda.figueirinho@gmail.com": "duda",
}

export function emailToResponsavel(email: string | null | undefined): ResponsavelGasto {
  if (!email) return "casal"
  return EMAIL_TO_RESPONSAVEL[email.toLowerCase()] ?? "casal"
}

export const RESPONSAVEL_LABELS: Record<ResponsavelGasto, string> = {
  luiz: "Luiz",
  duda: "Duda",
  casal: "Casal",
}
