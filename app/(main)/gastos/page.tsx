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
import {
  corOf,
  displayCategoria,
  NAO_CLASSIFICADO,
  rootIdOf,
  rootOf,
  rootsOf,
  subsByParent,
} from "@/lib/categorias"
import type {
  CategoriaGasto,
  FormaPagamento,
  GastoVariavel,
  ResponsavelGasto,
} from "@/lib/types"

const MIN_MONTH = "2026-05"
const LS_KEY_MES = "planfin.gastos.mes"

type ViewMode = "cronologica" | "categoria" | "maiores"
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
  // Filtro de categoria em 2 níveis: mães selecionadas + refino por sub.
  // filterSubIds guarda categoria_ids específicos (sub, ou a própria mãe = "Não
  // classificado"). Uma mãe selecionada sem refino pega tudo dela; com refino,
  // só os ids escolhidos.
  const [filterRootIds, setFilterRootIds] = useState<Set<string>>(new Set())
  const [filterSubIds, setFilterSubIds] = useState<Set<string>>(new Set())
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
  const categoriasRaiz = useMemo(() => rootsOf(categorias), [categorias])
  const subsMap = useMemo(() => subsByParent(categorias), [categorias])

  const gastosFiltered = useMemo(() => {
    return gastos.filter((g) => {
      if (filterRootIds.size > 0) {
        const root = rootIdOf(g.categoria_id, categoriasMap)
        if (!filterRootIds.has(root)) return false
        // Refino: se essa mãe tem subs marcadas, o gasto precisa bater uma delas.
        const refinos = (subsMap.get(root) ?? []).map((s) => s.id).concat(root) // +mãe = "não classificado"
        const ativos = refinos.filter((id) => filterSubIds.has(id))
        if (ativos.length > 0 && !ativos.includes(g.categoria_id)) return false
      }
      if (filterResponsaveis.size > 0 && !filterResponsaveis.has(g.responsavel)) return false
      if (filterFormaIds.size > 0 && !filterFormaIds.has(g.forma_pagamento_id)) return false
      return true
    })
  }, [gastos, filterRootIds, filterSubIds, filterResponsaveis, filterFormaIds, categoriasMap, subsMap])

  const totalFiltrado = useMemo(
    () => gastosFiltered.reduce((s, g) => s + Number(g.valor), 0),
    [gastosFiltered]
  )
  const totalMes = useMemo(
    () => gastos.reduce((s, g) => s + Number(g.valor), 0),
    [gastos]
  )

  const filtrosAtivos =
    filterRootIds.size + filterResponsaveis.size + filterFormaIds.size

  // Agrupamento por categoria-raiz; porSub guarda subtotal por subcategoria
  // (chave "" = gasto lançado direto na mãe → "Não classificado").
  const gastosPorCategoria = useMemo(() => {
    const grouped = new Map<string, {
      categoria: CategoriaGasto | null
      gastos: GastoVariavel[]
      total: number
      porSub: Map<string, number>
    }>()
    for (const g of gastosFiltered) {
      const root = rootOf(g.categoria_id, categoriasMap)
      const key = root?.id ?? g.categoria_id
      if (!grouped.has(key)) {
        grouped.set(key, { categoria: root, gastos: [], total: 0, porSub: new Map() })
      }
      const entry = grouped.get(key)!
      entry.gastos.push(g)
      entry.total += Number(g.valor)
      const subKey = categoriasMap.get(g.categoria_id)?.parent_id ? g.categoria_id : ""
      entry.porSub.set(subKey, (entry.porSub.get(subKey) ?? 0) + Number(g.valor))
    }
    return Array.from(grouped.values()).sort((a, b) => b.total - a.total)
  }, [gastosFiltered, categoriasMap])

  // Visualização "Maiores": valor decrescente (empate: mais recente primeiro).
  const gastosMaiores = useMemo(
    () => gastosFiltered.slice().sort(
      (a, b) => Number(b.valor) - Number(a.valor) || b.date.localeCompare(a.date)
    ),
    [gastosFiltered]
  )

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

  // Toggle de mãe: ao desmarcar, limpa também os refinos de subs daquela mãe.
  function toggleRoot(rootId: string) {
    setFilterRootIds((s) => {
      const next = toggleSet(s, rootId)
      if (!next.has(rootId)) {
        const subIds = new Set((subsMap.get(rootId) ?? []).map((x) => x.id).concat(rootId))
        setFilterSubIds((sub) => new Set([...sub].filter((id) => !subIds.has(id))))
      }
      return next
    })
  }

  function clearFilters() {
    setFilterRootIds(new Set())
    setFilterSubIds(new Set())
    setFilterResponsaveis(new Set())
    setFilterFormaIds(new Set())
  }

  // Mães selecionadas que têm subs — alimentam a linha de refino.
  const refinaveis = categoriasRaiz.filter(
    (c) => filterRootIds.has(c.id) && (subsMap.get(c.id)?.length ?? 0) > 0
  )

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

            <button
              onClick={() => setGastoSheet({ open: true, gasto: null })}
              className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors py-3 bg-white rounded-xl border border-dashed border-gray-200"
            >
              <Plus size={16} /> Novo gasto
            </button>

            {/* Controles: view toggle (linha cheia) + filtros (linha própria) */}
            <div className="space-y-2">
              <div className="inline-flex w-full rounded-lg border border-gray-200 bg-white p-0.5 text-sm">
                <button
                  onClick={() => setViewMode("cronologica")}
                  className={cn(
                    "flex-1 py-2 rounded-md transition-colors",
                    viewMode === "cronologica" ? "bg-gray-900 text-white" : "text-gray-500"
                  )}
                >
                  Cronológica
                </button>
                <button
                  onClick={() => setViewMode("categoria")}
                  className={cn(
                    "flex-1 py-2 rounded-md transition-colors",
                    viewMode === "categoria" ? "bg-gray-900 text-white" : "text-gray-500"
                  )}
                >
                  Categorias
                </button>
                <button
                  onClick={() => setViewMode("maiores")}
                  className={cn(
                    "flex-1 py-2 rounded-md transition-colors",
                    viewMode === "maiores" ? "bg-gray-900 text-white" : "text-gray-500"
                  )}
                >
                  Maiores
                </button>
              </div>
              <button
                onClick={() => setFiltersOpen((v) => !v)}
                className={cn(
                  "w-full inline-flex items-center justify-center gap-1.5 text-sm py-2 rounded-lg border transition-colors",
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
                    {categoriasRaiz.map((c) => {
                      const active = filterRootIds.has(c.id)
                      const nSubs = subsMap.get(c.id)?.length ?? 0
                      return (
                        <button
                          key={c.id}
                          onClick={() => toggleRoot(c.id)}
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
                          {nSubs > 0 && (
                            <span className={cn(
                              "text-[9px] tabular-nums",
                              active ? "text-gray-300" : "text-gray-400"
                            )}>
                              {nSubs}
                            </span>
                          )}
                        </button>
                      )
                    })}
                    {categorias.length === 0 && (
                      <p className="text-xs text-gray-300">Nenhuma categoria.</p>
                    )}
                  </div>

                  {/* Refino por subcategoria — só das mães selecionadas que têm subs */}
                  {refinaveis.map((mae) => {
                    const subs = subsMap.get(mae.id) ?? []
                    return (
                      <div key={mae.id} className="pl-2 border-l-2 space-y-1.5" style={{ borderColor: `${mae.cor}55` }}>
                        <p className="text-[10px] text-gray-400">
                          refinar <span className="font-medium text-gray-500">{mae.nome}</span>
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {subs.map((s) => {
                            const on = filterSubIds.has(s.id)
                            return (
                              <button
                                key={s.id}
                                onClick={() => setFilterSubIds((set) => toggleSet(set, s.id))}
                                className={cn(
                                  "text-xs px-2 py-0.5 rounded-full border transition-colors",
                                  on ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-500 border-gray-200"
                                )}
                              >
                                {s.nome}
                              </button>
                            )
                          })}
                          {/* "Não classificado" = gasto lançado direto na mãe */}
                          <button
                            onClick={() => setFilterSubIds((set) => toggleSet(set, mae.id))}
                            className={cn(
                              "text-xs px-2 py-0.5 rounded-full border transition-colors italic",
                              filterSubIds.has(mae.id)
                                ? "bg-gray-900 text-white border-gray-900"
                                : "bg-white text-gray-400 border-gray-200"
                            )}
                          >
                            sem sub
                          </button>
                        </div>
                      </div>
                    )
                  })}
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
                    categoria={displayCategoria(g.categoria_id, categoriasMap)}
                    forma={formasMap.get(g.forma_pagamento_id) ?? null}
                    onClick={() => setGastoSheet({ open: true, gasto: g })}
                  />
                ))}
              </div>
            ) : viewMode === "maiores" ? (
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                {gastosMaiores.map((g) => (
                  <GastoCard
                    key={g.id}
                    gasto={g}
                    categoria={displayCategoria(g.categoria_id, categoriasMap)}
                    forma={formasMap.get(g.forma_pagamento_id) ?? null}
                    share={totalFiltrado > 0 ? Number(g.valor) / totalFiltrado : 0}
                    onClick={() => setGastoSheet({ open: true, gasto: g })}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {gastosPorCategoria.map(({ categoria, gastos: gs, total, porSub }) => {
                  const temSubs = Array.from(porSub.keys()).some((k) => k !== "")
                  return (
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
                      {/* Subtotal por subcategoria — só quando há gasto classificado */}
                      {temSubs && (
                        <div className="px-4 py-2 bg-gray-50/50 border-b border-gray-100 space-y-1">
                          {Array.from(porSub.entries())
                            .sort((a, b) => b[1] - a[1])
                            .map(([subKey, valor]) => (
                              <div key={subKey || "nc"} className="flex items-center justify-between text-xs">
                                <span className={subKey === "" ? "text-gray-400 italic" : "text-gray-600"}>
                                  {subKey === "" ? NAO_CLASSIFICADO : categoriasMap.get(subKey)?.nome ?? "?"}
                                </span>
                                <span className="tabular-nums text-gray-700">
                                  {formatBRL(valor)}
                                  <span className="text-gray-400 ml-1.5">
                                    {total > 0 ? `${Math.round((valor / total) * 100)}%` : ""}
                                  </span>
                                </span>
                              </div>
                            ))}
                        </div>
                      )}
                      {gs.map((g) => {
                        const cat = categoriasMap.get(g.categoria_id)
                        return (
                          <GastoCard
                            key={g.id}
                            gasto={g}
                            // Mãe já indicada na seção; mostra só a sub (se houver)
                            categoria={cat?.parent_id ? { ...cat, cor: corOf(cat, categoriasMap) } : null}
                            forma={formasMap.get(g.forma_pagamento_id) ?? null}
                            onClick={() => setGastoSheet({ open: true, gasto: g })}
                          />
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}
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
        nested
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
  share?: number  // fração do total exibido (0..1) — mostrado na view "Maiores"
  onClick: () => void
}

function GastoCard({ gasto, categoria, forma, share, onClick }: GastoCardProps) {
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
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold text-gray-900 tabular-nums">
          {formatBRL(Number(gasto.valor))}
        </p>
        {share !== undefined && (
          <p className="text-[10px] text-gray-400 tabular-nums">
            {(share * 100).toFixed(share >= 0.095 ? 0 : 1)}% do total
          </p>
        )}
      </div>
    </button>
  )
}
