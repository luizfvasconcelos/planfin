"use client"

import { useEffect, useState, useCallback, useRef, useMemo } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { TrendingUp, TrendingDown, Sparkles, ChevronDown, ChevronRight } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { NAO_CLASSIFICADO, rootIdOf, rootsOf } from "@/lib/categorias"
import {
  addMonths,
  cn,
  formatBRL,
  formatMonthShort,
  isoMonthOf,
  isoMonthToday,
  monthRange,
} from "@/lib/utils"
import type { CategoriaGasto } from "@/lib/types"
import type { SupabaseClient } from "@supabase/supabase-js"

const MIN_MONTH = "2026-05"
type ViewMode = "total" | "categoria"

interface Props {
  open: boolean
  onClose: () => void
  categorias: CategoriaGasto[]
}

interface RawGasto {
  date: string
  categoria_id: string
  valor: number
}

interface Point {
  x: number
  y: number
  v: number
}

function niceCeil(value: number): number {
  if (value <= 0) return 100
  const exp = Math.pow(10, Math.floor(Math.log10(value)))
  const f = value / exp
  let nice: number
  if (f <= 1) nice = 1
  else if (f <= 2) nice = 2
  else if (f <= 5) nice = 5
  else nice = 10
  return nice * exp
}

function buildSegments(points: Point[]): Point[][] {
  const segments: Point[][] = []
  let current: Point[] = []
  for (const p of points) {
    if (p.v > 0) current.push(p)
    else if (current.length > 0) { segments.push(current); current = [] }
  }
  if (current.length > 0) segments.push(current)
  return segments
}

