"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ArchiveRestore, Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { ContaFixa } from "@/lib/types"
import type { SupabaseClient } from "@supabase/supabase-js"

interface Props {
  open: boolean
  onClose: () => void
  onChange: () => void
}

export function ContasArquivadasSheet({ open, onClose, onChange }: Props) {
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto px-5">
        <SheetHeader className="mb-4">
          <SheetTitle>Contas arquivadas</SheetTitle>
        </SheetHeader>
        {open ? <ArquivadasContent onChange={onChange} /> : null}
      </SheetContent>
    </Sheet>
  )
}

function ArquivadasContent({ onChange }: { onChange: () => void }) {
  const sbRef = useRef<SupabaseClient | null>(null)
  const sb = useCallback(() => {
    if (!sbRef.current) sbRef.current = createClient()
    return sbRef.current
  }, [])

  const [arquivadas, setArquivadas] = useState<ContaFixa[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await sb()
        .from("contas_fixas")
        .select("*")
        .not("archived_at", "is", null)
        .order("archived_at", { ascending: false })
      if (cancelled) return
      setArquivadas((data as ContaFixa[] | null) ?? [])
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [sb])

  async function handleRestore(id: string) {
    const { error } = await sb()
      .from("contas_fixas")
      .update({ archived_at: null })
      .eq("id", id)
    if (error) toast.error("Erro ao restaurar")
    else {
      setArquivadas((prev) => prev.filter((c) => c.id !== id))
      onChange()
    }
  }

  async function handleDelete(id: string) {
    const { error } = await sb().from("contas_fixas").delete().eq("id", id)
    if (error) toast.error("Erro ao excluir")
    else {
      setArquivadas((prev) => prev.filter((c) => c.id !== id))
      onChange()
    }
  }

  return (
    <div className="pb-6">
      {loading ? (
        <p className="text-sm text-gray-400 text-center py-6">Carregando…</p>
      ) : arquivadas.length === 0 ? (
        <p className="text-sm text-gray-300 text-center py-6">
          Nenhuma conta arquivada.
        </p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 px-3">
          {arquivadas.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-2 py-2 border-b border-gray-100 last:border-0"
            >
              <p className="flex-1 min-w-0 text-sm text-gray-700 truncate">{c.nome}</p>
              <button
                onClick={() => handleRestore(c.id)}
                className="shrink-0 p-1 text-gray-400 hover:text-blue-600 rounded transition-colors"
                title="Restaurar"
              >
                <ArchiveRestore size={16} />
              </button>
              <button
                onClick={() => {
                  if (confirmDelete !== c.id) { setConfirmDelete(c.id); return }
                  setConfirmDelete(null)
                  handleDelete(c.id)
                }}
                className={cn(
                  "shrink-0 p-1 rounded transition-colors",
                  confirmDelete === c.id ? "text-red-500 bg-red-50" : "text-gray-300 hover:text-gray-500"
                )}
                title={
                  confirmDelete === c.id
                    ? "Toque de novo para excluir definitivamente"
                    : "Excluir definitivamente"
                }
              >
                {confirmDelete === c.id
                  ? <span className="text-xs font-medium px-1">Confirmar?</span>
                  : <Trash2 size={14} />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
