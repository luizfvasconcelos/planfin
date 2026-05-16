"use client"

import { useState, useCallback, useRef, useMemo } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Archive, Trash2, Plus, X, Pencil } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { cn, formatBRL, formatMonthShort, isoMonthToday, parseDecimal } from "@/lib/utils"
import { mesToISO, isoToMes } from "@/lib/contas-fixas"
import type { ContaFixa, ContaFixaVigencia } from "@/lib/types"
import type { SupabaseClient } from "@supabase/supabase-js"

interface Props {
  open: boolean
  contaId: string | null  // null = criando
  contas: ContaFixa[]
  vigencias: ContaFixaVigencia[]
  onClose: () => void
  onChange: () => void
}

interface VigForm {
  mes_inicio: string  // YYYY-MM
  mes_fim: string  // YYYY-MM (vazio = sem fim)
  valor: string
}

const emptyVigForm: VigForm = { mes_inicio: "", mes_fim: "", valor: "" }

export function ContaFixaSheet({
  open,
  contaId,
  contas,
  vigencias,
  onClose,
  onChange,
}: Props) {
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto px-5">
        <SheetHeader className="mb-4">
          <SheetTitle>{contaId === null ? "Nova conta" : "Editar conta"}</SheetTitle>
        </SheetHeader>
        {open ? (
          <SheetBody
            key={contaId ?? "new"}
            contaId={contaId}
            contas={contas}
            vigencias={vigencias}
            onClose={onClose}
            onChange={onChange}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function SheetBody({
  contaId,
  contas,
  vigencias,
  onClose,
  onChange,
}: {
  contaId: string | null
  contas: ContaFixa[]
  vigencias: ContaFixaVigencia[]
  onClose: () => void
  onChange: () => void
}) {
  const sbRef = useRef<SupabaseClient | null>(null)
  const sb = useCallback(() => {
    if (!sbRef.current) sbRef.current = createClient()
    return sbRef.current
  }, [])

  const conta = useMemo(
    () => (contaId ? contas.find((c) => c.id === contaId) ?? null : null),
    [contaId, contas]
  )
  const isCreating = contaId === null

  const [nome, setNome] = useState(conta?.nome ?? "")
  const [saving, setSaving] = useState(false)
  const [editingVigId, setEditingVigId] = useState<string | null>(null)
  const [vigForm, setVigForm] = useState<VigForm>(emptyVigForm)
  const [addingVig, setAddingVig] = useState(false)
  const [confirmDeleteVig, setConfirmDeleteVig] = useState<string | null>(null)
  const [confirmArchive, setConfirmArchive] = useState(false)

  const contaVigencias = useMemo(
    () =>
      vigencias
        .filter((v) => v.conta_id === contaId)
        .sort((a, b) => a.mes_inicio.localeCompare(b.mes_inicio)),
    [vigencias, contaId]
  )

  async function handleSaveConta() {
    if (!nome.trim()) { toast.error("Informe o nome da conta"); return }
    setSaving(true)
    if (isCreating) {
      const position = contas.length
      const { error } = await sb()
        .from("contas_fixas")
        .insert({ nome: nome.trim(), position })
      if (error) toast.error("Erro ao criar conta")
      else { onChange(); onClose() }
    } else if (conta) {
      if (nome.trim() !== conta.nome) {
        const { error } = await sb()
          .from("contas_fixas")
          .update({ nome: nome.trim() })
          .eq("id", conta.id)
        if (error) toast.error("Erro ao salvar")
        else onChange()
      }
    }
    setSaving(false)
  }

  async function handleArchive() {
    if (!conta) return
    const { error } = await sb()
      .from("contas_fixas")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", conta.id)
    if (error) toast.error("Erro ao arquivar")
    else { onChange(); onClose() }
  }

  function startAddVig() {
    setAddingVig(true)
    setEditingVigId(null)
    setVigForm({
      mes_inicio: isoMonthToday(),
      mes_fim: "",
      valor: "",
    })
  }

  function startEditVig(v: ContaFixaVigencia) {
    setEditingVigId(v.id)
    setAddingVig(false)
    setVigForm({
      mes_inicio: isoToMes(v.mes_inicio),
      mes_fim: v.mes_fim ? isoToMes(v.mes_fim) : "",
      valor: String(v.valor).replace(".", ","),
    })
  }

  function cancelVigForm() {
    setAddingVig(false)
    setEditingVigId(null)
    setVigForm(emptyVigForm)
  }

  async function handleSaveVig() {
    if (!contaId) return
    if (!vigForm.mes_inicio) { toast.error("Defina o mês inicial"); return }
    if (vigForm.mes_fim && vigForm.mes_fim < vigForm.mes_inicio) {
      toast.error("Mês final antes do inicial"); return
    }
    const payload = {
      conta_id: contaId,
      mes_inicio: mesToISO(vigForm.mes_inicio),
      mes_fim: vigForm.mes_fim ? mesToISO(vigForm.mes_fim) : null,
      valor: parseDecimal(vigForm.valor),
    }
    setSaving(true)
    if (editingVigId) {
      const { error } = await sb()
        .from("contas_fixas_vigencias")
        .update(payload)
        .eq("id", editingVigId)
      if (error) toast.error("Erro ao salvar vigência")
      else { onChange(); cancelVigForm() }
    } else {
      const { error } = await sb()
        .from("contas_fixas_vigencias")
        .insert(payload)
      if (error) toast.error("Erro ao criar vigência")
      else { onChange(); cancelVigForm() }
    }
    setSaving(false)
  }

  async function handleDeleteVig(id: string) {
    const { error } = await sb().from("contas_fixas_vigencias").delete().eq("id", id)
    if (error) toast.error("Erro ao remover vigência")
    else onChange()
  }

  const showVigForm = addingVig || editingVigId !== null
  const dirty = !isCreating && conta && nome.trim() !== conta.nome

  return (
    <div className="pb-6 space-y-4">
      <div className="space-y-1">
        <Label className="text-xs">Nome</Label>
        <Input
          autoFocus={isCreating}
          placeholder="ex: Aluguel, Inglês, Cartão Nubank"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
      </div>

      {isCreating ? (
        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={onClose}
            disabled={saving}
          >
            <X size={14} className="mr-1" /> Cancelar
          </Button>
          <Button
            size="sm"
            className="flex-1"
            onClick={handleSaveConta}
            disabled={saving || !nome.trim()}
          >
            {saving ? "Salvando…" : "Criar"}
          </Button>
        </div>
      ) : (
        <>
          {dirty && (
            <Button
              size="sm"
              className="w-full"
              onClick={handleSaveConta}
              disabled={saving || !nome.trim()}
            >
              {saving ? "Salvando…" : "Salvar nome"}
            </Button>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs">Vigências (valor padrão por período)</Label>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 px-3">
              {contaVigencias.length === 0 && !addingVig && (
                <p className="text-sm text-gray-300 py-4 text-center">
                  Sem vigências. Adicione uma para preencher meses automaticamente.
                </p>
              )}
              {contaVigencias.map((v) => (
                <div key={v.id} className="border-b border-gray-100 last:border-0 py-2">
                  {editingVigId === v.id ? (
                    <VigFormFields
                      form={vigForm}
                      setForm={setVigForm}
                      onCancel={cancelVigForm}
                      onSave={handleSaveVig}
                      saving={saving}
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 tabular-nums">
                          {formatBRL(Number(v.valor))}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatMonthShort(isoToMes(v.mes_inicio))}
                          {" "}até{" "}
                          {v.mes_fim ? formatMonthShort(isoToMes(v.mes_fim)) : "em diante"}
                        </p>
                      </div>
                      <button
                        onClick={() => startEditVig(v)}
                        className="shrink-0 p-1 text-gray-300 hover:text-gray-600 rounded"
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirmDeleteVig !== v.id) { setConfirmDeleteVig(v.id); return }
                          setConfirmDeleteVig(null)
                          handleDeleteVig(v.id)
                        }}
                        className={cn(
                          "shrink-0 p-1 rounded transition-colors",
                          confirmDeleteVig === v.id ? "text-red-500 bg-red-50" : "text-gray-300 hover:text-gray-500"
                        )}
                        title={confirmDeleteVig === v.id ? "Toque de novo para confirmar" : "Remover"}
                      >
                        {confirmDeleteVig === v.id
                          ? <span className="text-xs font-medium px-1">Confirmar?</span>
                          : <Trash2 size={14} />}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {addingVig ? (
              <div className="mt-3 bg-white rounded-xl border border-gray-100 p-3">
                <VigFormFields
                  form={vigForm}
                  setForm={setVigForm}
                  onCancel={cancelVigForm}
                  onSave={handleSaveVig}
                  saving={saving}
                />
              </div>
            ) : !showVigForm && (
              <button
                onClick={startAddVig}
                className="mt-3 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors py-2 px-3"
              >
                <Plus size={16} /> Nova vigência
              </button>
            )}
          </div>

          <div className="pt-2 border-t border-gray-100">
            <button
              onClick={() => {
                if (!confirmArchive) { setConfirmArchive(true); return }
                handleArchive()
              }}
              className={cn(
                "w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm transition-colors",
                confirmArchive
                  ? "bg-red-50 text-red-600"
                  : "text-gray-500 hover:text-gray-800"
              )}
            >
              <Archive size={14} />
              {confirmArchive ? "Confirmar arquivar?" : "Arquivar conta"}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function VigFormFields({
  form,
  setForm,
  onCancel,
  onSave,
  saving,
}: {
  form: VigForm
  setForm: (f: VigForm) => void
  onCancel: () => void
  onSave: () => void
  saving: boolean
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Início</Label>
          <Input
            type="month"
            value={form.mes_inicio}
            onChange={(e) => setForm({ ...form, mes_inicio: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Fim (vazio = em diante)</Label>
          <Input
            type="month"
            value={form.mes_fim}
            onChange={(e) => setForm({ ...form, mes_fim: e.target.value })}
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Valor (R$)</Label>
        <Input
          inputMode="decimal"
          placeholder="0,00"
          value={form.valor}
          onChange={(e) => setForm({ ...form, valor: e.target.value })}
        />
      </div>
      <div className="flex gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={onCancel}
          disabled={saving}
        >
          <X size={14} className="mr-1" /> Cancelar
        </Button>
        <Button
          size="sm"
          className="flex-1"
          onClick={onSave}
          disabled={saving || !form.mes_inicio || !form.valor}
        >
          {saving ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </div>
  )
}
