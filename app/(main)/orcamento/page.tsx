"use client"

import { useEffect, useState, useCallback, useRef, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import type { SupabaseClient } from "@supabase/supabase-js"
import { ChevronLeft, ChevronRight, Plus, Pencil, Eye, EyeOff, Target, BarChart3 } from "lucide-react"
import { Toaster } from "@/components/ui/sonner"
import { toast } from "sonner"
import { OrcamentoEditSheet, type OrcamentoSaveInput } from "@/components/orcamento-edit-sheet"
import { OrcamentoDashboardSheet } from "@/components/orcamento-dashboard-sheet"
import {
  cn,
  formatBRL,
  formatDateShort,
  isoToday,
} from "@/lib/utils"
import {
  barColor,
  computeStats,
  formatPeriodo,
  isGastoInOrcamento,
  statusOf,
  suggestNext,
} from "@/lib/orcamento"
import { RESPONSAVEL_LABELS } from "@/lib/users"
import type {
  CategoriaGasto,
  FormaPagamento,
  GastoVariavel,
  Orcamento,
} from "@/lib/types"

export default function OrcamentoPage() {
  const supabaseRef = useRef<SupabaseClient | null>(null)
  const sb = useCallback(() => {
    if (!supabaseRef.current) supabaseRef.current = createClient()
    return supabaseRef.current
  }, [])

  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([])
  const [gastos, setGastos] = useState<GastoVariavel[]>([])
  const [categorias, setCategorias] = useState<CategoriaGasto[]>([])
  const [formasPagamento, setFormasPagamento] = useState<FormaPagamento[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [editSheet, setEditSheet] = useState<{ open: boolean; orcamento: Orcamento | null }>({
    open: false, orcamento: null,
  })
  const [dashboardOpen, setDashboardOpen] = useState(false)

  // --- Fetch --------------------------------------------------------------
  const fetchAll = useCallback(async () => {
    const [orcamentosRes, gastosRes, categoriasRes, formasRes] = await Promise.all([
      sb().from("orcamentos").select("*").order("data_inicio", { ascending: false }),
      sb().from("gastos_variaveis").select("*").order("date", { ascending: false }),
      sb().from("categorias_gasto").select("*").order("position"),
      sb().from("formas_pagamento").select("*").order("position"),
    ])
    if (orcamentosRes.data) setOrcamentos(orcamentosRes.data as Orcamento[])
    if (gastosRes.data) setGastos(gastosRes.data as GastoVariavel[])
    if (categoriasRes.data) setCategorias(categoriasRes.data as CategoriaGasto[])
    if (formasRes.data) setFormasPagamento(formasRes.data as FormaPagamento[])
    setLoading(false)
  }, [sb])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Realtime
  useEffect(() => {
    const channel = sb()
      .channel("orcamento")
      .on("postgres_changes" as never, { event: "*", schema: "public", table: "orcamentos" }, () => fetchAll())
      .on("postgres_changes" as never, { event: "*", schema: "public", table: "gastos_variaveis" }, () => fetchAll())
      .on("postgres_changes" as never, { event: "*", schema: "public", table: "categorias_gasto" }, () => fetchAll())
      .on("postgres_changes" as never, { event: "*", schema: "public", table: "formas_pagamento" }, () => fetchAll())
      .subscribe()
    return () => { sb().removeChannel(channel) }
  }, [sb, fetchAll])

  // --- Seleção do orçamento exibido ----------------------------------------
  // Orçamentos vêm ordenados por data_inicio desc. Seleção inicial: o ativo
  // (que contém hoje), ou se não houver, o mais recente passado, ou o mais
  // recente em geral.
  const orcamentosSorted = useMemo(
    () => orcamentos.slice().sort((a, b) => a.data_inicio.localeCompare(b.data_inicio)),
    [orcamentos]
  )

  const today = isoToday()
  const defaultSelectedId = useMemo(() => {
    if (orcamentosSorted.length === 0) return null
    const ativo = orcamentosSorted.find((o) => statusOf(o, today) === "ativo")
    if (ativo) return ativo.id
    // sem ativo: pega o último (já que vamos sugerir criar o próximo)
    return orcamentosSorted[orcamentosSorted.length - 1].id
  }, [orcamentosSorted, today])

  // Quando os orçamentos chegarem ou mudarem, ajusta a seleção se ainda não tem
  // (ou se o selecionado sumiu).
  useEffect(() => {
    if (!defaultSelectedId) return
    if (selectedId && orcamentosSorted.some((o) => o.id === selectedId)) return
    setSelectedId(defaultSelectedId)
  }, [defaultSelectedId, selectedId, orcamentosSorted])

  const selectedIdx = selectedId
    ? orcamentosSorted.findIndex((o) => o.id === selectedId)
    : -1
  const selected = selectedIdx >= 0 ? orcamentosSorted[selectedIdx] : null
  const canPrev = selectedIdx > 0
  const canNext = selectedIdx >= 0 && selectedIdx < orcamentosSorted.length - 1

  // --- Derivações para o orçamento exibido --------------------------------
  const stats = useMemo(
    () => (selected ? computeStats(selected, gastos, today) : null),
    [selected, gastos, today]
  )

  const gastosDoPeriodo = useMemo(() => {
    if (!selected) return [] as GastoVariavel[]
    return gastos
      .filter((g) => g.date >= selected.data_inicio && g.date <= selected.data_fim)
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [selected, gastos])

  const categoriasMap = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias])
  const formasMap = useMemo(() => new Map(formasPagamento.map((f) => [f.id, f])), [formasPagamento])

  // --- Mutations ----------------------------------------------------------
  async function handleSaveOrcamento(input: OrcamentoSaveInput) {
    if (input.id) {
      const { error } = await sb()
        .from("orcamentos")
        .update({
          data_inicio: input.data_inicio,
          data_fim: input.data_fim,
          valor_teto: input.valor_teto,
        })
        .eq("id", input.id)
      if (error) { toast.error("Erro ao salvar orçamento"); return }
    } else {
      const { data, error } = await sb()
        .from("orcamentos")
        .insert({
          data_inicio: input.data_inicio,
          data_fim: input.data_fim,
          valor_teto: input.valor_teto,
        })
        .select()
        .single()
      if (error) { toast.error("Erro ao criar orçamento"); return }
      if (data) setSelectedId((data as Orcamento).id)
    }
    fetchAll()
  }

  async function handleDeleteOrcamento(id: string) {
    const { error } = await sb().from("orcamentos").delete().eq("id", id)
    if (error) { toast.error("Erro ao excluir orçamento"); return }
    setSelectedId(null)
    fetchAll()
  }

  async function toggleExcluirGasto(gasto: GastoVariavel) {
    const next = !gasto.excluido_orcamento
    // Otimista
    setGastos((prev) => prev.map((g) => g.id === gasto.id ? { ...g, excluido_orcamento: next } : g))
    const { error } = await sb()
      .from("gastos_variaveis")
      .update({ excluido_orcamento: next })
      .eq("id", gasto.id)
    if (error) {
      toast.error("Erro ao atualizar gasto")
      // Reverte
      setGastos((prev) => prev.map((g) => g.id === gasto.id ? { ...g, excluido_orcamento: !next } : g))
    }
  }

  function openCreateSheet() {
    setEditSheet({ open: true, orcamento: null })
  }

  function openEditSheet(o: Orcamento) {
    setEditSheet({ open: true, orcamento: o })
  }

  // Sugestões para o sheet de criação (continuação do último)
  const suggested = useMemo(() => suggestNext(orcamentosSorted), [orcamentosSorted])

  // --- Render --------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-semibold text-gray-900">Orçamento</h1>
              <p className="text-xs text-gray-400">Controle do teto por período</p>
            </div>
            <div className="flex items-center gap-1">
              {orcamentos.length > 0 && (
                <button
                  onClick={() => setDashboardOpen(true)}
                  className="p-2 text-gray-400 hover:text-gray-700 transition-colors rounded-lg"
                  title="Dashboard"
                >
                  <BarChart3 size={20} />
                </button>
              )}
              {selected && (
                <button
                  onClick={() => openEditSheet(selected)}
                  className="p-2 text-gray-400 hover:text-gray-700 transition-colors rounded-lg"
                  title="Editar orçamento"
                >
                  <Pencil size={18} />
                </button>
              )}
            </div>
          </div>

          {selected && (
            <div className="mt-2 flex items-center justify-between">
              <button
                onClick={() => setSelectedId(orcamentosSorted[selectedIdx - 1].id)}
                disabled={!canPrev}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                title="Orçamento anterior"
              >
                <ChevronLeft size={20} />
              </button>
              <p className="text-sm font-semibold text-gray-700 capitalize">
                {formatPeriodo(selected)}
                {stats?.status === "ativo" && (
                  <span className="ml-2 text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded uppercase tracking-wide">
                    ativo
                  </span>
                )}
                {stats?.status === "futuro" && (
                  <span className="ml-2 text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase tracking-wide">
                    futuro
                  </span>
                )}
                {stats?.status === "passado" && (
                  <span className="ml-2 text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded uppercase tracking-wide">
                    encerrado
                  </span>
                )}
              </p>
              <button
                onClick={() => setSelectedId(orcamentosSorted[selectedIdx + 1].id)}
                disabled={!canNext}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                title="Próximo orçamento"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-4 pb-32 space-y-4">
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-6">Carregando…</p>
        ) : !selected ? (
          <EmptyState onCreate={openCreateSheet} />
        ) : stats ? (
          <>
            <SummaryCard
              orcamento={selected}
              stats={stats}
            />

            {/* Lista de gastos */}
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-2 px-1">
                Gastos no período ({gastosDoPeriodo.length})
              </p>
              {gastosDoPeriodo.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
                  <p className="text-sm text-gray-300">Nenhum gasto registrado ainda.</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  {gastosDoPeriodo.map((g) => (
                    <GastoOrcamentoRow
                      key={g.id}
                      gasto={g}
                      categoria={categoriasMap.get(g.categoria_id) ?? null}
                      forma={formasMap.get(g.forma_pagamento_id) ?? null}
                      countsForBudget={isGastoInOrcamento(g, selected)}
                      onToggle={() => toggleExcluirGasto(g)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Próximo orçamento */}
            {stats.status === "passado" && (
              <button
                onClick={openCreateSheet}
                className="w-full flex items-center justify-center gap-1.5 text-sm text-blue-600 hover:bg-blue-50 transition-colors py-3 bg-white rounded-xl border border-blue-200"
              >
                <Plus size={16} /> Criar próximo orçamento
              </button>
            )}
            {stats.status !== "passado" && (
              <button
                onClick={openCreateSheet}
                className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors py-3 bg-white rounded-xl border border-dashed border-gray-200"
              >
                <Plus size={16} /> Novo orçamento
              </button>
            )}
          </>
        ) : null}
      </main>

      {editSheet.open && (
        <OrcamentoEditSheet
          key={editSheet.orcamento?.id ?? "new"}
          orcamento={editSheet.orcamento}
          defaultInicio={suggested.data_inicio}
          defaultFim={suggested.data_fim}
          defaultTeto={suggested.valor_teto}
          onClose={() => setEditSheet({ open: false, orcamento: null })}
          onSave={handleSaveOrcamento}
          onDelete={handleDeleteOrcamento}
        />
      )}

      <OrcamentoDashboardSheet
        open={dashboardOpen}
        onClose={() => setDashboardOpen(false)}
        orcamentos={orcamentos}
        gastos={gastos}
      />

      <Toaster />
    </div>
  )
}

// --- Sub-componentes -----------------------------------------------------

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-8 text-center space-y-4">
      <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto text-blue-600">
        <Target size={28} />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-800">Crie seu primeiro orçamento</p>
        <p className="text-xs text-gray-400 mt-1">
          Define um período (semana, quinzena…) e um teto.
          Gastos no intervalo vão consumir o limite.
        </p>
      </div>
      <button
        onClick={onCreate}
        className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors px-4 py-2 rounded-lg"
      >
        <Plus size={16} /> Criar orçamento
      </button>
    </div>
  )
}

interface SummaryCardProps {
  orcamento: Orcamento
  stats: ReturnType<typeof computeStats>
}

function SummaryCard({ orcamento, stats }: SummaryCardProps) {
  const color = barColor(stats.pctConsumido)
  const pctClamped = Math.min(1, Math.max(0, stats.pctConsumido))
  const estourou = stats.pctConsumido > 1

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Gastou</p>
          <p
            className={cn("text-lg font-semibold tabular-nums", estourou ? "text-red-600" : "text-gray-900")}
          >
            {formatBRL(stats.gasto)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Teto</p>
          <p className="text-lg font-semibold text-gray-900 tabular-nums">
            {formatBRL(Number(orcamento.valor_teto))}
          </p>
        </div>
      </div>

      {/* Barra de progresso */}
      <div className="space-y-1">
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pctClamped * 100}%`, backgroundColor: color }}
          />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">
            {Math.round(stats.pctConsumido * 100)}% consumido
          </span>
          <span className={cn("tabular-nums font-medium", estourou ? "text-red-600" : "text-gray-700")}>
            {estourou ? "Estourou em " : "Restam "}
            {formatBRL(Math.abs(stats.restante))}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 pt-2 border-t border-gray-100 text-xs">
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Dias</p>
          <p className="text-sm font-semibold text-gray-800 tabular-nums">
            {stats.diasDecorridos}/{stats.diasTotal}
          </p>
          {stats.status === "ativo" && (
            <p className="text-[10px] text-gray-400">{stats.diasRestantes} restantes</p>
          )}
        </div>
        {stats.status === "ativo" && stats.diasRestantes > 0 ? (
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Pode gastar</p>
            <p className={cn(
              "text-sm font-semibold tabular-nums",
              stats.mediaDiariaRecomendada < 0 ? "text-red-600" : "text-gray-800"
            )}>
              {formatBRL(Math.max(0, stats.mediaDiariaRecomendada))}
            </p>
            <p className="text-[10px] text-gray-400">por dia até o fim</p>
          </div>
        ) : (
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Média atual</p>
            <p className="text-sm font-semibold text-gray-800 tabular-nums">
              {formatBRL(stats.mediaDiariaAtual)}
            </p>
            <p className="text-[10px] text-gray-400">por dia</p>
          </div>
        )}
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Projeção</p>
          <p className={cn(
            "text-sm font-semibold tabular-nums",
            stats.deltaProjecao > 0 ? "text-red-600" : "text-emerald-600"
          )}>
            {formatBRL(stats.projecaoTotal)}
          </p>
          {stats.status === "ativo" && stats.diasDecorridos > 0 && (
            <p className="text-[10px] text-gray-400">
              {stats.deltaProjecao > 0
                ? `+${formatBRL(stats.deltaProjecao).replace("R$ ", "R$ ")} acima`
                : `${formatBRL(Math.abs(stats.deltaProjecao)).replace("R$ ", "R$ ")} abaixo`}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

interface GastoOrcamentoRowProps {
  gasto: GastoVariavel
  categoria: CategoriaGasto | null
  forma: FormaPagamento | null
  countsForBudget: boolean
  onToggle: () => void
}

function GastoOrcamentoRow({ gasto, categoria, forma, countsForBudget, onToggle }: GastoOrcamentoRowProps) {
  return (
    <div className={cn(
      "flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 last:border-0",
      !countsForBudget && "bg-gray-50/50"
    )}>
      <div className="shrink-0 w-10 text-center">
        <p className="text-base font-semibold text-gray-700 tabular-nums leading-tight">
          {formatDateShort(gasto.date).split("/")[0]}
        </p>
        <p className="text-[10px] text-gray-400 uppercase">
          {formatDateShort(gasto.date).split("/")[1]}
        </p>
      </div>
      <div className={cn("flex-1 min-w-0", !countsForBudget && "opacity-50")}>
        <div className="flex items-center gap-1.5 flex-wrap">
          {categoria && (
            <span
              className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded"
              style={{ backgroundColor: `${categoria.cor}22`, color: categoria.cor }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: categoria.cor }} />
              {categoria.nome}
            </span>
          )}
          {forma && (
            <span
              className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded"
              style={{ backgroundColor: `${forma.cor}22`, color: forma.cor }}
            >
              {forma.nome}
            </span>
          )}
          <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
            {RESPONSAVEL_LABELS[gasto.responsavel]}
          </span>
        </div>
        {gasto.descricao && (
          <p className={cn(
            "text-sm text-gray-600 truncate mt-0.5",
            !countsForBudget && "line-through"
          )}>
            {gasto.descricao}
          </p>
        )}
      </div>
      <p className={cn(
        "shrink-0 text-sm font-semibold tabular-nums",
        countsForBudget ? "text-gray-900" : "text-gray-400 line-through"
      )}>
        {formatBRL(Number(gasto.valor))}
      </p>
      <button
        onClick={onToggle}
        className={cn(
          "shrink-0 p-1.5 rounded transition-colors",
          countsForBudget
            ? "text-gray-300 hover:text-gray-700"
            : "text-amber-500 hover:text-amber-700 bg-amber-50"
        )}
        title={countsForBudget ? "Desconsiderar do orçamento" : "Voltar a contar"}
      >
        {countsForBudget ? <Eye size={15} /> : <EyeOff size={15} />}
      </button>
    </div>
  )
}
