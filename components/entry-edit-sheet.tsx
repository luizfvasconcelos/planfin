"use client"

import { useState, useEffect } from "react"
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
import { Eraser } from "lucide-react"
import { formatDateBR, getDayOfWeek, parseDecimal } from "@/lib/utils"
import type { DayRow } from "@/lib/types"

interface Props {
  row: DayRow | null
  onClose: () => void
  onSave: (date: string, entrada: number, saida: number, descricao: string) => Promise<void>
}

export function EntryEditSheet({ row, onClose, onSave }: Props) {
  const [entrada, setEntrada] = useState("")
  const [saida, setSaida] = useState("")
  const [descricao, setDescricao] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (row) {
      setEntrada(row.entrada > 0 ? String(row.entrada).replace(".", ",") : "")
      setSaida(row.saida > 0 ? String(row.saida).replace(".", ",") : "")
      setDescricao(row.descricao)
    }
  }, [row])

  async function handleSave() {
    if (!row) return
    setSaving(true)
    await onSave(
      row.date,
      parseDecimal(entrada),
      parseDecimal(saida),
      descricao.trim()
    )
    setSaving(false)
    onClose()
  }

  if (!row) return null

  return (
    <Sheet open={!!row} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh]">
        <SheetHeader className="mb-4">
          <SheetTitle>
            {getDayOfWeek(row.date)}, {formatDateBR(row.date)}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="entrada">Entrada (R$)</Label>
            <Input
              id="entrada"
              inputMode="decimal"
              placeholder="0,00"
              value={entrada}
              onChange={(e) => setEntrada(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="saida">Saída (R$)</Label>
            <Input
              id="saida"
              inputMode="decimal"
              placeholder="0,00"
              value={saida}
              onChange={(e) => setSaida(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="descricao">Descrição</Label>
            <Input
              id="descricao"
              placeholder="salário, aluguel, supermercado…"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>
        </div>

        <SheetFooter className="mt-6 flex gap-2">
          <button
            onClick={() => { setEntrada(""); setSaida(""); setDescricao("") }}
            className="p-2 text-gray-300 hover:text-gray-500 transition-colors rounded shrink-0"
            title="Limpar tudo"
            disabled={saving}
          >
            <Eraser size={16} />
          </button>
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={handleSave} disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