export function GastosDashboardSheet({ open, onClose, categorias }: Props) {
  const sbRef = useRef<SupabaseClient | null>(null)
  const sb = useCallback(() => {
    if (!sbRef.current) sbRef.current = createClient()
    return sbRef.current
  }, [])

  // Janela inicial: 6 meses retrospectivos a partir do mês atual (recortado no MIN_MONTH).
  const today = isoMonthToday()
  const defaultEnd = today < MIN_MONTH ? MIN_MONTH : today
  const defaultStart = useMemo(() => {
    const s = addMonths(defaultEnd, -5)
    return s < MIN_MONTH ? MIN_MONTH : s
  }, [defaultEnd])

  const [mesInicio, setMesInicio] = useState<string>(defaultStart)
  const [mesFim, setMesFim] = useState<string>(defaultEnd)
  const [viewMode, setViewMode] = useState<ViewMode>("total")
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const [gastos, setGastos] = useState<RawGasto[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedCatId, setExpandedCatId] = useState<string | null>(null)

  // Tudo aqui agrega por categoria-RAIZ; subcategorias só aparecem na
  // composição do mês foco (linha expansível).
  const catMap = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias])
  const rootCategorias = useMemo(() => rootsOf(categorias), [categorias])

  function toggleHidden(id: string) {
    setHiddenIds((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  // Opções do seletor: de MIN_MONTH até 24 meses no futuro. Meses sem dado
  // mostram "Sem dados no período" — fica explícito ao invés de invisível.
  const monthOptions = useMemo(() => {
    const opts: string[] = []
    let cur = MIN_MONTH
    const end = addMonths(today < MIN_MONTH ? MIN_MONTH : today, 24)
    while (cur <= end) {
      opts.push(cur)
      cur = addMonths(cur, 1)
    }
    return opts
  }, [today])

  // Lista de meses no intervalo selecionado.
  const months = useMemo(() => {
    const list: string[] = []
    let cur = mesInicio
    while (cur <= mesFim) {
      list.push(cur)
      cur = addMonths(cur, 1)
    }
    return list
  }, [mesInicio, mesFim])

  // Estende o range em 1 mês pra trás pra calcular variações no 1º mês visível.
  // Esse mês extra NÃO aparece no gráfico nem na tabela — só alimenta o card de variações.
  const fetchStart = useMemo(() => {
    if (months.length === 0) return mesInicio
    return addMonths(months[0], -1)
  }, [months, mesInicio])

  const fetchGastos = useCallback(async () => {
    if (months.length === 0) { setLoading(false); return }
    const { start } = monthRange(fetchStart)
    const { end } = monthRange(months[months.length - 1])
    const { data } = await sb()
      .from("gastos_variaveis")
      .select("date, categoria_id, valor")
      .gte("date", start)
      .lte("date", end)
    if (data) setGastos(data as RawGasto[])
    setLoading(false)
  }, [sb, months, fetchStart])

  useEffect(() => {
    if (!open) return
    fetchGastos()
  }, [open, fetchGastos])

  // totais[mês].get(categoria_raiz_id) = soma (subs rolam pra mãe).
  // Inclui o fetchStart (mês extra) pra cálculo de variação.
  const totals = useMemo(() => {
    const m = new Map<string, Map<string, number>>()
    const allMonths = months.length > 0 ? [fetchStart, ...months] : []
    allMonths.forEach((mm) => m.set(mm, new Map()))
    for (const g of gastos) {
      const mk = isoMonthOf(g.date)
      const inner = m.get(mk)
      if (!inner) continue
      const rootId = rootIdOf(g.categoria_id, catMap)
      inner.set(rootId, (inner.get(rootId) ?? 0) + Number(g.valor))
    }
    return m
  }, [months, fetchStart, gastos, catMap])

  // Total por mês (soma de todas as categorias).
  const totalsByMonth = useMemo(() => {
    return months.map((m) => {
      let s = 0
      totals.get(m)?.forEach((v) => { s += v })
      return s
    })
  }, [months, totals])

  // Categorias-raiz que aparecem na janela (pra chips e tabela).
  const candidateCategorias = useMemo(() => {
    return rootCategorias.filter((c) =>
      months.some((m) => (totals.get(m)?.get(c.id) ?? 0) > 0)
    )
  }, [rootCategorias, months, totals])

  const visibleCategorias = useMemo(
    () => candidateCategorias.filter((c) => !hiddenIds.has(c.id)),
    [candidateCategorias, hiddenIds]
  )

  // yMax depende do modo: total = pico do total geral; categoria = pico da maior linha visível.
  const yMax = useMemo(() => {
    if (viewMode === "total") {
      return niceCeil(Math.max(...totalsByMonth, 0))
    }
    let max = 0
    for (const c of visibleCategorias) {
      for (const m of months) {
        const v = totals.get(m)?.get(c.id) ?? 0
        if (v > max) max = v
      }
    }
    return niceCeil(max)
  }, [viewMode, totalsByMonth, visibleCategorias, months, totals])

  // SVG layout
  const W = 480
  const H = 240
  const PAD = { l: 28, r: 14, t: 22, b: 26 }
  const chartW = W - PAD.l - PAD.r
  const chartH = H - PAD.t - PAD.b

  const xAt = (i: number) =>
    months.length <= 1
      ? PAD.l + chartW / 2
      : PAD.l + (i / (months.length - 1)) * chartW
  const yAt = (v: number) => PAD.t + (1 - v / yMax) * chartH

  const formatChartLabel = (v: number) =>
    v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : String(Math.round(v))

  // --- Mês foco (último do intervalo) e mês anterior pra cálculo de variações ---
  const focusMonth = months[months.length - 1] ?? null
  const prevMonth = focusMonth ? addMonths(focusMonth, -1) : null
  const hasPrevious = prevMonth ? totals.has(prevMonth) : false

  // Composição do mês foco: lista de {categoria, valor, pct} ordenada desc.
  const composition = useMemo(() => {
    if (!focusMonth) return { total: 0, items: [] as Array<{ categoria: CategoriaGasto; valor: number; pct: number }> }
    const inner = totals.get(focusMonth)
    if (!inner) return { total: 0, items: [] }
    let total = 0
    inner.forEach((v) => { total += v })
    if (total === 0) return { total: 0, items: [] }
    const items = rootCategorias
      .map((c) => ({ categoria: c, valor: inner.get(c.id) ?? 0 }))
      .filter((it) => it.valor > 0)
      .map((it) => ({ ...it, pct: (it.valor / total) * 100 }))
      .sort((a, b) => b.valor - a.valor)
    return { total, items }
  }, [focusMonth, totals, rootCategorias])

  // Quebra por subcategoria do mês foco: subBreakdown.get(raiz).get(subId|"")
  // ("" = lançado direto na mãe → "Não classificado").
  const subBreakdown = useMemo(() => {
    const m = new Map<string, Map<string, number>>()
    if (!focusMonth) return m
    for (const g of gastos) {
      if (isoMonthOf(g.date) !== focusMonth) continue
      const rootId = rootIdOf(g.categoria_id, catMap)
      const subKey = catMap.get(g.categoria_id)?.parent_id ? g.categoria_id : ""
      if (!m.has(rootId)) m.set(rootId, new Map())
      const inner = m.get(rootId)!
      inner.set(subKey, (inner.get(subKey) ?? 0) + Number(g.valor))
    }
    return m
  }, [gastos, focusMonth, catMap])

  // Variações foco vs prevMonth: top 5 maiores diferenças em valor absoluto.
  // Inclui categorias que apareceram (was 0) e zeraram (now 0).
  const variations = useMemo(() => {
    if (!focusMonth || !prevMonth || !hasPrevious) return [] as Array<{
      categoria: CategoriaGasto; current: number; previous: number; diff: number; pctChange: number | null
    }>
    const cur = totals.get(focusMonth)
    const prev = totals.get(prevMonth)
    if (!cur || !prev) return []
    return rootCategorias
      .map((c) => {
        const current = cur.get(c.id) ?? 0
        const previous = prev.get(c.id) ?? 0
        const diff = current - previous
        // pctChange = null quando previous era 0 (não é "X% a mais", é categoria nova).
        const pctChange = previous > 0 ? (diff / previous) * 100 : null
        return { categoria: c, current, previous, diff, pctChange }
      })
      .filter((it) => it.diff !== 0)
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
      .slice(0, 5)
  }, [focusMonth, prevMonth, hasPrevious, totals, rootCategorias])

  // Posição Y dos rótulos no modo "por categoria" com collision avoidance:
  // pra cada coluna (mês), empilha os labels de baixo pra cima respeitando MIN_GAP.
  const labelYByCategoria = useMemo(() => {
    const map = new Map<string, number>()
    if (viewMode !== "categoria") return map
    const MIN_GAP = 13
    months.forEach((m, i) => {
      const items = visibleCategorias
        .map((c) => {
          const v = totals.get(m)?.get(c.id) ?? 0
          return { id: c.id, y: yAt(v), v }
        })
        .filter((it) => it.v > 0)
        .sort((a, b) => a.y - b.y)
      let lastY = -Infinity
      for (const it of items) {
        let y = it.y - 9
        if (y < lastY + MIN_GAP) y = lastY + MIN_GAP
        lastY = y
        map.set(`${i}-${it.id}`, y)
      }
    })
    return map
  }, [viewMode, months, visibleCategorias, totals, yAt])

  const hasAnyData = gastos.length > 0

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto px-5">
        <SheetHeader className="mb-4">
          <SheetTitle>Dashboard de gastos</SheetTitle>
        </SheetHeader>

        <div className="pb-6 space-y-4">
          {/* Filtro de período (mês inicial/final) */}
          <div className="flex items-center justify-center gap-2 text-xs text-gray-600">
            <label className="flex items-center gap-1">
              <span className="text-gray-400">De</span>
              <select
                value={mesInicio}
                onChange={(e) => setMesInicio(e.target.value)}
                className="text-xs border border-gray-200 rounded px-1.5 py-0.5 tabular-nums capitalize bg-white"
              >
                {monthOptions
                  .filter((m) => m <= mesFim)
                  .map((m) => (
                    <option key={m} value={m}>{formatMonthShort(m)}</option>
                  ))}
              </select>
            </label>
            <label className="flex items-center gap-1">
              <span className="text-gray-400">até</span>
              <select
                value={mesFim}
                onChange={(e) => setMesFim(e.target.value)}
                className="text-xs border border-gray-200 rounded px-1.5 py-0.5 tabular-nums capitalize bg-white"
              >
                {monthOptions
                  .filter((m) => m >= mesInicio)
                  .map((m) => (
                    <option key={m} value={m}>{formatMonthShort(m)}</option>
                  ))}
              </select>
            </label>
          </div>

          {/* Toggle de visão */}
          <div className="inline-flex w-full rounded-lg border border-gray-200 bg-white p-0.5 text-xs">
            <button
              onClick={() => setViewMode("total")}
              className={cn(
                "flex-1 py-1.5 rounded-md transition-colors",
                viewMode === "total" ? "bg-gray-900 text-white" : "text-gray-500"
              )}
            >
              Total
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

          {loading ? (
            <p className="text-sm text-gray-400 text-center py-6">Carregando…</p>
          ) : !hasAnyData ? (
            <p className="text-sm text-gray-400 text-center py-6">Sem dados no período.</p>
          ) : (
            <>
              {/* Chips de categoria (só no modo categoria) */}
              {viewMode === "categoria" && candidateCategorias.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {candidateCategorias.map((c) => {
                    const hidden = hiddenIds.has(c.id)
                    return (
                      <button
                        key={c.id}
                        onClick={() => toggleHidden(c.id)}
                        className={cn(
                          "text-xs font-semibold px-2.5 py-1 rounded-full border transition-all",
                          hidden && "line-through opacity-50"
                        )}
                        style={{
                          backgroundColor: hidden ? "#fff" : `${c.cor}1a`,
                          color: hidden ? "#9ca3af" : c.cor,
                          borderColor: hidden ? "#e5e7eb" : c.cor,
                        }}
                      >
                        {c.nome}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Chart */}
              <div className="bg-white rounded-xl border border-gray-100 p-2">
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
                  {/* X labels (meses) */}
                  {months.map((m, i) => (
                    <text
                      key={m}
                      x={xAt(i)}
                      y={H - PAD.b + 14}
                      textAnchor="middle"
                      fontSize={11}
                      fill="#9ca3af"
                    >
                      {formatMonthShort(m)}
                    </text>
                  ))}

                  {viewMode === "total" ? (
                    <TotalLine
                      months={months}
                      values={totalsByMonth}
                      xAt={xAt}
                      yAt={yAt}
                      formatLabel={formatChartLabel}
                    />
                  ) : (
                    visibleCategorias.map((c) => (
                      <CategoriaLine
                        key={c.id}
                        categoria={c}
                        months={months}
                        getValue={(m) => totals.get(m)?.get(c.id) ?? 0}
                        xAt={xAt}
                        yAt={yAt}
                        labelY={(i) => labelYByCategoria.get(`${i}-${c.id}`)}
                        formatLabel={formatChartLabel}
                      />
                    ))
                  )}
                </svg>
              </div>


              {/* Foco do mês (último do intervalo): composição e variações */}
              {focusMonth && composition.items.length > 0 && (
                <div className="pt-2 space-y-3">
                  <div className="flex items-baseline justify-between border-b border-gray-100 pb-2">
                    <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">
                      Detalhe de <span className="text-gray-700 capitalize font-semibold">{formatMonthShort(focusMonth)}</span>
                    </p>
                    <p className="text-lg font-semibold text-gray-900 tabular-nums">
                      {formatBRL(composition.total)}
                    </p>
                  </div>

                  {/* C — Composição: barras horizontais ordenadas, com valor absoluto e %.
                      Categoria com subcategorias expande no toque (quebra por sub). */}
                  <div className="space-y-2">
                    {composition.items.map(({ categoria, valor, pct }) => {
                      const breakdown = subBreakdown.get(categoria.id)
                      const temSubs = breakdown
                        ? Array.from(breakdown.keys()).some((k) => k !== "")
                        : false
                      const expanded = expandedCatId === categoria.id
                      return (
                        <div key={categoria.id} className="space-y-1">
                          <button
                            className={cn("w-full space-y-1", !temSubs && "cursor-default")}
                            onClick={() => temSubs && setExpandedCatId(expanded ? null : categoria.id)}
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="inline-flex items-center gap-1.5 font-medium text-gray-700">
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: categoria.cor }}
                                />
                                {categoria.nome}
                                {temSubs && (
                                  expanded
                                    ? <ChevronDown size={12} className="text-gray-400" />
                                    : <ChevronRight size={12} className="text-gray-400" />
                                )}
                              </span>
                              <span className="tabular-nums text-gray-600">
                                <span className="font-semibold text-gray-800">{formatBRL(valor)}</span>
                                <span className="text-gray-400 ml-1.5">{pct.toFixed(1)}%</span>
                              </span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${pct}%`,
                                  backgroundColor: categoria.cor,
                                }}
                              />
                            </div>
                          </button>
                          {expanded && breakdown && (
                            <div className="pl-3.5 pt-0.5 space-y-1">
                              {Array.from(breakdown.entries())
                                .sort((a, b) => b[1] - a[1])
                                .map(([subKey, v]) => (
                                  <div key={subKey || "nc"} className="flex items-center justify-between text-xs">
                                    <span className={subKey === "" ? "text-gray-400 italic" : "text-gray-600"}>
                                      {subKey === "" ? NAO_CLASSIFICADO : catMap.get(subKey)?.nome ?? "?"}
                                    </span>
                                    <span className="tabular-nums text-gray-600">
                                      {formatBRL(v)}
                                      <span className="text-gray-400 ml-1.5">
                                        {valor > 0 ? `${Math.round((v / valor) * 100)}%` : ""}
                                      </span>
                                    </span>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* B — Variações vs mês anterior */}
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-2">
                      O que mudou vs {prevMonth ? formatMonthShort(prevMonth) : "mês anterior"}
                    </p>
                    {!hasPrevious ? (
                      <p className="text-xs text-gray-400 italic">
                        Estenda o intervalo pra incluir {prevMonth ? formatMonthShort(prevMonth) : "o mês anterior"} e ver as variações.
                      </p>
                    ) : variations.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">
                        Sem variações relevantes entre os dois meses.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {variations.map((v) => {
                          const isIncrease = v.diff > 0
                          const isNew = v.previous === 0
                          const isGone = v.current === 0
                          const colorClass = isIncrease ? "text-red-600" : "text-emerald-600"
                          const Icon = isIncrease ? TrendingUp : TrendingDown
                          return (
                            <div key={v.categoria.id} className="flex items-center justify-between gap-2 text-xs">
                              <span className="inline-flex items-center gap-1.5 font-medium text-gray-700 min-w-0">
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: v.categoria.cor }}
                                />
                                <span className="truncate">{v.categoria.nome}</span>
                                {isNew && (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-600 bg-amber-50 px-1 py-0.5 rounded">
                                    <Sparkles size={9} /> NOVO
                                  </span>
                                )}
                                {isGone && (
                                  <span className="text-[9px] font-semibold text-gray-400 bg-gray-100 px-1 py-0.5 rounded">
                                    ZERADO
                                  </span>
                                )}
                              </span>
                              <span className={cn("inline-flex items-center gap-1 tabular-nums shrink-0", colorClass)}>
                                <Icon size={12} />
                                <span className="font-semibold">
                                  {isIncrease ? "+" : ""}{formatBRL(v.diff)}
                                </span>
                                {v.pctChange !== null && (
                                  <span className="text-[10px] opacity-70">
                                    ({isIncrease ? "+" : ""}{v.pctChange.toFixed(0)}%)
                                  </span>
                                )}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// --- Sublinhas do gráfico ---------------------------------------------------

interface TotalLineProps {
  months: string[]
  values: number[]
  xAt: (i: number) => number
  yAt: (v: number) => number
  formatLabel: (v: number) => string
}

function TotalLine({ months, values, xAt, yAt, formatLabel }: TotalLineProps) {
  const points: Point[] = values.map((v, i) => ({ x: xAt(i), y: yAt(v), v }))
  const segments = buildSegments(points)
  return (
    <g>
      {segments.map((seg, si) => {
        if (seg.length < 2) return null
        const d = seg
          .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
          .join(" ")
        return (
          <path
            key={si}
            d={d}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )
      })}
      {points.map((p, i) =>
        p.v > 0 ? (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={3} fill="#fff" stroke="#3b82f6" strokeWidth={2}>
              <title>{`${formatMonthShort(months[i])}: ${formatBRL(p.v)}`}</title>
            </circle>
            <text
              x={p.x}
              y={p.y - 8}
              textAnchor="middle"
              fontSize={11}
              fontWeight={500}
              fill="#3b82f6"
            >
              {formatLabel(p.v)}
            </text>
          </g>
        ) : null
      )}
    </g>
  )
}

interface CategoriaLineProps {
  categoria: CategoriaGasto
  months: string[]
  getValue: (mes: string) => number
  xAt: (i: number) => number
  yAt: (v: number) => number
  labelY: (i: number) => number | undefined
  formatLabel: (v: number) => string
}

function CategoriaLine({ categoria, months, getValue, xAt, yAt, labelY, formatLabel }: CategoriaLineProps) {
  const points: Point[] = months.map((m, i) => ({
    x: xAt(i),
    y: yAt(getValue(m)),
    v: getValue(m),
  }))
  const segments = buildSegments(points)

  return (
    <g>
      {segments.map((seg, si) => {
        if (seg.length < 2) return null
        const d = seg
          .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
          .join(" ")
        return (
          <path
            key={si}
            d={d}
            fill="none"
            stroke={categoria.cor}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )
      })}
      {points.map((p, i) =>
        p.v > 0 ? (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={3}
            fill="#fff"
            stroke={categoria.cor}
            strokeWidth={2}
          >
            <title>{`${categoria.nome} · ${formatMonthShort(months[i])}: ${formatBRL(p.v)}`}</title>
          </circle>
        ) : null
      )}
      {points.map((p, i) => {
        if (p.v <= 0) return null
        const ly = labelY(i) ?? p.y - 8
        return (
          <text
            key={`lbl-${i}`}
            x={p.x}
            y={ly}
            textAnchor="middle"
            fontSize={11}
            fontWeight={500}
            fill={categoria.cor}
          >
            {formatLabel(p.v)}
          </text>
        )
      })}
    </g>
  )
}

