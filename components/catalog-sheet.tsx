"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Trash2, Plus, X, GripVertical, Pencil, ChevronRight, ChevronDown } from "lucide-react"
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
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { SupabaseClient } from "@supabase/supabase-js"

// Shape mínimo aceito pelo catálogo. Compatível com CategoriaGasto e FormaPagamento.
export interface CatalogItem {
  id: string
  nome: string
  cor: string
  position: number
  ativa: boolean
  parent_id?: string | null  // só em categorias_gasto (modo nested)
}

const COLORS = [
  "#3b82f6", "#10b981", "#ec4899", "#8b5cf6",
  "#f97316", "#ef4444", "#eab308", "#14b8a6",
  "#6366f1", "#06b6d4", "#84cc16", "#a855f7",
]

interface FormData {
  nome: string
  cor: string
}

const emptyForm: FormData = { nome: "", cor: COLORS[0] }

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={cn(
            "w-8 h-8 rounded-full border-2 transition-all",
            value === c ? "border-gray-900 scale-110" : "border-white shadow-sm hover:scale-105"
          )}
          style={{ backgroundColor: c }}
          aria-label={`Selecionar cor ${c}`}
        />
      ))}
    </div>
  )
}

interface SortableItemProps {
  item: CatalogItem
  editingId: string | null
  editForm: FormData
  setEditingId: (id: string | null) => void
  setEditForm: (f: FormData) => void
  confirmId: string | null
  setConfirmId: (id: string | null) => void
  onEdit: (id: string, data: FormData) => Promise<void>
  onDelete: (id: string) => Promise<void>
  // Modo nested (subcategorias) — só usado por categorias_gasto.
  nested?: boolean
  subs?: CatalogItem[]
  addingSubId?: string | null
  setAddingSubId?: (id: string | null) => void
  subName?: string
  setSubName?: (s: string) => void
  onAddSub?: (parentId: string, nome: string) => Promise<void>
  expanded?: boolean
  onToggleExpand?: () => void
}

