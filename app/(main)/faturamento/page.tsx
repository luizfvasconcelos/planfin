"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import type { SupabaseClient } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ChevronLeft, ChevronRight, Settings, CalendarClock, CalendarDays, TrendingUp, Share2, Info, Plus, X, Trash2 } from "lucide-react"
import { Toaster } from "@/components/ui/sonner"
import { toast } from "sonner"
import { ClinicasSheet } from "@/components/clinicas-sheet"
import { AgendaSheet } from "@/components/agenda-sheet"
import { PlanoMesSheet } from "@/components/plano-mes-sheet"
import { InfoSheet } from "@/components/info-sheet"
import { TendenciasSheet } from "@/components/tendencias-sheet"
import { ExportSheet } from "@/components/export-sheet"
import {
  formatBRL,
  parseDecimal,
  isoToday,
  isoMonthOf,
  isoMonthToday,
  monthRange,
  addMonths,
  formatMonthLong,
  formatMonthShort,
  formatDayMonth,
  cn,
} from "@/lib/utils"
import { computeClinicaStats } from "@/lib/duda"
import type { DudaClinica, DudaEntry, DudaAgendaSlot } from "@/lib/types"

const MIN_MONTH = "2026-01"
const PRAZO_OPTIONS = [0, 1, 2] as const
const PRAZO_LABELS: Record<number, string> = { 0: "À vista", 1: "1m", 2: "2m" }

interface SplitRow {
  valor: string
  meses: number
}

interface AddFormData {
  date: string
  clinica_id: string
  rows: SplitRow[]
}

interface EditFormData {
  date: string
  clinica_id: string
  valor: string
  meses: number
}

function mesRecebimentoOf(entry: DudaEntry): string {
  return addMonths(isoMonthOf(entry.date), entry.meses_recebimento)
}

