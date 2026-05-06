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
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { DudaClinica } from "@/lib/types"
import type { SupabaseClient } from "@supabase/supabase-js"

const COLORS = [
  "#3b82f6", "#10b981", "#ec4899", "#8b5cf6",
  "#f97316", "#ef4444", "#eab308", "#14b8a6",
]

interface FormData {
  nome: string
  sigla: string
  cor: string
}

const emptyForm: FormData = { nome: "", sigla: "", cor: COLORS[0] }

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

interface SortableClinicaProps {
  c: DudaClinica
  editingId: string | null
  editForm: FormData
  setEditingId: (id: string | null) => void
  setEditForm: (f: FormData) => void
  confirmId: string | null
  setConfirmId: (id: string | null) => void
  onEdit: (id: string, data: FormData) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

function SortableClinica({
  c, editingId, editForm, setEditingId, setEditForm,
  confirmId, setConfirmId, onEdit, onDelete,
}: SortableClinicaProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.id })
  const [saving, setSaving] = useState(false)
  const isEditing = editingId === c.id

  const style = { transform: CSS.Transform.toString(transform), transition }

  function startEdit() {
    setConfirmId(null)
    setEditingId(c.id)
    setEditForm({ nome: c.nome, sigla: c.sigla ?? "", cor: c.cor })
  }

  async function commitEdit() {
    if (!editForm.nome.trim()) return
    setSaving(true)
    await onEdit(c.id, {
      nome: editForm.nome.trim(),
      sigla: editForm.sigla.trim(),
      cor: editForm.cor,
    })
    setEditingId(null)
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
            <Label className="text-xs">Sigla (opcional)</Label>
            <Input
              placeholder="ex: OF, YM"
              maxLength={6}
              value={editForm.sigla}
              onChange={(e) => setEditForm({ ...editForm, sigla: e.target.value.toUpperCase() })}
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
        <div className="flex items-center gap-2 py-2">
          <button
            {...attributes}
            {...listeners}
            className="shrink-0 p-0.5 text-gray-200 hover:text-gray-400 cursor-grab active:cursor-grabbing touch-none"
          >
            <GripVertical size={16} />
          </button>
          <span
            className="shrink-0 w-3 h-3 rounded-full"
            style={{ backgroundColor: c.cor }}
          />
          <button className="flex-1 min-w-0 text-left flex items-center gap-2" onClick={startEdit}>
            <p className="text-sm text-gray-800 truncate font-medium">{c.nome}</p>
            {c.sigla && (
              <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                {c.sigla}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              if (confirmId !== c.id) { setConfirmId(c.id); return }
              setConfirmId(null)
              onDelete(c.id)
            }}
            className={cn(
              "shrink-0 p-1 rounded transition-colors",
              confirmId === c.id ? "text-red-500 bg-red-50" : "text-gray-300 hover:text-gray-500"
            )}
            title={confirmId === c.id ? "Toque de novo para confirmar" : "Remover"}
          >
            {confirmId === c.id
              ? <span className="text-xs font-medium px-1">Confirmar?</span>
              : <Trash2 size={14} />}
          </button>
        </div>
      )}
    </div>
  )
}

interface Props {
  open: boolean
  onClose: () => void
  onChange?: () => void
}

export function ClinicasSheet({ open, onClose, onChange }: Props) {
  const supabaseRef = useRef<SupabaseClient | null>(null)
  const sb = useCallback(() => {
    if (!supabaseRef.current) supabaseRef.current = createClient()
    return supabaseRef.current
  }, [])

  const [clinicas, setClinicas] = useState<DudaClinica[]>([])
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<FormData>(emptyForm)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const fetchClinicas = useCallback(async () => {
    const { data } = await sb()
      .from("duda_clinicas")
      .select("*")
      .eq("ativa", true)
      .order("position")
      .order("created_at")
    if (data) setClinicas(data as DudaClinica[])
  }, [sb])

  useEffect(() => {
    if (!open) return
    fetchClinicas()
  }, [open, fetchClinicas])

  async function handleAdd() {
    if (!form.nome.trim()) return
    setSaving(true)
    const position = clinicas.length
    const { data, error } = await sb()
      .from("duda_clinicas")
      .insert({
        nome: form.nome.trim(),
        sigla: form.sigla.trim() || null,
        cor: form.cor,
        position,
      })
      .select()
      .single()
    if (error) toast.error("Erro ao adicionar clínica")
    else if (data) {
      setClinicas((prev) => [...prev, data as DudaClinica])
      onChange?.()
    }
    setForm(emptyForm)
    setAdding(false)
    setSaving(false)
  }

  async function handleEdit(id: string, data: FormData) {
    const { error } = await sb()
      .from("duda_clinicas")
      .update({
        nome: data.nome,
        sigla: data.sigla || null,
        cor: data.cor,
      })
      .eq("id", id)
    if (error) toast.error("Erro ao salvar")
    else {
      setClinicas((prev) => prev.map((c) => c.id === id ? { ...c, nome: data.nome, sigla: data.sigla || null, cor: data.cor } : c))
      onChange?.()
    }
  }

  async function handleDelete(id: string) {
    const { error } = await sb()
      .from("duda_clinicas")
      .update({ ativa: false })
      .eq("id", id)
    if (error) toast.error("Erro ao remover")
    else {
      setClinicas((prev) => prev.filter((c) => c.id !== id))
      onChange?.()
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = clinicas.findIndex((c) => c.id === active.id)
    const newIndex = clinicas.findIndex((c) => c.id === over.id)
    const reordered = arrayMove(clinicas, oldIndex, newIndex)
    setClinicas(reordered.map((c, i) => ({ ...c, position: i })))
    onChange?.()
    Promise.all(
      reordered.map((c, i) =>
        sb().from("duda_clinicas").update({ position: i }).eq("id", c.id)
      )
    )
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto px-5">
        <SheetHeader className="mb-4">
          <SheetTitle>Clínicas</SheetTitle>
        </SheetHeader>

        <div className="pb-6">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={clinicas.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              <div className="bg-white rounded-xl border border-gray-100 px-3">
                {clinicas.length === 0 && !adding && (
                  <p className="text-sm text-gray-300 py-4 text-center">Nenhuma clínica cadastrada.</p>
                )}
                {clinicas.map((c) => (
                  <SortableClinica
                    key={c.id}
                    c={c}
                    editingId={editingId}
                    editForm={editForm}
                    setEditingId={setEditingId}
                    setEditForm={setEditForm}
                    confirmId={confirmId}
                    setConfirmId={setConfirmId}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
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
                  placeholder="ex: OdontoFigueirinho"
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Sigla (opcional)</Label>
                <Input
                  placeholder="ex: OF, YM"
                  maxLength={6}
                  value={form.sigla}
                  onChange={(e) => setForm((f) => ({ ...f, sigla: e.target.value.toUpperCase() }))}
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
              <Plus size={16} /> Nova clínica
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
