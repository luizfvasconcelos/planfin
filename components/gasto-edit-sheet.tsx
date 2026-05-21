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
import { parseDecimal, isoToday } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { RESPONSAVEL_LABELS } from "@/lib/users"
import type {
  CategoriaGasto,
  FormaPagamento,
  GastoVariavel,
  ResponsavelGasto,
} from "@/lib/types"

export interface GastoSaveInput {
  id: string | null  // null = criar, string = editar
  date: string
  valor: number
  categoria_id: string
  forma_pagamento_id: string
  responsavel: ResponsavelGasto
  descricao: string | null
  excluido_orcamento: boolean
}

interface Props {
  // gasto null = modo criação. O componente é remontado pelo parent (via key)
  // a cada abertura, então o estado inicial vem direto das props.
  gasto: GastoVariavel | null
  categorias: CategoriaGasto[]
  formasPagamento: FormaPagamento[]
  defaultResponsavel: ResponsavelGasto
  onClose: () => void
  onSave: (data: GastoSaveInput) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

const RESPONSAVEL_OPTIONS: ResponsavelGasto[] = ["luiz", "duda", "casal"]

export function GastoEditSheet({
  gasto, categorias, formasPagamento, defaultResponsavel,
  onClose, onSave, onDelete,
}: Props) {
  const [date, setDate] = useState<string>(gasto?.date ?? isoToday())
  const [valor, setValor] = useState<string>(
    gasto ? String(gasto.valor).replace(".", ",") : ""
  )
  const [categoriaId, setCategoriaId] = useState<string>(gasto?.categoria_id ?? "")
  const [formaPagamentoId, setFormaPagamentoId] = useState<string>(gasto?.forma_pagamento_id ?? "")
  const [responsavel, setResponsavel] = useState<ResponsavelGasto>(gasto?.responsavel ?? defaultResponsavel)
  const [descricao, setDescricao] = useState<string>(gasto?.descricao ?? "")
  const [excluidoOrcamento, setExcluidoOrcamento] = useState<boolean>(gasto?.excluido_orcamento ?? false)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const valorNum = parseDecimal(valor)
  const canSave = valorNum > 0 && !!categoriaId && !!formaPagamentoId && !saving

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    await onSave({
      id: gasto?.id ?? null,
      date,
      valor: valorNum,
      categoria_id: categoriaId,
      forma_pagamento_id: formaPagamentoId,
      responsavel,
      descricao: descricao.trim() || null,
      excluido_orcamento: excluidoOrcamento,
    })
    setSaving(false)
    onClose()
  }

  async function handleDelete() {
    if (!gasto) return
    if (!confirmDelete) { setConfirmDelete(true); return }
    setSaving(true)
    await onDelete(gasto.id)
    setSaving(false)
    onClose()
  }

  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>{gasto ? "Editar gasto" : "Novo gasto"}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 px-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="valor">Valor (R$)</Label>
              <Input
                id="valor"
                inputMode="decimal"
                placeholder="0,00"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="categoria">Categoria</Label>
            <select
              id="categoria"
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 bg-white"
            >
              <option value="">Selecione…</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="forma-pgto">Forma de pagamento</Label>
            <select
              id="forma-pgto"
              value={formaPagamentoId}
              onChange={(e) => setFormaPagamentoId(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 bg-white"
            >
              <option value="">Selecione…</option>
              {formasPagamento.map((f) => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Responsável</Label>
            <div className="flex gap-2">
              {RESPONSAVEL_OPTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setResponsavel(r)}
                  className={cn(
                    "flex-1 text-sm py-2 rounded-md border transition-colors",
                    responsavel === r
                      ? "bg-blue-50 border-blue-300 text-blue-700 font-medium"
                      : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                  )}
                >
                  {RESPONSAVEL_LABELS[r]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="descricao">Descrição (opcional)</Label>
            <Input
              id="descricao"
              placeholder="almoço no japa, uber pro trampo…"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={excluidoOrcamento}
              onChange={(e) => setExcluidoOrcamento(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 accent-blue-600"
            />
            <span className="text-sm text-gray-700">Desconsiderar do orçamento</span>
          </label>
        </div>

        <SheetFooter className="mt-6 flex gap-2">
          {gasto && (
            <button
              onClick={handleDelete}
              disabled={saving}
              className={cn(
                "shrink-0 p-2 rounded transition-colors",
                confirmDelete
                  ? "text-red-500 bg-red-50"
                  : "text-gray-300 hover:text-red-500"
              )}
              title={confirmDelete ? "Toque de novo para confirmar" : "Excluir gasto"}
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