export default function FaturamentoPage() {
  const supabaseRef = useRef<SupabaseClient | null>(null)
  const sb = useCallback(() => {
    if (!supabaseRef.current) supabaseRef.current = createClient()
    return supabaseRef.current
  }, [])

  const [month, setMonth] = useState<string>(isoMonthToday())
  const [clinicas, setClinicas] = useState<DudaClinica[]>([])
  const [entries, setEntries] = useState<DudaEntry[]>([])
  // Entries lançadas em (month-2) com meses_recebimento=2 que caem neste mês.
  // Dá visibilidade do M-2 chegando, sem misturar com o faturamento do mês.
  const [entriesM2In, setEntriesM2In] = useState<DudaEntry[]>([])
  const [agenda, setAgenda] = useState<DudaAgendaSlot[]>([])
  const [daysOff, setDaysOff] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [clinicasOpen, setClinicasOpen] = useState(false)
  const [agendaOpen, setAgendaOpen] = useState(false)
  const [planoOpen, setPlanoOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [tendenciasOpen, setTendenciasOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)

  const [adding, setAdding] = useState(false)
  const [addForm, setAddForm] = useState<AddFormData>({
    date: isoToday(),
    clinica_id: "",
    rows: [{ valor: "", meses: 0 }],
  })
  const [saving, setSaving] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditFormData>({
    date: "",
    clinica_id: "",
    valor: "",
    meses: 0,
  })
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const fetchClinicas = useCallback(async () => {
    // Fetch all (active + inactive) so historical entries can resolve names/colors.
    // Forms filter to active-only when displaying chip pickers.
    const { data } = await sb()
      .from("duda_clinicas")
      .select("*")
      .order("position")
    if (data) setClinicas(data as DudaClinica[])
  }, [sb])

  const fetchAgenda = useCallback(async () => {
    const { data } = await sb()
      .from("duda_agenda")
      .select("*")
      .order("weekday")
    if (data) setAgenda(data as DudaAgendaSlot[])
  }, [sb])

  const fetchEntries = useCallback(async () => {
    const { start, end } = monthRange(month)
    const { data } = await sb()
      .from("duda_entries")
      .select("*")
      .gte("date", start)
      .lte("date", end)
      .order("date")
    if (data) setEntries(data as DudaEntry[])
    setLoading(false)
  }, [sb, month])

  const fetchEntriesM2In = useCallback(async () => {
    const { start, end } = monthRange(addMonths(month, -2))
    const { data } = await sb()
      .from("duda_entries")
      .select("*")
      .gte("date", start)
      .lte("date", end)
      .eq("meses_recebimento", 2)
    setEntriesM2In((data as DudaEntry[] | null) ?? [])
  }, [sb, month])

  const fetchDaysOff = useCallback(async () => {
    const { start, end } = monthRange(month)
    const { data } = await sb()
      .from("duda_dia_off")
      .select("date")
      .gte("date", start)
      .lte("date", end)
    if (data) setDaysOff((data as { date: string }[]).map((d) => d.date))
  }, [sb, month])

  useEffect(() => { fetchClinicas() }, [fetchClinicas])
  useEffect(() => { fetchAgenda() }, [fetchAgenda])
  useEffect(() => { fetchEntries() }, [fetchEntries])
  useEffect(() => { fetchEntriesM2In() }, [fetchEntriesM2In])
  useEffect(() => { fetchDaysOff() }, [fetchDaysOff])

  const clinicaById = useCallback(
    (id: string) => clinicas.find((c) => c.id === id),
    [clinicas]
  )

  // Stats per clinic for the current month.
  // Show clinics that are either currently active OR have entries this month
  // (so deactivated clinics still surface in historical months).
  const daysOffSet = new Set(daysOff)
  const activeClinicas = clinicas.filter((c) => c.ativa)
  const isPastMonth = month < isoMonthToday()
  const statsByClinica = clinicas
    .map((c) => computeClinicaStats(c, entries, agenda, daysOffSet, month))
    .filter((st) => st.clinica.ativa || st.count > 0)

  const totalMonth = entries.reduce((sum, e) => sum + Number(e.valor), 0)
  const totalProjetado = statsByClinica.reduce((s, st) => s + st.projetado, 0)

  const hasGlobalSplit = entries.some((e) => e.meses_recebimento > 0)
  const recebimentoTotalByMes = new Map<string, number>()
  if (hasGlobalSplit) {
    for (const e of entries) {
      const mes = mesRecebimentoOf(e)
      recebimentoTotalByMes.set(mes, (recebimentoTotalByMes.get(mes) ?? 0) + Number(e.valor))
    }
  }
  const recebimentoTotalList = Array.from(recebimentoTotalByMes.entries())
    .sort(([a], [b]) => a.localeCompare(b))

  const totalM2In = entriesM2In.reduce((s, e) => s + Number(e.valor), 0)
  const m2OriginMonth = addMonths(month, -2)

  async function handleAdd() {
    if (!addForm.clinica_id) { toast.error("Selecione uma clínica"); return }
    if (!addForm.date) { toast.error("Selecione a data"); return }
    if (isoMonthOf(addForm.date) !== month) { toast.error("A data está fora do mês visualizado"); return }
    const linhas = addForm.rows
      .map((r) => ({ valor: parseDecimal(r.valor), meses: r.meses }))
      .filter((r) => r.valor > 0)
    if (linhas.length === 0) { toast.error("Informe ao menos um valor"); return }
    setSaving(true)
    const { data: { user } } = await sb().auth.getUser()
    const inserts = linhas.map((l) => ({
      date: addForm.date,
      clinica_id: addForm.clinica_id,
      valor: l.valor,
      meses_recebimento: l.meses,
      updated_by: user?.id,
    }))
    const { data, error } = await sb()
      .from("duda_entries")
      .insert(inserts)
      .select()
    if (error) toast.error("Erro ao salvar entrada")
    else if (data) {
      setEntries((prev) =>
        [...prev, ...(data as DudaEntry[])].sort((a, b) => a.date.localeCompare(b.date))
      )
      setAddForm({ date: addForm.date, clinica_id: "", rows: [{ valor: "", meses: 0 }] })
      setAdding(false)
    }
    setSaving(false)
  }

  function startEdit(e: DudaEntry) {
    setConfirmId(null)
    setEditingId(e.id)
    setEditForm({
      date: e.date,
      clinica_id: e.clinica_id,
      valor: String(e.valor).replace(".", ","),
      meses: e.meses_recebimento,
    })
  }

  async function commitEdit() {
    if (!editingId) return
    if (!editForm.clinica_id) { toast.error("Selecione uma clínica"); return }
    setSaving(true)
    const { data: { user } } = await sb().auth.getUser()
    const valor = parseDecimal(editForm.valor)
    const meses_recebimento = editForm.meses
    const { error } = await sb()
      .from("duda_entries")
      .update({
        date: editForm.date,
        clinica_id: editForm.clinica_id,
        valor,
        meses_recebimento,
        updated_by: user?.id,
      })
      .eq("id", editingId)
    if (error) toast.error("Erro ao salvar")
    else {
      setEntries((prev) =>
        prev
          .map((e) => (e.id === editingId
            ? { ...e, date: editForm.date, clinica_id: editForm.clinica_id, valor, meses_recebimento }
            : e))
          .filter((e) => isoMonthOf(e.date) === month)
          .sort((a, b) => a.date.localeCompare(b.date))
      )
      setEditingId(null)
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    const { error } = await sb().from("duda_entries").delete().eq("id", id)
    if (error) toast.error("Erro ao remover")
    else setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  function changeMonth(delta: number) {
    setMonth((m) => {
      const next = addMonths(m, delta)
      if (next < MIN_MONTH) return m
      return next
    })
    setEditingId(null)
    setAdding(false)
    setConfirmId(null)
  }

  const canGoBack = month > MIN_MONTH

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-semibold text-gray-900">Faturamento Duda</h1>
              <p className="text-xs text-gray-400">Renda variável diária</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setTendenciasOpen(true)}
                className="p-2 text-gray-400 hover:text-gray-700 transition-colors rounded-lg"
                title="Tendência mensal"
              >
                <TrendingUp size={20} />
              </button>
              <button
                onClick={() => setExportOpen(true)}
                disabled={entries.length === 0}
                className="p-2 text-gray-400 hover:text-gray-700 transition-colors rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                title="Exportar mensagem"
              >
                <Share2 size={20} />
              </button>
              <button
                onClick={() => setPlanoOpen(true)}
                className="p-2 text-gray-400 hover:text-gray-700 transition-colors rounded-lg"
                title="Plano do mês"
              >
                <CalendarDays size={20} />
              </button>
              <button
                onClick={() => setAgendaOpen(true)}
                className="p-2 text-gray-400 hover:text-gray-700 transition-colors rounded-lg"
                title="Agenda semanal"
              >
                <CalendarClock size={20} />
              </button>
              <button
                onClick={() => setClinicasOpen(true)}
                className="p-2 text-gray-400 hover:text-gray-700 transition-colors rounded-lg"
                title="Configurar clínicas"
              >
                <Settings size={20} />
              </button>
              <button
                onClick={() => setInfoOpen(true)}
                className="p-2 text-gray-400 hover:text-gray-700 transition-colors rounded-lg"
                title="Como funciona"
              >
                <Info size={20} />
              </button>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <button
              onClick={() => changeMonth(-1)}
              disabled={!canGoBack}
              className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
              title={canGoBack ? "Mês anterior" : "Não há histórico antes de 2026"}
            >
              <ChevronLeft size={20} />
            </button>
            <p className="text-sm font-semibold text-gray-700 capitalize">
              {formatMonthLong(month)}
            </p>
            <button
              onClick={() => changeMonth(1)}
              className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg"
              title="Próximo mês"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-4 pb-32 space-y-4">
        {/* Cards by clinic */}
        {statsByClinica.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {statsByClinica.map((st) => {
              const entriesClinica = entries.filter((e) => e.clinica_id === st.clinica.id)
              const hasSplit = entriesClinica.some((e) => e.meses_recebimento > 0)
              const recebimentoByMes = new Map<string, number>()
              if (hasSplit) {
                for (const e of entriesClinica) {
                  const mes = mesRecebimentoOf(e)
                  recebimentoByMes.set(mes, (recebimentoByMes.get(mes) ?? 0) + Number(e.valor))
                }
              }
              const recebimentoList = Array.from(recebimentoByMes.entries())
                .sort(([a], [b]) => a.localeCompare(b))

              const m2InClinica = entriesM2In.filter((e) => e.clinica_id === st.clinica.id)
              const m2InTotal = m2InClinica.reduce((s, e) => s + Number(e.valor), 0)
              const hasM2In = m2InClinica.length > 0
              const showRecebimento = hasSplit || hasM2In

              const showCaixa = st.hasAgenda && !isPastMonth

              return (
              <div
                key={st.clinica.id}
                className="bg-white rounded-xl border border-gray-100 px-3 py-3"
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ backgroundColor: st.clinica.cor }}
                  />
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide truncate">
                    {st.clinica.sigla || st.clinica.nome}
                  </p>
                </div>

                <p className="text-[9px] text-gray-400 uppercase tracking-wider font-medium">
                  Faturamento
                </p>
                <p className="text-base font-bold text-gray-900 tabular-nums">
                  {formatBRL(st.total)}
                </p>
                <p className="text-[10px] text-gray-400">
                  {st.count} {st.count === 1 ? "dia" : "dias"}
                  {st.hasAgenda
                    ? ` · agenda ${st.agendaDays}`
                    : <span className="italic"> · sob demanda</span>}
                </p>
                {st.count > 0 && (
                  <div className="flex items-baseline justify-between">
                    <span className="text-[10px] text-gray-500">Média/dia</span>
                    <span className="text-xs font-medium text-gray-700 tabular-nums">
                      {formatBRL(st.avg)}
                    </span>
                  </div>
                )}

                {showCaixa && (
                  <div className="mt-2 pt-2 border-t border-gray-100 space-y-0.5">
                    <p className="text-[9px] text-gray-400 uppercase tracking-wider font-medium">
                      Projeção de caixa <span className="text-gray-300 normal-case tracking-normal">· sem M+2</span>
                    </p>
                    {st.projetavel ? (
                      <div className="flex items-baseline justify-between">
                        <span className="text-[10px] text-gray-500">Fim de mês</span>
                        <span className="text-xs font-semibold tabular-nums" style={{ color: st.clinica.cor }}>
                          {formatBRL(st.projetado)}
                        </span>
                      </div>
                    ) : (
                      <p className="text-[10px] italic text-gray-400 leading-tight">
                        Amostra pequena pra projetar
                      </p>
                    )}
                    {st.avgProj > 0 && (
                      <div className="flex items-baseline justify-between">
                        <span className="text-[10px] text-gray-500">Média/dia</span>
                        <span className="text-xs font-medium text-gray-700 tabular-nums">
                          {formatBRL(st.avgProj)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {showRecebimento && (
                  <div className="mt-2 pt-2 border-t border-gray-100 space-y-0.5">
                    <p className="text-[9px] text-gray-400 uppercase tracking-wider font-medium">
                      Recebimento
                    </p>
                    {hasM2In && (
                      <div className="flex justify-between items-baseline">
                        <span className="text-[10px] text-gray-500 tabular-nums">
                          ← {formatMonthShort(m2OriginMonth)}
                        </span>
                        <span className="text-xs font-medium text-gray-700 tabular-nums">
                          {formatBRL(m2InTotal)}
                        </span>
                      </div>
                    )}
                    {recebimentoList.map(([mes, valor]) => (
                      <div key={mes} className="flex justify-between items-baseline">
                        <span className="text-[10px] text-gray-500 tabular-nums">
                          {formatMonthShort(mes)}
                        </span>
                        <span className="text-xs font-medium text-gray-700 tabular-nums">
                          {formatBRL(valor)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              )
            })}
          </div>
        )}

        {/* Entries list */}
        <div className="bg-white rounded-xl border border-gray-100 px-3">
          {loading ? (
            <p className="text-sm text-gray-400 py-4 text-center">Carregando…</p>
          ) : entries.length === 0 && !adding ? (
            <p className="text-sm text-gray-300 py-4 text-center">Nenhuma entrada neste mês.</p>
          ) : (
            <div>
              {entries.map((e) => {
                const c = clinicaById(e.clinica_id)
                const isEditing = editingId === e.id
                if (isEditing) {
                  return (
                    <div key={e.id} className="my-2 rounded-lg p-3 bg-gray-50 space-y-3">
                      <EntryForm
                        form={editForm}
                        setForm={setEditForm}
                        clinicas={clinicas}
                      />
                      <div className="flex gap-2">
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
                          variant="outline"
                          size="sm"
                          className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => { handleDelete(e.id); setEditingId(null) }}
                          disabled={saving}
                        >
                          <Trash2 size={14} className="mr-1" /> Remover
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={commitEdit}
                          disabled={saving}
                        >
                          {saving ? "…" : "Salvar"}
                        </Button>
                      </div>
                    </div>
                  )
                }
                const { day, weekday } = formatDayMonth(e.date)
                return (
                  <button
                    key={e.id}
                    onClick={() => startEdit(e)}
                    className="w-full flex items-center gap-2 py-2 border-b border-gray-100 last:border-0 text-left hover:bg-gray-50 px-1 -mx-1 rounded transition-colors"
                  >
                    <span className="text-sm font-semibold text-gray-700 tabular-nums w-6">{day}</span>
                    <span className="text-xs text-gray-400 w-8">{weekday}</span>
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: c ? `${c.cor}1a` : "#e5e7eb",
                        color: c?.cor ?? "#6b7280",
                      }}
                    >
                      {c?.sigla || c?.nome || "?"}
                    </span>
                    {e.meses_recebimento >= 2 && (
                      <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                        → {formatMonthShort(mesRecebimentoOf(e))}
                      </span>
                    )}
                    <span className="flex-1" />
                    <span className="text-sm font-medium text-gray-900 tabular-nums">
                      {formatBRL(Number(e.valor))}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Total */}
          {(entries.length > 0 || entriesM2In.length > 0) && (() => {
            const someUnprojectable = statsByClinica.some(
              (st) => st.hasAgenda && !st.projetavel
            )
            // Mostra a projeção sempre que ela difere do total faturado —
            // seja por dias futuros estimados ou por entries M+2 que foram
            // excluídas do cálculo de caixa planejável.
            const showTotalProj =
              !isPastMonth &&
              agenda.length > 0 &&
              totalProjetado !== totalMonth &&
              !someUnprojectable
            return (
              <div className="border-t border-gray-200 mt-1 py-3 space-y-2">
                {entries.length > 0 && (
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">
                      Faturamento
                    </p>
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm text-gray-500">Total do mês</span>
                      <span className="text-base font-bold text-gray-900 tabular-nums">
                        {formatBRL(totalMonth)}
                      </span>
                    </div>
                  </div>
                )}
                {showTotalProj && (
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">
                      Projeção de caixa <span className="text-gray-300 normal-case tracking-normal">· sem M+2</span>
                    </p>
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm text-gray-500">Fim de mês</span>
                      <span className="text-sm font-semibold text-gray-700 tabular-nums">
                        {formatBRL(totalProjetado)}
                      </span>
                    </div>
                  </div>
                )}
                {(hasGlobalSplit || entriesM2In.length > 0) && (
                  <div className="pt-2 border-t border-gray-100 space-y-0.5">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">
                      Recebimento
                    </p>
                    {entriesM2In.length > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 tabular-nums">
                          ← {formatMonthShort(m2OriginMonth)}
                        </span>
                        <span className="text-xs font-medium text-gray-700 tabular-nums">
                          {formatBRL(totalM2In)}
                        </span>
                      </div>
                    )}
                    {recebimentoTotalList.map(([mes, valor]) => (
                      <div key={mes} className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 tabular-nums">
                          {formatMonthShort(mes)}
                        </span>
                        <span className="text-xs font-medium text-gray-700 tabular-nums">
                          {formatBRL(valor)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}
        </div>

        {/* Add entry */}
        {adding ? (
          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Data</Label>
              <Input
                type="date"
                value={addForm.date}
                onChange={(e) => setAddForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Clínica</Label>
              <ClinicaChips
                clinicas={clinicas}
                value={addForm.clinica_id}
                onChange={(id) => setAddForm((f) => ({ ...f, clinica_id: id }))}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Valores</Label>
              {addForm.rows.map((row, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-gray-200 p-2.5 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <Input
                      inputMode="decimal"
                      placeholder="0,00"
                      value={row.valor}
                      onChange={(e) =>
                        setAddForm((f) => ({
                          ...f,
                          rows: f.rows.map((r, i) =>
                            i === idx ? { ...r, valor: e.target.value } : r
                          ),
                        }))
                      }
                    />
                    {addForm.rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setAddForm((f) => ({
                            ...f,
                            rows: f.rows.filter((_, i) => i !== idx),
                          }))
                        }
                        className="shrink-0 p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                        title="Remover linha"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  <PrazoChips
                    value={row.meses}
                    onChange={(m) =>
                      setAddForm((f) => ({
                        ...f,
                        rows: f.rows.map((r, i) =>
                          i === idx ? { ...r, meses: m } : r
                        ),
                      }))
                    }
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setAddForm((f) => ({
                    ...f,
                    rows: [...f.rows, { valor: "", meses: 0 }],
                  }))
                }
                className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors py-2 rounded-lg border border-dashed border-gray-200"
              >
                <Plus size={14} /> Adicionar linha
              </button>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setAdding(false)}
                disabled={saving}
              >
                <X size={14} className="mr-1" /> Cancelar
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={handleAdd}
                disabled={saving || !addForm.clinica_id}
              >
                {saving ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => {
              const { start } = monthRange(month)
              const today = isoToday()
              const defaultDate = isoMonthOf(today) === month ? today : start
              setAddForm({
                date: defaultDate,
                clinica_id: "",
                rows: [{ valor: "", meses: 0 }],
              })
              setAdding(true)
            }}
            disabled={activeClinicas.length === 0}
            className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors py-3 bg-white rounded-xl border border-dashed border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={16} />
            {activeClinicas.length === 0 ? "Cadastre uma clínica primeiro" : "Adicionar entrada"}
          </button>
        )}
      </main>

      <ClinicasSheet
        open={clinicasOpen}
        onClose={() => setClinicasOpen(false)}
        onChange={fetchClinicas}
      />

      <AgendaSheet
        open={agendaOpen}
        onClose={() => setAgendaOpen(false)}
        clinicas={clinicas}
        onChange={fetchAgenda}
      />

      <PlanoMesSheet
        open={planoOpen}
        onClose={() => setPlanoOpen(false)}
        month={month}
        clinicas={clinicas}
        agenda={agenda}
        entries={entries}
        daysOff={daysOff}
        onDaysOffChange={fetchDaysOff}
      />

      <InfoSheet open={infoOpen} onClose={() => setInfoOpen(false)} />

      <TendenciasSheet
        open={tendenciasOpen}
        onClose={() => setTendenciasOpen(false)}
        clinicas={clinicas}
      />

      <ExportSheet
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        month={month}
        clinicas={clinicas}
        entries={entries}
      />

      <Toaster />
    </div>
  )
}

function ClinicaChips({
  clinicas,
  value,
  onChange,
}: {
  clinicas: DudaClinica[]
  value: string
  onChange: (id: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {clinicas
        .filter((c) => c.ativa || c.id === value)
        .map((c) => {
          const active = value === c.id
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onChange(c.id)}
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
  )
}

function PrazoChips({
  value,
  onChange,
}: {
  value: number
  onChange: (m: number) => void
}) {
  return (
    <div className="flex gap-1.5">
      {PRAZO_OPTIONS.map((m) => {
        const active = value === m
        return (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full border transition-colors",
              active
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-600 border-gray-200 hover:text-gray-800"
            )}
          >
            {PRAZO_LABELS[m]}
          </button>
        )
      })}
    </div>
  )
}

function EntryForm({
  form,
  setForm,
  clinicas,
}: {
  form: EditFormData
  setForm: (f: EditFormData | ((prev: EditFormData) => EditFormData)) => void
  clinicas: DudaClinica[]
}) {
  return (
    <>
      <div className="space-y-1">
        <Label className="text-xs">Data</Label>
        <Input
          type="date"
          value={form.date}
          onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Clínica</Label>
        <ClinicaChips
          clinicas={clinicas}
          value={form.clinica_id}
          onChange={(id) => setForm((f) => ({ ...f, clinica_id: id }))}
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
      <div className="space-y-1">
        <Label className="text-xs">Recebimento</Label>
        <PrazoChips
          value={form.meses}
          onChange={(m) => setForm((f) => ({ ...f, meses: m }))}
        />
      </div>
    </>
  )
}
