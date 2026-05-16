"use client"

import { useEffect, useState, useCallback, useRef, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import type { SupabaseClient } from "@supabase/supabase-js"
import { Archive, Plus } from "lucide-react"
import { Toaster } from "@/components/ui/sonner"
import { toast } from "sonner"
import { ContaFixaSheet } from "@/components/conta-fixa-sheet"
import { ContasArquivadasSheet } from "@/components/contas-arquivadas-sheet"
import { ContasFixasTable } from "@/components/contas-fixas-table"
import { ContasFixasChart } from "@/components/contas-fixas-chart"
import { ContasFixasStatusCard } from "@/components/contas-fixas-status-card"
import { addMonths, isoMonthToday } from "@/lib/utils"
import {
  isoToMes,
  mesToISO,
  monthsBetween,
  resolveCell,
} from "@/lib/contas-fixas"
import type {
  ContaFixa,
  ContaFixaVigencia,
  ContaFixaCelula,
} from "@/lib/types"

const MIN_MONTH = "2026-05"
const LS_KEY_START = "planfin.contas-fixas.mesInicio"
const LS_KEY_END = "planfin.contas-fixas.mesFim"

export default function ContasFixasPage() {
  const supabaseRef = useRef<SupabaseClient | null>(null)
  const sb = useCallback(() => {
    if (!supabaseRef.current) supabaseRef.current = createClient()
    return supabaseRef.current
  }, [])

  const today = isoMonthToday()
  const startDefault = today < MIN_MONTH ? MIN_MONTH : today
  const [mesInicio, setMesInicio] = useState<string>(startDefault)
  const [mesFim, setMesFim] = useState<string>(addMonths(startDefault, 11))
  const hydratedRef = useRef(false)

  // Lê os valores salvos no localStorage uma vez na montagem.
  useEffect(() => {
    const savedStart = localStorage.getItem(LS_KEY_START)
    if (savedStart && savedStart >= MIN_MONTH) setMesInicio(savedStart)
    const savedEnd = localStorage.getItem(LS_KEY_END)
    if (savedEnd && savedEnd >= MIN_MONTH) setMesFim(savedEnd)
    hydratedRef.current = true
  }, [])

  // Persiste mudanças (depois de hidratar, pra não sobrescrever com o default).
  useEffect(() => {
    if (!hydratedRef.current) return
    localStorage.setItem(LS_KEY_START, mesInicio)
  }, [mesInicio])

  useEffect(() => {
    if (!hydratedRef.current) return
    localStorage.setItem(LS_KEY_END, mesFim)
  }, [mesFim])

  const [contas, setContas] = useState<ContaFixa[]>([])
  const [vigencias, setVigencias] = useState<ContaFixaVigencia[]>([])
  const [celulas, setCelulas] = useState<ContaFixaCelula[]>([])
  const [loading, setLoading] = useState(true)

  const [contaSheetTargetId, setContaSheetTargetId] = useState<string | null | undefined>(undefined)
  const [arquivadasOpen, setArquivadasOpen] = useState(false)

  const months = useMemo(
    () => monthsBetween(mesInicio, mesFim),
    [mesInicio, mesFim]
  )

  const fetchAll = useCallback(async () => {
    const [contasRes, vigenciasRes, celulasRes] = await Promise.all([
      sb()
        .from("contas_fixas")
        .select("*")
        .is("archived_at", null)
        .order("position"),
      sb().from("contas_fixas_vigencias").select("*"),
      sb().from("contas_fixas_celulas").select("*"),
    ])
    if (contasRes.data) setContas(contasRes.data as ContaFixa[])
    if (vigenciasRes.data) setVigencias(vigenciasRes.data as ContaFixaVigencia[])
    if (celulasRes.data) setCelulas(celulasRes.data as ContaFixaCelula[])
    setLoading(false)
  }, [sb])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Soma da janela visível por mês (para chart e total)
  const totalPorMes = useMemo(() => {
    const map = new Map<string, number>()
    for (const m of months) {
      let total = 0
      for (const c of contas) {
        const r = resolveCell(c.id, m, vigencias, celulas)
        if (r.value !== null) total += r.value
      }
      map.set(m, total)
    }
    return map
  }, [months, contas, vigencias, celulas])

  // Status do mês corrente (independente da janela)
  const currentMonth = isoMonthToday()
  const currentStatus = useMemo(() => {
    let total = 0
    let pago = 0
    for (const c of contas) {
      const r = resolveCell(c.id, currentMonth, vigencias, celulas)
      if (r.value === null) continue
      total += r.value
      if (r.pago) pago += r.value
    }
    return { total, pago }
  }, [currentMonth, contas, vigencias, celulas])

  // --- Mutations -----------------------------------------------------------

  async function saveOverride(contaId: string, mes: string, valor: number | null) {
    const mesISO = mesToISO(mes)
    const existing = celulas.find(
      (c) => c.conta_id === contaId && isoToMes(c.mes) === mes
    )

    // Otimista
    if (existing) {
      const next: ContaFixaCelula = { ...existing, valor_override: valor }
      setCelulas((prev) => prev.map((c) => (c.id === existing.id ? next : c)))
      const { error } = await sb()
        .from("contas_fixas_celulas")
        .update({ valor_override: valor })
        .eq("id", existing.id)
      if (error) {
        toast.error("Erro ao salvar valor")
        setCelulas((prev) => prev.map((c) => (c.id === existing.id ? existing : c)))
      }
    } else {
      const { data, error } = await sb()
        .from("contas_fixas_celulas")
        .insert({
          conta_id: contaId,
          mes: mesISO,
          valor_override: valor,
          pago: false,
        })
        .select()
        .single()
      if (error) toast.error("Erro ao salvar valor")
      else if (data) setCelulas((prev) => [...prev, data as ContaFixaCelula])
    }
  }

  async function togglePago(contaId: string, mes: string) {
    const mesISO = mesToISO(mes)
    const existing = celulas.find(
      (c) => c.conta_id === contaId && isoToMes(c.mes) === mes
    )

    if (existing) {
      const next = { ...existing, pago: !existing.pago }
      setCelulas((prev) => prev.map((c) => (c.id === existing.id ? next : c)))
      const { error } = await sb()
        .from("contas_fixas_celulas")
        .update({ pago: next.pago })
        .eq("id", existing.id)
      if (error) {
        toast.error("Erro ao atualizar pago")
        setCelulas((prev) => prev.map((c) => (c.id === existing.id ? existing : c)))
      }
    } else {
      const { data, error } = await sb()
        .from("contas_fixas_celulas")
        .insert({
          conta_id: contaId,
          mes: mesISO,
          valor_override: null,
          pago: true,
        })
        .select()
        .single()
      if (error) toast.error("Erro ao atualizar pago")
      else if (data) setCelulas((prev) => [...prev, data as ContaFixaCelula])
    }
  }

  async function reorderContas(reordered: ContaFixa[]) {
    setContas(reordered.map((c, i) => ({ ...c, position: i })))
    await Promise.all(
      reordered.map((c, i) =>
        sb().from("contas_fixas").update({ position: i }).eq("id", c.id)
      )
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-semibold text-gray-900">Contas Fixas</h1>
              <p className="text-xs text-gray-400">Despesas recorrentes</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setArquivadasOpen(true)}
                className="p-2 text-gray-400 hover:text-gray-700 transition-colors rounded-lg"
                title="Contas arquivadas"
              >
                <Archive size={20} />
              </button>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-center gap-2 text-xs text-gray-600">
            <label className="flex items-center gap-1">
              <span className="text-gray-400">De</span>
              <input
                type="month"
                value={mesInicio}
                min={MIN_MONTH}
                max={mesFim}
                onChange={(e) => setMesInicio(e.target.value)}
                className="text-xs border border-gray-200 rounded px-1.5 py-0.5 tabular-nums"
              />
            </label>
            <label className="flex items-center gap-1">
              <span className="text-gray-400">até</span>
              <input
                type="month"
                value={mesFim}
                min={mesInicio < MIN_MONTH ? MIN_MONTH : mesInicio}
                onChange={(e) => setMesFim(e.target.value)}
                className="text-xs border border-gray-200 rounded px-1.5 py-0.5 tabular-nums"
              />
            </label>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-4 pb-32 space-y-4">
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-6">Carregando…</p>
        ) : (
          <>
            <ContasFixasChart months={months} totalPorMes={totalPorMes} />

            <ContasFixasStatusCard
              mes={currentMonth}
              total={currentStatus.total}
              pago={currentStatus.pago}
            />

            <ContasFixasTable
              contas={contas}
              months={months}
              vigencias={vigencias}
              celulas={celulas}
              totalPorMes={totalPorMes}
              onContaClick={(id) => setContaSheetTargetId(id)}
              onCellSave={saveOverride}
              onPagoToggle={togglePago}
              onReorder={reorderContas}
            />

            <button
              onClick={() => setContaSheetTargetId(null)}
              className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors py-3 bg-white rounded-xl border border-dashed border-gray-200"
            >
              <Plus size={16} /> Nova conta
            </button>
          </>
        )}
      </main>

      <ContaFixaSheet
        open={contaSheetTargetId !== undefined}
        contaId={contaSheetTargetId ?? null}
        contas={contas}
        vigencias={vigencias}
        onClose={() => setContaSheetTargetId(undefined)}
        onChange={fetchAll}
      />

      <ContasArquivadasSheet
        open={arquivadasOpen}
        onClose={() => setArquivadasOpen(false)}
        onChange={fetchAll}
      />

      <Toaster />
    </div>
  )
}