function SortableItem({
  item, editingId, editForm, setEditingId, setEditForm,
  confirmId, setConfirmId, onEdit, onDelete,
  nested, subs = [], addingSubId, setAddingSubId, subName = "", setSubName, onAddSub,
  expanded, onToggleExpand,
}: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const [saving, setSaving] = useState(false)
  const isEditing = editingId === item.id

  const style = { transform: CSS.Transform.toString(transform), transition }

  function startEdit() {
    setConfirmId(null)
    setEditingId(item.id)
    setEditForm({ nome: item.nome, cor: item.cor })
  }

  async function commitEdit() {
    if (!editForm.nome.trim()) return
    setSaving(true)
    await onEdit(item.id, { nome: editForm.nome.trim(), cor: editForm.cor })
    setEditingId(null)
    setSaving(false)
  }

  function startEditSub(sub: CatalogItem) {
    setConfirmId(null)
    setAddingSubId?.(null)
    setEditingId(sub.id)
    setEditForm({ nome: sub.nome, cor: sub.cor })
  }

  // Sub só edita nome; cor é herdada da mãe na exibição.
  async function commitEditSub(sub: CatalogItem) {
    if (!editForm.nome.trim()) return
    setSaving(true)
    await onEdit(sub.id, { nome: editForm.nome.trim(), cor: sub.cor })
    setEditingId(null)
    setSaving(false)
  }

  async function commitAddSub() {
    if (!subName.trim() || !onAddSub) return
    setSaving(true)
    await onAddSub(item.id, subName.trim())
    setSaving(false)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("border-b border-gray-100 last:border-0", isDragging && "opacity-40")}
    >
      {isEditing ? (
        <div className="space-y-3 rounded-lg p-3 my-2 bg-gray-50">
          <div className="space-y-1">
            <Label className="text-xs">Nome</Label>
            <Input
              autoFocus
              value={editForm.nome}
              onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Cor</Label>
            <ColorPicker value={editForm.cor} onChange={(cor) => setEditForm({ ...editForm, cor })} />
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
              disabled={saving || !editForm.nome.trim()}
            >
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 py-2.5">
          <button
            {...attributes}
            {...listeners}
            className="shrink-0 p-0.5 text-gray-200 hover:text-gray-400 cursor-grab active:cursor-grabbing touch-none"
          >
            <GripVertical size={16} />
          </button>
          {/* Em modo nested, a linha inteira expande/recolhe as subs */}
          <button
            className="flex-1 flex items-center gap-2 min-w-0 text-left"
            onClick={nested ? onToggleExpand : startEdit}
          >
            <span
              className="shrink-0 w-3 h-3 rounded-full"
              style={{ backgroundColor: item.cor }}
            />
            <span className="truncate text-sm text-gray-800 font-medium">{item.nome}</span>
            {nested && subs.length > 0 && (
              <span className="shrink-0 text-[10px] text-gray-400 tabular-nums">{subs.length}</span>
            )}
            {nested && (
              expanded
                ? <ChevronDown size={15} className="shrink-0 text-gray-300" />
                : <ChevronRight size={15} className="shrink-0 text-gray-300" />
            )}
          </button>
          {nested && (
            <button
              onClick={startEdit}
              className="shrink-0 p-1.5 rounded text-gray-300 hover:text-gray-600 transition-colors"
              title="Editar categoria"
            >
              <Pencil size={14} />
            </button>
          )}
          <button
            onClick={() => {
              if (confirmId !== item.id) { setConfirmId(item.id); return }
              setConfirmId(null)
              onDelete(item.id)
            }}
            className={cn(
              "shrink-0 p-1.5 rounded transition-colors",
              confirmId === item.id ? "text-red-500 bg-red-50" : "text-gray-300 hover:text-gray-500"
            )}
            title={confirmId === item.id ? "Toque de novo para confirmar" : "Remover"}
          >
            {confirmId === item.id
              ? <span className="text-xs font-medium px-1">Confirmar?</span>
              : <Trash2 size={14} />}
          </button>
        </div>
      )}

      {/* Subcategorias (modo nested) — visíveis só quando a mãe está expandida */}
      {nested && !isEditing && expanded && (
        <div className="pl-9 pb-2 space-y-0.5">
          {subs.map((sub) =>
            editingId === sub.id ? (
              <div key={sub.id} className="flex items-center gap-2 py-1">
                <Input
                  autoFocus
                  value={editForm.nome}
                  onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })}
                  className="h-8 text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingId(null)}
                  disabled={saving}
                >
                  <X size={14} />
                </Button>
                <Button
                  size="sm"
                  onClick={() => commitEditSub(sub)}
                  disabled={saving || !editForm.nome.trim()}
                >
                  Salvar
                </Button>
              </div>
            ) : (
              <div key={sub.id} className="flex items-center gap-2 py-1">
                <span className="shrink-0 text-gray-300 text-sm leading-none">›</span>
                <button className="flex-1 min-w-0 text-left" onClick={() => startEditSub(sub)}>
                  <p className="text-sm text-gray-600 truncate">{sub.nome}</p>
                </button>
                <button
                  onClick={() => {
                    if (confirmId !== sub.id) { setConfirmId(sub.id); return }
                    setConfirmId(null)
                    onDelete(sub.id)
                  }}
                  className={cn(
                    "shrink-0 p-1 rounded transition-colors",
                    confirmId === sub.id ? "text-red-500 bg-red-50" : "text-gray-300 hover:text-gray-500"
                  )}
                  title={confirmId === sub.id ? "Toque de novo para confirmar" : "Remover"}
                >
                  {confirmId === sub.id
                    ? <span className="text-xs font-medium px-1">Confirmar?</span>
                    : <Trash2 size={13} />}
                </button>
              </div>
            )
          )}
          {addingSubId === item.id ? (
            <div className="flex items-center gap-2 py-1">
              <Input
                autoFocus
                placeholder="ex: Gasolina"
                value={subName}
                onChange={(e) => setSubName?.(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") commitAddSub() }}
                className="h-8 text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddingSubId?.(null)}
                disabled={saving}
              >
                <X size={14} />
              </Button>
              <Button size="sm" onClick={commitAddSub} disabled={saving || !subName.trim()}>
                Salvar
              </Button>
            </div>
          ) : (
            <button
              onClick={() => { setSubName?.(""); setAddingSubId?.(item.id) }}
              className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors py-1"
            >
              <Plus size={12} /> subcategoria
            </button>
          )}
        </div>
      )}
    </div>
  )
}

interface Props {
  open: boolean
  onClose: () => void
  table: string  // ex: "categorias_gasto", "formas_pagamento"
  title: string
  itemLabelSingular: string  // ex: "categoria", "forma de pagamento"
  placeholder?: string
  nested?: boolean  // habilita subcategorias (1 nível) — só categorias_gasto
  onChange?: () => void
}

