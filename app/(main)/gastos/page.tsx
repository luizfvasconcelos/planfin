"use client"

import { useEffect, useState, useCallback, useRef, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import type { SupabaseClient } from "@supabase/supabase-js"
import { Plus, Filter, FolderCog, CreditCard, X, ChevronLeft, ChevronRight, BarChart3 } from "lucide-react"
import { Toaster } from "@/components/ui/sonner"
import { toast } from "sonner"
import { CatalogSheet } from "@/components/catalog-sheet"
import { GastoEditSheet, type GastoSaveInput } from "@/components/gasto-edit-sheet"
import { GastosDashboardSheet } from "@/components/gastos-dashboard-sheet"
import {
  addMonths,
  formatBRL,
  formatDateShort,
  formatMonthLong,
  getDayOfWeek,
  isoMonthToday,
  monthRange,
} from "@/lib/utils"
import { cn } from "@/lib/utils"
import { emailToResponsavel, RESPONSAVEL_LABELS } from "@/lib/users"
import type {
  CategoriaGasto,
  FormaPagamento,
  GastoVariavel,
  ResponsavelGasto,
} from "@/lib/types"

const MIN_MONTH = "2026-05"
const LS_KEY_MES = "planfin.gastos.mes"

type ViewMode = "cronologica" | "categoria"
const RESPONSAVEIS: ResponsavelGasto[] = ["luiz", "duda", "casal"]

export default function GastosPage() {
  const supabaseRef = useRef<SupabaseClient | null>(null)
  const sb = useCallback(() => {
    if (!supabaseRef.current) supabaseRef.current = createClient()
    return supabaseRef.current
  }, [])

  // --- Mês selecionado (persistido em localStorage) -----------------------
  // Lazy init lê do localStorage no client; no server (SSR) cai no default.
  const [mes, setMes] = useState<string>(() => {
    const today = isoMonthToday()
    const fallback = today < MIN_MONTH ? MIN_MONTH : today
    if (typeof window === "undefined") return fallback
    const saved = window.localStorage.getItem(LS_KEY_MES)
    return saved && saved >= MIN_MONTH ? saved : fallback
  })

  useEffect(() => {
    localStorage.setItem(LS_KEY_MES, mes)
  }, [mes])

  function changeMonth(delta: number) {
    setMes((m) => {
      const next = addMonths(m, delta)
      if (next < MIN_MONTH) return m
      return next
    })
  }

  const canGoBack = mes > MIN_MONTH

  // --- Estado dos dados ---------------------------------------------------
  const [gastos, setGastos] = useState<GastoVariavel[]>([])
  const [categorias, setCategorias] = useState<CategoriaGasto[]>([])
  const [formasPagamento, setFormasPagamento] = useState<FormaPagamento[]>([])
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // --- UI state -----------------------------------------------------------
  const [gastoSheet, setGastoSheet] = useState<{ open: boolean; gasto: GastoVariavel | null }>({
    open: false, gasto: null,
  })
  const [categoriasSheetOpen, setCategoriasSheetOpen] = useState(false)
  const [formasSheetOpen, setFormasSheetOpen] = useState(false)
  const [dashboardOpen, setDashboardOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>("cronologica")
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filterCategoriaIds, setFilterCategoriaIds] = useState<Set<string>>(new Set())
  const [filterResponsaveis, setFilterResponsaveis] = useState<Set<ResponsavelGasto>>(new Set())
  const [filterFormaIds, setFilterFormaIds] = useState<Set<string>>(new Set())

  // --- Fetch --------------------------------------------------------------
  const fetchAll = useCallback(async () => {
    const { start, end } = monthRange(mes)
    const [gastosRes, categoriasRes, formasRes, userRes] = await Promise.all([
      sb()
        .from("gastos_variaveis")
        .select("*")
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false }),
      sb().from("categorias_gasto").select("*").eq("ativa", true).order("position"),
      sb().from("formas_pagamento").select("*").eq("ativa", true).order("position"),
      sb().auth.getUser(),
    ])
    if (gastosRes.data) setGastos(gastosRes.data as GastoVariavel[])
    if (categoriasRes.data) setCategorias(categoriasRes.data as CategoriaGasto[])
    if (formasRes.data) setFormasPagamento(formasRes.data as FormaPagamento[])
    if (userRes.data?.user?.email) setUserEmail(userRes.data.user.email)
    setLoading(false)
  }, [sb, mes])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Realtime: re-fetch quando qualquer das 3 tabelas mudar.
  useEffect(() => {
    const channel = sb()
      .channel("gastos-variaveis")
      .on("postgres_changes" as never, { event: "*", schema: "public", table: "gastos_variaveis" }, () => fetchAll())
      .on("postgres_changes" as never, { event: "*", schema: "public", table: "categorias_gasto" }, () => fetchAll())
      .on("postgres_changes" as never, { event: "*", schema: "public", table: "formas_pagamento" }, () => fetchAll())
      .subscribe()
    return () => { sb().removeChannel(channel) }
  }, [sb, fetchAll])

  // --- Derivações ---------------------------------------------------------
  const categoriasMap = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias])
  const formasMap = useMemo(() => new Map(formasPagamento.map((f) => [f.id, f])), [formasPagamento])

  const gastosFiltered = useMemo(() => {
    return gastos.filter((g) => {
      if (filterCategoriaIds.size > 0 && !filterCategoriaIds.has(g.categoria_id)) return false
      if (filterResponsaveis.size > 0 && !filterResponsaveis.has(g.responsavel)) return false
      if (filterFormaIds.size > 0 && !filterFormaIds.has(g.forma_pagamento_id)) return false
      return true
    })
  }, [gastos, filterCategoriaIds, filterResponsaveis, filterFormaIds])

  const totalFiltrado = useMemo(
    () => gastosFiltered.reduce((s, g) => s + Number(g.valor), 0),
    [gastosFiltered]
  )
  const totalMes = useMemo(
    () => gastos.reduce((s, g) => s + Number(g.valor), 0),
    [gastos]
  )

  const filtrosAtivos =
    filterCategoriaIds.size + filterResponsaveis.size + filterFormaIds.size

  const gastosPorCategoria = useMemo(() => {
    const grouped = new Map<string, { categoria: CategoriaGasto | null; gastos: GastoVariavel[]; total: number }>()
    for (const g of gastosFiltered) {
      const key = g.categoria_id
      if (!grouped.has(key)) {
        grouped.set(key, { categoria: categoriasMap.get(g.categoria_id) ?? null, gastos: [], total: 0 })
      }
      const entry = grouped.get(key)!
      entry.gastos.push(g)
      entry.total += Number(g.valor)
    }
    return Array.from(grouped.values()).sort((a, b) => b.total - a.total)
  }, [gastosFiltered, categoriasMap])

  const defaultResponsavel = emailToResponsavel(userEmail)

  // --- Mutations ----------------------------------------------------------
  async function handleSaveGasto(input: GastoSaveInput) {
    if (input.id) {
      const { error } = await sb()
        .from("gastos_variaveis")
        .update({
          date: input.date,
          valor: input.valor,
          categoria_id: input.categoria_id,
          forma_pagamento_id: input.forma_pagamento_id,
          responsavel: input.responsavel,
          descricao: input.descricao,
          excluido_orcamento: input.excluido_orcamento,
        })
        .eq("id", input.id)
      if (error) { toast.error("Erro ao salvar gasto"); return }
    } else {
      const userId = (await sb().auth.getUser()).data.user?.id ?? null
      const { error } = await sb().from("gastos_variaveis").insert({
        date: input.date,
        valor: input.valor,
        categoria_id: input.categoria_id,
        forma_pagamento_id: input.forma_pagamento_id,
        responsavel: input.responsavel,
        descricao: input.descricao,
        excluido_orcamento: input.excluido_orcamento,
        updated_by: userId,
      })
      if (error) { toast.error("Erro ao adicionar gasto"); return }
    }
    fetchAll()
  }

  async function handleDeleteGasto(id: string) {
    const { error } = await sb().from("gastos_variaveis").delete().eq("id", id)
    if (error) { toast.error("Erro ao excluir gasto"); return }
    fetchAll()
  }

  // --- Filter helpers -----------------------------------------------------
  function toggleSet<T>(set: Set<T>, value: T): Set<T> {
    const next = new Set(set)
    if (next.has(value)) next.delete(value); else next.add(value)
    return next
  }

  function clearFilters() {
    setFilterCategoriaIds(new Set())
    setFilterResponsaveis(new Set())
    setFilterFormaIds(new Set())
  }

  // --- Render --------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-semibold text-gray-900">Gastos Variáveis</h1>
              <p className="text-xs text-gray-400">Registro do dia-a-dia</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setDashboardOpen(true)}
                className="p-2 text-gray-400 hover:text-gray-700 transition-colors rounded-lg"
                title="Dashboard"
              >
                <BarChart3 size={20} />
              </button>
              <button
                onClick={() => setCategoriasSheetOpen(true)}
                className="p-2 text-gray-400 hover:text-gray-700 transition-colors rounded-lg"
                title="Categorias"
              >
                <FolderCog size={20} />
              </button>
              <button
                onClick={() => setFormasSheetOpen(true)}
                className="p-2 text-gray-400 hover:text-gray-700 transition-colors rounded-lg"
                title="Formas de pagamento"
              >
                <CreditCard size={20} />
              </button>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <button
              onClick={() => changeMonth(-1)}
              disabled={!canGoBack}
              className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
              title={canGoBack ? "Mês anterior" : "Não há histórico antes de mai/26"}
            >
              <ChevronLeft size={20} />
            </button>
            <p className="text-sm font-semibold text-gray-700 capitalize">
              {formatMonthLong(mes)}
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
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-6">Carregando…</p>
        ) : (
          <>
            {/* Total do mês */}
            <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
              <div className="flex items-baseline justify-between">
                <p className="text-xs text-gray-400 uppercase tracking-wide">
                  Total {filtrosAtivos > 0 ? "filtrado" : "do mês"}
                </p>
                <p className="text-xl font-semibold text-gray-900 tabular-nums">
                  {formatBRL(totalFiltrado)}
                </p>
              </div>
              {filtrosAtivos > 0 && totalFiltrado !== totalMes && (
                <p className="text-[11px] text-gray-400 mt-1 text-right tabular-nums">
                  Mês completo: {formatBRL(totalMes)}
                </p>
              )}
            </div>

            {/* Controles: view toggle + filtros */}
            <div className="flex items-center gap-2">
              <div className="flex-1 inline-flex rounded-lg border border-gray-200 bg-white p-0.5 text-xs">
                <button
                  onClick={() => setViewMode("cronologica")}
                  className={cn(
                    "flex-1 py-1.5 rounded-md transition-colors",
                    viewMode === "cronologica" ? "bg-gray-900 text-white" : "text-gray-500"
                  )}
                >
                  Cronológica
                </button>
                <button
                  onClick={() => setViewMode("categoria")}
                  className={cn(
                    "flex-1 py-1.5 rounded-md transition-colors",
                    viewMode === "categoria" ? "bg-gray-900 text-white" : "text-gray-500"
                  )}
                >
                  Por categoria
                </button>
              </div>
              <button
                onClick={() => setFiltersOpen((v) => !v)}
                className={cn(
                  "shrink-0 inline-flex items-center gap-1 text-xs px-3 py-2 rounded-lg border transition-colors",
                  filtrosAtivos > 0
                    ? "bg-blue-50 border-blue-200 text-blue-700"
                    : "bg-white border-gray-200 text-gray-500 hover:text-gray-800"
                )}
              >
                <Filter size={14} />
                Filtros
                {filtrosAtivos > 0 && (
                  <span className="ml-0.5 bg-blue-600 text-white rounded-full px-1.5 py-0 text-[10px] font-medium">
                    {filtrosAtivos}
                  </span>
                )}
              </button>
            </div>

            {filtersOpen && (
              <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
                <div className="space-y-1.5">
                  <p className="text-[11px] text-gray-400 uppercase tracking-wide font-medium">Categoria</p>
                  <div className="flex flex-wrap gap-1.5">
                    {categorias.map((c) => {
                      const active = filterCategoriaIds.has(c.id)
                      return (
                        <button
                          key={c.id}
                          onClick={() => setFilterCategoriaIds((s) => toggleSet(s, c.id))}
                          className={cn(
                            "inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors",
                            active
                              ? "bg-gray-900 text-white border-gray-900"
                              : "bg-white text-gray-600 border-gray-200"
                          )}
                        >
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: c.cor }}
                          />
                          {c.nome}
                        </button>
                      )
                    })}
                    {categorias.length === 0 && (
                      <p className="text-xs text-gray-300">Nenhuma categoria.</p>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[11px] text-gray-400 uppercase tracking-wide font-medium">Responsável</p>
                  <div className="flex flex-wrap gap-1.5">
                    {RESPONSAVEIS.map((r) => {
                      const active = filterResponsaveis.has(r)
                      return (
                        <button
                          key={r}
                          onClick={() => setFilterResponsaveis((s) => toggleSet(s, r))}
                          className={cn(
                            "text-xs px-2 py-1 rounded-full border transition-colors",
                            active
                              ? "bg-gray-900 text-white border-gray-900"
                              : "bg-white text-gray-600 border-gray-200"
                          )}
                        >
                          {RESPONSAVEL_LABELS[r]}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[11px] text-gray-400 uppercase tracking-wide font-medium">Forma de pagamento</p>
                  <div className="flex flex-wrap gap-1.5">
                    {formasPagamento.map((f) => {
                      const active = filterFormaIds.has(f.id)
                      return (
                        <button
                          key={f.id}
                          onClick={() => setFilterFormaIds((s) => toggleSet(s, f.id))}
                          className={cn(
                            "inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors",
                            active
                              ? "bg-gray-900 text-white border-gray-900"
                              : "bg-white text-gray-600 border-gray-200"
                          )}
                        >
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: f.cor }}
                          />
                          {f.nome}
                        </button>
                      )
                    })}
                    {formasPagamento.length === 0 && (
                      <p className="text-xs text-gray-300">Nenhuma forma.</p>
                    )}
                  </div>
                </div>

                {filtrosAtivos > 0 && (
                  <button
                    onClick={clearFilters}
                    className="text-xs text-gray-400 hover:text-gray-700 transition-colors inline-flex items-center gap-1"
                  >
                    <X size={12} /> Limpar filtros
                  </button>
                )}
              </div>
            )}

            {/* Lista */}
            {gastosFiltered.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
                <p className="text-sm text-gray-300">
                  {gastos.length === 0
                    ? "Nenhum gasto neste mês."
                    : "Nenhum gasto corresponde aos filtros."}
                </p>
              </div>
            ) : viewMode === "cronologica" ? (
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                {gastosFiltered.map((g) => (
                  <GastoCard
                    key={g.id}
                    gasto={g}
                    categoria={categoriasMap.get(g.categoria_id) ?? null}
                    forma={formasMap.get(g.forma_pagamento_id) ?? null}
                    onClick={() => setGastoSheet({ open: true, gasto: g })}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {gastosPorCategoria.map(({ categoria, gastos: gs, total }) => (
                  <div key={categoria?.id ?? "sem"} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: categoria?.cor ?? "#9ca3af" }}
                        />
                        <p className="text-sm font-medium text-gray-800">
                          {categoria?.nome ?? "Sem categoria"}
                        </p>
                        <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                          {gs.length}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-gray-900 tabular-nums">
                        {formatBRL(total)}
                      </p>
                    </div>
                    {gs.map((g) => (
                      <GastoCard
                        key={g.id}
                        gasto={g}
                        categoria={null}  // já indicado na seção
                        forma={formasMap.get(g.forma_pagamento_id) ?? null}
                        onClick={() => setGastoSheet({ open: true, gasto: g })}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setGastoSheet({ open: true, gasto: null })}
              className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors py-3 bg-white rounded-xl border border-dashed border-gray-200"
            >
              <Plus size={16} /> Novo gasto
            </button>
          </>
        )}
      </main>

      {gastoSheet.open && (
        <GastoEditSheet
          key={gastoSheet.gasto?.id ?? "new"}
          gasto={gastoSheet.gasto}
          categorias={categorias}
          formasPagamento={formasPagamento}
          defaultResponsavel={defaultResponsavel}
          onClose={() => setGastoSheet({ open: false, gasto: null })}
          onSave={handleSaveGasto}
          onDelete={handleDeleteGasto}
        />
      )}

      <CatalogSheet
        open={categoriasSheetOpen}
        onClose={() => setCategoriasSheetOpen(false)}
        table="categorias_gasto"
        title="Categorias"
        itemLabelSingular="categoria"
        placeholder="ex: Alimentação, Deslocamento"
        onChange={fetchAll}
      />

      <CatalogSheet
        open={formasSheetOpen}
        onClose={() => setFormasSheetOpen(false)}
        table="formas_pagamento"
        title="Formas de pagamento"
        itemLabelSingular="forma de pagamento"
        placeholder="ex: Nubank, Pix, Dinheiro"
        onChange={fetchAll}
      />

      <GastosDashboardSheet
        open={dashboardOpen}
        onClose={() => setDashboardOpen(false)}
        categorias={categorias}
      />

      <Toaster />
    </div>
  )
}

interface GastoCardProps {
  gasto: GastoVariavel
  categoria: CategoriaGasto | null
  forma: FormaPagamento | null
  onClick: () => void
}

function GastoCard({ gasto, categoria, forma, onClick }: GastoCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors text-left"
    >
      <div className="shrink-0 w-10 text-center">
        <p className="text-[10px] text-gray-400 uppercase">{getDayOfWeek(gasto.date)}</p>
        <p className="text-base font-semibold text-gray-800 tabular-nums leading-tight">
          {formatDateShort(gasto.date).split("/")[0]}
        </p>
      </div>
      <div className="flex-1 min-w-0">
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
          <p className="text-sm text-gray-600 truncate mt-0.5">{gasto.descricao}</p>
        )}
      </div>
      <p className="shrink-0 text-sm font-semibold text-gray-900 tabular-nums">
        {formatBRL(Number(gasto.valor))}
      </p>
    </button>
  )
}
