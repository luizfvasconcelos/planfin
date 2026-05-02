"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatDateBR, addDays } from "@/lib/utils"
import type { Settings } from "@/lib/types"

interface Props {
  settings: Settings
  onRemoveStart: (newStartDate: string) => Promise<void>
  onExtendEnd: (newEndDate: string) => Promise<void>
}

export function RangeManager({ settings, onRemoveStart, onExtendEnd }: Props) {
  const [removeOpen, setRemoveOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [removeDate, setRemoveDate] = useState("")
  const [addDaysCount, setAddDaysCount] = useState("30")
  const [saving, setSaving] = useState(false)

  async function handleRemove() {
    if (!removeDate) return
    setSaving(true)
    await onRemoveStart(removeDate)
    setSaving(false)
    setRemoveOpen(false)
  }

  async function handleAdd() {
    const n = parseInt(addDaysCount)
    if (isNaN(n) || n < 1) return
    setSaving(true)
    const newEnd = addDays(settings.end_date, n)
    await onExtendEnd(newEnd)
    setSaving(false)
    setAddOpen(false)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-3 flex gap-2 border-t border-gray-100 bg-gray-50">
      <Button
        variant="outline"
        size="sm"
        className="flex-1 text-xs"
        onClick={() => { setRemoveDate(addDays(settings.start_date, 1)); setRemoveOpen(true) }}
      >
        Remover dias do início
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="flex-1 text-xs"
        onClick={() => { setAddDaysCount("30"); setAddOpen(true) }}
      >
        Adicionar dias no final
      </Button>

      {/* Remove dialog */}
      <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover dias do início</DialogTitle>
            <DialogDescription>
              Dias antes da nova data inicial serão deletados permanentemente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-gray-500">
              Início atual: <strong>{formatDateBR(settings.start_date)}</strong>
            </p>
            <div className="space-y-1.5">
              <Label>Nova data inicial</Label>
              <Input
                type="date"
                min={addDays(settings.start_date, 1)}
                max={settings.end_date}
                value={removeDate}
                onChange={(e) => setRemoveDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRemoveOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleRemove} disabled={saving || !removeDate}>
              {saving ? "Removendo…" : "Confirmar remoção"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add days dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar dias ao final</DialogTitle>
            <DialogDescription>
              Fim atual: <strong>{formatDateBR(settings.end_date)}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Quantos dias adicionar</Label>
            <Input
              type="number"
              min="1"
              max="365"
              value={addDaysCount}
              onChange={(e) => setAddDaysCount(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleAdd} disabled={saving}>
              {saving ? "Salvando…" : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
