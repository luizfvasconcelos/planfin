"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Trash2, Plus, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { cn, parseDecimal, formatBRL } from "@/lib/utils"
import type { DudaClinica, DudaAgendaSlot, DudaSlotTipo } from "@/lib/types"
import type { SupabaseClient } from "@supabase/supabase-js"

const WEEKDAYS = [
  { key: 0, label: "Dom", full: "Domingo" },
  { key: 1, label: "Seg", full: "Segunda" },
  { key: 2, label: "Ter", full: "Terça" },
  { key: 3, label: "Qua", full: "Quarta" },
  { key: 4, label: "Qui", full: "Quinta" },
  { key: 5, label: "Sex", full: "Sexta" },
  { key: 6, label: "Sáb", full: "Sábado" },
]

interface FormData {
  weekday: number
  clinica_id: string
  tipo: DudaSlotTipo
  minimo: string
}

const emptyForm: FormData = { weekday: 1, clinica_id: "", tipo: "producao", minimo: "" }

interface Props {
  open: boolean
  onClose: () => void
  clinicas: DudaClinica[]
  onChange?: () => void
}

export function AgendaSheet({ open, onClose, clinicas, onChange }: Props) {
  const sbRef = useRef<SupabaseClient | null>(null)
  const sb = useCallback(() => {
    if (!sbRef.current) sbRef.current = createClient()
    return sbRef.current
  }, [])

  const [slots, setSlots] = useState<DudaAgendaSlot[]>([])
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<FormData>(emptyForm)
  const [saving, setSaving] = useState(false)

  const fetchSlots = useCallback(async () => {
    const { data } = await sb()
      .from("duda_agenda")
      .select("*")
      .order("weekday")
    if (data) setSlots(data as DudaAgendaSlot[])
  }, [sb])

  useEffect(() => { if (open) fetchSlots() }, [open, fetchSlots])

  function clinicaById(id: string) {
    return clinicas.find((c) => c.id === id)
  }

  async function handleAdd() {
    if (!form.clinica_id) { toast.error("Selecione uma clínica"); return }
    setSaving(true)
    const { data, error } = await sb()
      .from("duda_agenda")
      .insert({
        weekday: form.weekday,
        clinica_id: form.clinica_id,
        tipo: form.tipo,
        minimo: form.tipo === "diaria" && form.minimo.trim()
          ? parseDecimal(form.minimo)
          : null,
      })
      .select()
      .single()
    if (error) {
      const msg = error.message?.toLowerCase().includes("duplicate")
        ? "Essa clínica já tem slot nesse dia"
        : "Erro ao salvar"
      toast.error(msg)
    } else if (data) {
      setSlots((prev) => [...prev, data as DudaAgendaSlot].sort((a, b) => a.weekday - b.weekday))
      onChange?.()
      setForm(emptyForm)
      setAdding(false)
    }
    setSaving(false)
  }

  function startEdit(s: DudaAgendaSlot) {
    setEditingId(s.id)
    setEditForm({
      weekday: s.weekday,
      clinica_id: s.clinica_id,
      tipo: s.tipo,
      minimo: s.minimo != null ? String(s.minimo).replace(".", ",") : "",
    })
  }

  async function commitEdit() {
    if (!editingId) return
    if (!editForm.clinica_id) { toast.error("Selecione uma clínica"); return }
    setSaving(true)
    const { error } = await sb()
      .from("duda_agenda")
      .update({
        weekday: editForm.weekday,
        clinica_id: editForm.clinica_id,
        tipo: editForm.tipo,
        minimo: editForm.tipo === "diaria" && editForm.minimo.trim()
          ? parseDecimal(editForm.minimo)
          : null,
      })
      .eq("id", editingId)
    if (error) toast.error("Erro ao salvar")
    else {
      setSlots((prev) =>
        prev.map((s) => s.id === editingId
          ? {
              ...s,
              weekday: editForm.weekday,
              clinica_id: editForm.clinica_id,
              tipo: editForm.tipo,
              minimo: editForm.tipo === "diaria" && editForm.minimo.trim() ? parseDecimal(editForm.minimo) : null,
            }
          : s
        ).sort((a, b) => a.weekday - b.weekday)
      )
      onChange?.()
      setEditingId(null)
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    const { error } = await sb().from("duda_agenda").delete().eq("id", id)
    if (error) toast.error("Erro ao remover")
    else {
      setSlots((prev) => prev.filter((s) => s.id !== id))
      onChange?.()
    }
  }

  // Group slots by weekday for display
  const slotsByDay: Record<number, DudaAgendaSlot[]> = {}
  WEEKDAYS.forEach((w) => slotsByDay[w.key] = [])
  slots.forEach((s) => slotsByDay[s.weekday]?.push(s))

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto px-5">
        <SheetHeader className="mb-4">
          <SheetTitle>Agenda Semanal</SheetTitle>
        </SheetHeader>

        <div className="pb-6 space-y-3">
          {clinicas.length === 0 && (
            <p className="text-sm text-gray-400 py-4 text-center">
              Cadastre clínicas antes de configurar a agenda.
            </p>
          )}

          {clinicas.length > 0 && (
            <>
              <div className="space-y-3">
                {WEEKDAYS.map((w) => {
                  const daySlots = slotsByDay[w.key] ?? []
                  return (
                    <div key={w.key} className="bg-white rounded-xl border border-gray-100 px-3 py-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                        {w.full}
                      </p>
                      {daySlots.length === 0 ? (
                        <p className="text-xs text-gray-300 py-1">Sem trabalho</p>
                      ) : (
                        <div>
                          {daySlots.map((s) => {
                            const c = clinicaById(s.clinica_id)
                            const isEditing = editingId === s.id
                            if (isEditing) {
                              return (
                                <div key={s.id} className="my-2 rounded-lg p-3 bg-gray-50">
                                  <SlotForm form={editForm} setForm={setEditForm} clinicas={clinicas} />
                                  <div className="flex gap-2 mt-3">
                                    <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditingId(null)} disabled={saving}>
                                      <X size={14} className="mr-1" /> Cancelar
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                                      onClick={() => { handleDelete(s.id); setEditingId(null) }}
                                      disabled={saving}
                                    >
                                      <Trash2 size={14} className="mr-1" /> Remover
                                    </Button>
                                    <Button size="sm" className="flex-1" onClick={commitEdit} disabled={saving}>
                                      {saving ? "…" : "Salvar"}
                                    </Button>
                                  </div>
                                </div>
                              )
                            }
                            return (
                              <button
                                key={s.id}
                                onClick={() => startEdit(s)}
                                className="w-full flex items-center gap-2 py-1.5 text-left hover:bg-gray-50 rounded px-1 transition-colors"
                              >
                                <span
                                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                                  style={{ backgroundColor: c ? `${c.cor}1a` : "#e5e7eb", color: c?.cor ?? "#6b7280" }}
                                >
                                  {c?.sigla || c?.nome || "?"}
                                </span>
                                <span className="text-sm text-gray-700">
                                  {s.tipo === "diaria" ? "Diária" : "Produção"}
                                </span>
                                {s.tipo === "diaria" && s.minimo != null && (
                                  <span className="text-xs text-gray-400">• mín {formatBRL(Number(s.minimo))}</span>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {adding ? (
                <div className="bg-white rounded-xl border border-gray-100 p-4">
                  <SlotForm form={form} setForm={setForm} clinicas={clinicas} />
                  <div className="flex gap-2 mt-3">
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
                      disabled={saving || !form.clinica_id}
                    >
                      {saving ? "Salvando…" : "Salvar"}
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { setForm(emptyForm); setAdding(true) }}
                  className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors py-2 bg-white rounded-xl border border-dashed border-gray-200"
                >
                  <Plus size={16} /> Adicionar slot
                </button>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function SlotForm({
  form,
  setForm,
  clinicas,
}: {
  form: FormData
  setForm: (f: FormData | ((prev: FormData) => FormData)) => void
  clinicas: DudaClinica[]
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs">Dia da semana</Label>
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map((w) => {
            const active = form.weekday === w.key
            return (
              <button
                key={w.key}
                type="button"
                onClick={() => setForm((f) => ({ ...f, weekday: w.key }))}
                className={cn(
                  "text-xs font-semibold px-2.5 py-1 rounded-full border transition-all",
                  active ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200"
                )}
              >
                {w.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Clínica</Label>
        <div className="flex flex-wrap gap-1.5">
          {clinicas
            .filter((c) => c.ativa || c.id === form.clinica_id)
            .map((c) => {
              const active = form.clinica_id === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, clinica_id: c.id }))}
                  className={cn(
                    "text-xs font-semibold px-2.5 py-1 rounded-full border transition-all",
                    active ? "text-white shadow-sm" : "text-gray-700 bg-white",
                    !c.ativa && !active && "opacity-60"
                  )}
                  style={
                    active
                      ? { backgroundColor: c.cor, borderColor: c.cor }
                      : { borderColor: "#e5e7eb" }
                  }
                >
                  {c.sigla || c.nome}
                  {!c.ativa && " (inativa)"}
                </button>
              )
            })}
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Tipo</Label>
        <div className="inline-flex bg-gray-100 rounded-full p-0.5">
          {(["producao", "diaria"] as const).map((t) => {
            const active = form.tipo === t
            return (
              <button
                key={t}
                type="button"
                onClick={() => setForm((f) => ({ ...f, tipo: t }))}
                className={cn(
                  "text-xs font-semibold px-3 py-1 rounded-full transition-colors",
                  active ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                )}
              >
                {t === "diaria" ? "Diária" : "Produção"}
              </button>
            )
          })}
        </div>
      </div>

      {form.tipo === "diaria" && (
        <div className="space-y-1">
          <Label className="text-xs">Mínimo da diária (R$)</Label>
          <Input
            inputMode="decimal"
            placeholder="ex: 160,00"
            value={form.minimo}
            onChange={(e) => setForm((f) => ({ ...f, minimo: e.target.value }))}
          />
        </div>
      )}
    </div>
  )
}
