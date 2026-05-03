"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Trash2, Plus, X, GripVertical } from "lucide-react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { createClient } from "@/lib/supabase/client"
import { formatBRL, parseDecimal } from "@/lib/utils"
import { cn } from "@/lib/utils"
import type { RadarItem } from "@/lib/types"
import type { SupabaseClient } from "@supabase/supabase-js"

const emptyForm = { item: "", previsao: "", valor: "" }

interface SortableItemProps {
  r: RadarItem
  accent: string
  accentBg: string
  accentBorder: string
  editingId: string | null
  editForm: typeof emptyForm
  setEditingId: (id: string | null) => void
  setEditForm: (form: typeof emptyForm) => void
  confirmId: string | null
  setConfirmId: (id: string | null) => void
  onEdit: (id: string, item: string, previsao: string, valor: number) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

function SortableItem({
  r, accent, accentBg, accentBorder,
  editingId, editForm, setEditingId, setEditForm,
  confirmId, setConfirmId, onEdit, onDelete,
}: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: r.id })
  const [saving, setSaving] = useState(false)
  const isEditing = editingId === r.id

  const style = { transform: CSS.Transform.toString(transform), transition }

  function startEdit() {
    setConfirmId(null)
    setEditingId(r.id)
    setEditForm({ item: r.item, previsao: r.previsao, valor: String(r.valor).replace(".", ",") })
  }

  async function commitEdit() {
    if (!editForm.item.trim()) return
    setSaving(true)
    await onEdit(r.id, editForm.item.trim(), editForm.previsao.trim(), parseDecimal(editForm.valor))
    setEditingId(null)
    setSaving(false)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("border-b last:border-0", accentBorder, isDragging && "opacity-40")}
    >
      {isEditing ? (
        <div className={cn("space-y-2 rounded-lg p-3 my-1", accentBg)}>
          <div className="space-y-1">
            <Label className="text-xs">Item</Label>
            <Input
              autoFocus
              value={editForm.item}
              onChange={(e) => setEditForm({ ...editForm, item: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Previsão</Label>
            <Input
              placeholder="ex: junho, fim do ano…"
              value={editForm.previsao}
              onChange={(e) => setEditForm({ ...editForm, previsao: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Valor (R$)</Label>
            <Input
              inputMode="decimal"
              placeholder="0,00"
              value={editForm.valor}
              onChange={(e) => setEditForm({ ...editForm, valor: e.target.value })}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setEditingId(null)}
              disabled={saving}
            >
              <X size={14} className="mr-1" /> Cancelar
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={commitEdit}
              disabled={saving || !editForm.item.trim()}
            >
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 py-1.5">
          <button
            {...attributes}
            {...listeners}
            className="shrink-0 p-0.5 text-gray-200 hover:text-gray-400 cursor-grab active:cursor-grabbing touch-none"
          >
            <GripVertical size={14} />
          </button>
          <button className="flex-1 min-w-0 text-left" onClick={startEdit}>
            <p className="text-sm text-gray-800 truncate">{r.item}</p>
            {r.previsao && <p className="text-xs text-gray-400">{r.previsao}</p>}
          </button>
          <p className={cn("text-sm font-medium tabular-nums shrink-0", accent)}>
            {formatBRL(r.valor)}
          </p>
          <button
            onClick={() => {
              if (confirmId !== r.id) { setConfirmId(r.id); return }
              setConfirmId(null)
              onDelete(r.id)
            }}
            className={cn(
              "shrink-0 p-1 rounded transition-colors",
              confirmId === r.id ? "text-red-500 bg-red-50" : "text-gray-300 hover:text-gray-500"
            )}
            title={confirmId === r.id ? "Toque de novo para confirmar" : "Remover"}
          >
            {confirmId === r.id
              ? <span className="text-xs font-medium px-1">Confirmar?</span>
              : <Trash2 size={14} />}
          </button>
        </div>
      )}
    </div>
  )
}

interface SectionProps {
  tipo: "entrada" | "saida"
  items: RadarItem[]
  onAdd: (tipo: "entrada" | "saida", item: string, previsao: string, valor: number) => Promise<void>
  onEdit: (id: string, item: string, previsao: string, valor: number) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onReorder: (tipo: "entrada" | "saida", orderedIds: string[]) => Promise<void>
}

function RadarSection({ tipo, items, onAdd, onEdit, onDelete, onReorder }: SectionProps) {
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  async function handleSave() {
    if (!form.item.trim()) return
    setSaving(true)
    await onAdd(tipo, form.item.trim(), form.previsao.trim(), parseDecimal(form.valor))
    setForm(emptyForm)
    setAdding(false)
    setSaving(false)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((r) => r.id === active.id)
    const newIndex = items.findIndex((r) => r.id === over.id)
    onReorder(tipo, arrayMove(items, oldIndex, newIndex).map((r) => r.id))
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

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          <div className="mb-2">
            {items.map((r) => (
              <SortableItem
                key={r.id}
                r={r}
                accent={accent}
                accentBg={accentBg}
                accentBorder={accentBorder}
                editingId={editingId}
                editForm={editForm}
                setEditingId={setEditingId}
                setEditForm={setEditForm}
                confirmId={confirmId}
                setConfirmId={setConfirmId}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

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
    const { data } = await sb()
      .from("radar_items")
      .select("*")
      .order("position")
      .order("created_at")
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
    const position = items.filter((r) => r.tipo === tipo).length
    const { data, error } = await sb()
      .from("radar_items")
      .insert({ tipo, item, previsao, valor, position })
      .select()
      .single()
    if (!error && data) setItems((prev) => [...prev, data as RadarItem])
  }

  async function handleEdit(id: string, item: string, previsao: string, valor: number) {
    const { error } = await sb()
      .from("radar_items")
      .update({ item, previsao, valor })
      .eq("id", id)
    if (!error) {
      setItems((prev) => prev.map((r) => r.id === id ? { ...r, item, previsao, valor } : r))
    }
  }

  async function handleDelete(id: string) {
    const { error } = await sb().from("radar_items").delete().eq("id", id)
    if (!error) setItems((prev) => prev.filter((r) => r.id !== id))
  }

  async function handleReorder(tipo: "entrada" | "saida", orderedIds: string[]) {
    setItems((prev) => {
      const others = prev.filter((r) => r.tipo !== tipo)
      const reordered = orderedIds.map((id, index) => ({
        ...prev.find((r) => r.id === id)!,
        position: index,
      }))
      return [...others, ...reordered]
    })
    await Promise.all(
      orderedIds.map((id, index) =>
        sb().from("radar_items").update({ position: index }).eq("id", id)
      )
    )
  }

  const entradas = items.filter((r) => r.tipo === "entrada")
  const saidas = items.filter((r) => r.tipo === "saida")

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto px-5">
        <SheetHeader className="mb-4">
          <SheetTitle>Radar</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 pb-6">
          <RadarSection
            tipo="entrada"
            items={entradas}
            onAdd={handleAdd}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onReorder={handleReorder}
          />
          <div className="border-t border-gray-100" />
          <RadarSection
            tipo="saida"
            items={saidas}
            onAdd={handleAdd}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onReorder={handleReorder}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
