"use client"

import { useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Trash2 } from "lucide-react"
import { cn, parseDecimal } from "@/lib/utils"
import type { Orcamento } from "@/lib/types"

export interface OrcamentoSaveInput {
  id: string | null
  data_inicio: string
  data_fim: string
  valor_teto: number
}

interface Props {
  // Remontado pelo parent (via key) a cada abertura; estado inicial vem das props.
  orcamento: Orcamento | null
  defaultInicio: string
  defaultFim: string
  defaultTeto: number
  onClose: () => void
  onSave: (data: OrcamentoSaveInput) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function OrcamentoEditSheet({
  orcamento, defaultInicio, defaultFim, defaultTeto,
  onClose, onSave, onDelete,
}: Props) {
  const [dataInicio, setDataInicio] = useState<string>(orcamento?.data_inicio ?? defaultInicio)
  const [dataFim, setDataFim] = useState<string>(orcamento?.data_fim ?? defaultFim)
  const [valorTeto, setValorTeto] = useState<string>(
    orcamento ? String(orcamento.valor_teto).replace(".", ",") : (defaultTeto > 0 ? String(defaultTeto).replace(".", ",") : "")
  )
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const teto = parseDecimal(valorTeto)
  const datasValidas = dataInicio && dataFim && dataInicio <= dataFim
  const canSave = teto > 0 && !!datasValidas && !saving

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    await onSave({
      id: orcamento?.id ?? null,
      data_inicio: dataInicio,
      data_fim: dataFim,
      valor_teto: teto,
    })
    setSaving(false)
    onClose()
  }

  async function handleDelete() {
    if (!orcamento) return
    if (!confirmDelete) { setConfirmDelete(true); return }
    setSaving(true)
    await onDelete(orcamento.id)
    setSaving(false)
    onClose()
  }

  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>{orcamento ? "Editar orçamento" : "Novo orçamento"}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 px-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="inicio">Início</Label>
              <Input
                id="inicio"
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fim">Fim</Label>
              <Input
                id="fim"
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
              />
            </div>
          </div>
          {!datasValidas && (dataInicio && dataFim) && (
            <p className="text-xs text-red-600">A data fim precisa ser igual ou depois da início.</p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="teto">Valor teto (R$)</Label>
            <Input
              id="teto"
              inputMode="decimal"
              placeholder="0,00"
              value={valorTeto}
              onChange={(e) => setValorTeto(e.target.value)}
            />
          </div>
        </div>

        <SheetFooter className="mt-6 flex gap-2">
          {orcamento && (
            <button
              onClick={handleDelete}
              disabled={saving}
              className={cn(
                "shrink-0 p-2 rounded transition-colors",
                confirmDelete ? "text-red-500 bg-red-50" : "text-gray-300 hover:text-red-500"
              )}
              title={confirmDelete ? "Toque de novo para confirmar" : "Excluir orçamento"}
            >
              {confirmDelete
                ? <span className="text-xs font-medium px-1">Confirmar?</span>
                : <Trash2 size={16} />}
            </button>
          )}
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={handleSave} disabled={!canSave}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