export function CatalogSheet({
  open, onClose, table, title, itemLabelSingular, placeholder, nested, onChange,
}: Props) {
  const supabaseRef = useRef<SupabaseClient | null>(null)
  const sb = useCallback(() => {
    if (!supabaseRef.current) supabaseRef.current = createClient()
    return supabaseRef.current
  }, [])

  const [items, setItems] = useState<CatalogItem[]>([])
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<FormData>(emptyForm)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [addingSubId, setAddingSubId] = useState<string | null>(null)
  const [subName, setSubName] = useState("")
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  // Raízes ordenadas como vêm do fetch; subs agrupadas por mãe.
  const roots = items.filter((c) => !c.parent_id)
  const subsMap = new Map<string, CatalogItem[]>()
  for (const c of items) {
    if (!c.parent_id) continue
    if (!subsMap.has(c.parent_id)) subsMap.set(c.parent_id, [])
    subsMap.get(c.parent_id)!.push(c)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const fetchItems = useCallback(async () => {
    const { data } = await sb()
      .from(table)
      .select("*")
      .eq("ativa", true)
      .order("position")
      .order("created_at")
    if (data) setItems(data as CatalogItem[])
  }, [sb, table])

  useEffect(() => {
    if (!open) return
    fetchItems()
  }, [open, fetchItems])

  async function handleAdd() {
    if (!form.nome.trim()) return
    setSaving(true)
    const position = roots.length
    const { data, error } = await sb()
      .from(table)
      .insert({
        nome: form.nome.trim(),
        cor: form.cor,
        position,
      })
      .select()
      .single()
    if (error) toast.error(`Erro ao adicionar ${itemLabelSingular}`)
    else if (data) {
      setItems((prev) => [...prev, data as CatalogItem])
      onChange?.()
    }
    setForm(emptyForm)
    setAdding(false)
    setSaving(false)
  }

  // Sub herda a cor da mãe (a exibição rola pra mãe de qualquer forma).
  async function handleAddSub(parentId: string, nome: string) {
    const parent = items.find((c) => c.id === parentId)
    const position = (subsMap.get(parentId) ?? []).length
    const { data, error } = await sb()
      .from(table)
      .insert({
        nome,
        cor: parent?.cor ?? COLORS[0],
        position,
        parent_id: parentId,
      })
      .select()
      .single()
    if (error) toast.error("Erro ao adicionar subcategoria")
    else if (data) {
      setItems((prev) => [...prev, data as CatalogItem])
      onChange?.()
    }
    setSubName("")
    setAddingSubId(null)
  }

  async function handleEdit(id: string, data: FormData) {
    const { error } = await sb()
      .from(table)
      .update({ nome: data.nome, cor: data.cor })
      .eq("id", id)
    if (error) toast.error("Erro ao salvar")
    else {
      setItems((prev) => prev.map((c) => c.id === id ? { ...c, nome: data.nome, cor: data.cor } : c))
      onChange?.()
    }
  }

  // Soft-delete: marca ativa=false. Gastos vinculados continuam apontando
  // para o registro (FK RESTRICT impede delete físico). Remover uma mãe
  // também desativa as subs dela (senão ficariam órfãs na seleção).
  async function handleDelete(id: string) {
    const subIds = items.filter((c) => c.parent_id === id).map((c) => c.id)
    const ids = [id, ...subIds]
    const { error } = await sb()
      .from(table)
      .update({ ativa: false })
      .in("id", ids)
    if (error) toast.error("Erro ao remover")
    else {
      setItems((prev) => prev.filter((c) => !ids.includes(c.id)))
      onChange?.()
    }
  }

  // Drag só reordena raízes; subs acompanham a mãe.
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = roots.findIndex((c) => c.id === active.id)
    const newIndex = roots.findIndex((c) => c.id === over.id)
    const reordered = arrayMove(roots, oldIndex, newIndex).map((c, i) => ({ ...c, position: i }))
    const byId = new Map(reordered.map((c) => [c.id, c]))
    setItems((prev) => prev.map((c) => byId.get(c.id) ?? c))
    onChange?.()
    Promise.all(
      reordered.map((c) =>
        sb().from(table).update({ position: c.position }).eq("id", c.id)
      )
    )
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto px-5">
        <SheetHeader className="mb-4">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>

        <div className="pb-6">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={roots.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              <div className="bg-white rounded-xl border border-gray-100 px-3">
                {roots.length === 0 && !adding && (
                  <p className="text-sm text-gray-300 py-4 text-center">
                    Nenhuma {itemLabelSingular} cadastrada.
                  </p>
                )}
                {roots.map((item) => (
                  <SortableItem
                    key={item.id}
                    item={item}
                    editingId={editingId}
                    editForm={editForm}
                    setEditingId={setEditingId}
                    setEditForm={setEditForm}
                    confirmId={confirmId}
                    setConfirmId={setConfirmId}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    nested={nested}
                    subs={subsMap.get(item.id) ?? []}
                    addingSubId={addingSubId}
                    setAddingSubId={setAddingSubId}
                    subName={subName}
                    setSubName={setSubName}
                    onAddSub={handleAddSub}
                    expanded={expandedIds.has(item.id)}
                    onToggleExpand={() => toggleExpand(item.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {adding ? (
            <div className="space-y-3 rounded-xl p-4 mt-3 bg-white border border-gray-100">
              <div className="space-y-1">
                <Label className="text-xs">Nome</Label>
                <Input
                  autoFocus
                  placeholder={placeholder}
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cor</Label>
                <ColorPicker value={form.cor} onChange={(cor) => setForm((f) => ({ ...f, cor }))} />
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
                  onClick={handleAdd}
                  disabled={saving || !form.nome.trim()}
                >
                  {saving ? "Salvando…" : "Salvar"}
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { setForm(emptyForm); setAdding(true) }}
              className="mt-3 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors py-2 px-3"
            >
              <Plus size={16} /> Nova {itemLabelSingular}
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
