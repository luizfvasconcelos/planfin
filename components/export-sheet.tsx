"use client"

import { useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Copy, Check } from "lucide-react"
import { toast } from "sonner"
import { cn, formatMonthShort, getDayOfWeek } from "@/lib/utils"
import type { DudaClinica, DudaEntry } from "@/lib/types"

interface Props {
  open: boolean
  onClose: () => void
  month: string
  clinicas: DudaClinica[]
  entries: DudaEntry[]
}

function formatValor(v: number): string {
  const num = Number(v)
  if (Number.isInteger(num)) {
    return `${num.toLocaleString("pt-BR")}$`
  }
  return `${num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}$`
}

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "")
}

function buildMessage(
  entries: DudaEntry[],
  clinicas: DudaClinica[],
  month: string,
  filterClinicaId?: string,
): string {
  const filtered = filterClinicaId
    ? entries.filter((e) => e.clinica_id === filterClinicaId)
    : entries
  const sorted = [...filtered].sort((a, b) => a.date.localeCompare(b.date))
  const monthLabel = formatMonthShort(month)

  const lines = sorted.map((e) => {
    const day = e.date.split("-")[2]
    const wkd = stripAccents(getDayOfWeek(e.date))
    const valor = formatValor(Number(e.valor))
    if (filterClinicaId) {
      // per-clinic export → omit sigla (the recipient already knows the clinic)
      return `${day} ${wkd}: ${valor}`
    }
    const c = clinicas.find((cc) => cc.id === e.clinica_id)
    const sigla = c?.sigla || c?.nome || "??"
    return `${day} ${wkd} - ${sigla}: ${valor}`
  })

  const total = filtered.reduce((s, e) => s + Number(e.valor), 0)

  return [
    `Renda Duda ${monthLabel}`,
    "",
    ...lines,
    "",
    `Total: ${formatValor(total)}`,
  ].join("\n")
}

export function ExportSheet({ open, onClose, month, clinicas, entries }: Props) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const perClinica = clinicas
    .map((c) => {
      const ces = entries.filter((e) => e.clinica_id === c.id)
      return {
        clinica: c,
        count: ces.length,
        total: ces.reduce((s, e) => s + Number(e.valor), 0),
      }
    })
    .filter((s) => s.count > 0)

  async function handleCopy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      toast.success("Copiado!")
      setTimeout(() => setCopiedKey(null), 2000)
    } catch {
      toast.error("Não consegui copiar — tenta de novo")
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto px-5">
        <SheetHeader className="mb-4">
          <SheetTitle className="capitalize">Exportar · {formatMonthShort(month)}</SheetTitle>
        </SheetHeader>

        <div className="pb-8 space-y-3">
          {entries.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Nenhuma entrada nesse mês.</p>
          ) : (
            <>
              <CopyButton
                label="Copiar tudo"
                detail={`${entries.length} ${entries.length === 1 ? "entrada" : "entradas"}`}
                copied={copiedKey === "all"}
                onCopy={() => handleCopy(buildMessage(entries, clinicas, month), "all")}
              />

              {perClinica.length > 1 && (
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2 px-1">
                    Por clínica
                  </p>
                  <div className="space-y-2">
                    {perClinica.map((s) => (
                      <CopyButton
                        key={s.clinica.id}
                        label={`Copiar ${s.clinica.sigla || s.clinica.nome}`}
                        detail={`${s.count} ${s.count === 1 ? "dia" : "dias"} · ${formatValor(s.total)}`}
                        color={s.clinica.cor}
                        copied={copiedKey === s.clinica.id}
                        onCopy={() => handleCopy(
                          buildMessage(entries, clinicas, month, s.clinica.id),
                          s.clinica.id,
                        )}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function CopyButton({
  label,
  detail,
  color,
  copied,
  onCopy,
}: {
  label: string
  detail: string
  color?: string
  copied: boolean
  onCopy: () => void
}) {
  return (
    <button
      onClick={onCopy}
      className="w-full flex items-center gap-3 bg-white border border-gray-100 hover:border-gray-300 rounded-xl px-4 py-3 transition-colors text-left"
    >
      <div
        className={cn(
          "shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors",
          copied && "bg-green-50"
        )}
        style={!copied && color ? { backgroundColor: `${color}1a` } : undefined}
      >
        {copied ? (
          <Check size={16} className="text-green-600" />
        ) : (
          <Copy size={16} style={color ? { color } : { color: "#6b7280" }} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{label}</p>
        <p className="text-xs text-gray-500 truncate">{detail}</p>
      </div>
    </button>
  )
}
