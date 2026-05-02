"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Trash2, Plus, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { formatBRL, parseDecimal } from "@/lib/utils"
import { cn } from "@/lib/utils"
import type { RadarItem } from "@/lib/types"
import type { SupabaseClient } from "@supabase/supabase-js"

const emptyForm = { item: "", previsao: "", valor: "" }

interface SectionProps {
  tipo: "entrada" | "saida"
  items: RadarItem[]
  onAdd: (tipo: "entrada" | "saida", item: string, previsao: string, valor: number) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

function RadarSection({ tipo, items, onAdd, onDelete }: SectionProps) {
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  async function handleSave() {
    if (!form.item.trim()) return
    setSaving(true)
    await onAdd(tipo, form.item.trim(), form.previsao.trim(), parseDecimal(form.valor))
    setForm(emptyForm)
    setAdding(false)
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (confirmId !== id) { setConfirmId(id); return }
    setConfirmId(null)
    await onDelete(id)
  }

  const isEntrada = tipo === "entrada"
  const label = isEntrada ? "Radar de Entradas" : "Radar de Saídas"
  const accent = isEntrada ? "text-green-700" : "text-red-600"
  const accentBg = isEntrada ? "bg-green-50" : "bg-red-50"
  const accentBorder = isEntrada ? "border-green-100" : "border-red-100"

  return (
    <div>
      <p className={cn("text-xs font-semibold uppercase tracking-widest mb-2", accent)}>{label}</p>

      {items.length === 0 && !adding && (
        <p className="text-sm text-gray-300 mb-2">Nenhum item ainda.</p>
      )}

      <div className="space-y-1 mb-2">
        {items.map((r) => (
          <div key={r.id} className={cn("flex items-center gap-2 py-1.5 border-b last:border-0", accentBorder)}>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-800 truncate">{r.item}</p>
              {r.previsao && (
                <p className="text-xs text-gray-400">{r.previsao}</p>
              )}
            </div>
            <p className={cn("text-sm font-medium tabular-nums shrink-0", accent)}>
              {formatBRL(r.valor)}
            </p>
            <button
              onClick={() => handleDelete(r.id)}
              className={cn(
                "shrink-0 p-1 rounded transition-colors",
                confirmId === r.id
                  ? "text-red-500 bg-red-50"
                  : "text-gray-300 hover:text-gray-500"
              )}
              title={confirmId === r.id ? "Toque de novo para confirmar" : "Remover"}
            >
              {confirmId === r.id ? (
                <span className="text-xs font-medium px-1">Confirmar?</span>
              ) : (
                <Trash2 size={14} />
              )}
            </button>
          </div>
        ))}
      </div>

      {adding ? (
        <div className={cn("space-y-2 rounded-lg p-3", accentBg)}>
          <div className="space-y-1">
            <Label className="text-xs">Item</Label>
            <Input
              placeholder="ex: Nutricionista"
              value={form.item}
              onChange={(e) => setForm((f) => ({ ...f, item: e.target.value }))}
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Previsão</Label>
            <Input
              placeholder="ex: junho, fim do ano…"
              value={form.previsao}
              onChange={(e) => setForm((f) => ({ ...f, previsao: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Valor (R$)</Label>
            <Input
              inputMode="decimal"
              placeholder="0,00"
              value={form.valor}
              onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => { setAdding(false); setForm(emptyForm) }}
              disabled={saving}
            >
              <X size={14} className="mr-1" /> Cancelar
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={handleSave}
              disabled={saving || !form.item.trim()}
            >
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors py-1"
        >
          <Plus size={14} /> Adicionar
        </button>
      )}
    </div>
  )
}

interface Props {
  open: boolean
  onClose: () => void
}

export function RadarSheet({ open, onClose }: Props) {
  const sbRef = useRef<SupabaseClient | null>(null)
  const sb = useCallback(() => {
    if (!sbRef.current) sbRef.current = createClient()
    return sbRef.current
  }, [])

  const [items, setItems] = useState<RadarItem[]>([])

  const fetchItems = useCallback(async () => {
    const { data } = await sb().from("radar_items").select("*").order("created_at")
    if (data) setItems(data as RadarItem[])
  }, [sb])

  useEffect(() => {
    if (!open) return
    fetchItems()
  }, [open, fetchItems])

  useEffect(() => {
    if (!open) return
    const channel = sb()
      .channel("radar-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "radar_items" }, fetchItems)
      .subscribe()
    return () => { sb().removeChannel(channel) }
  }, [open, sb, fetchItems])

  async function handleAdd(tipo: "entrada" | "saida", item: string, previsao: string, valor: number) {
    const { data, error } = await sb()
      .from("radar_items")
      .insert({ tipo, item, previsao, valor })
      .select()
      .single()
    if (!error && data) setItems((prev) => [...prev, data as RadarItem])
  }

  async function handleDelete(id: string) {
    const { error } = await sb().from("radar_items").delete().eq("id", id)
    if (!error) setItems((prev) => prev.filter((r) => r.id !== id))
  }

  const entradas = items.filter((r) => r.tipo === "entrada")
  const saidas = items.filter((r) => r.tipo === "saida")

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>Radar</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 pb-6">
          <RadarSection tipo="entrada" items={entradas} onAdd={handleAdd} onDelete={handleDelete} />
          <div className="border-t border-gray-100" />
          <RadarSection tipo="saida" items={saidas} onAdd={handleAdd} onDelete={handleDelete} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
