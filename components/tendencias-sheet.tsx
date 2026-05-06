"use client"

import { useEffect, useState, useCallback, useRef, useMemo } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { createClient } from "@/lib/supabase/client"
import {
  addMonths,
  cn,
  formatBRL,
  formatMonthShort,
  isoMonthOf,
  isoMonthToday,
  monthRange,
} from "@/lib/utils"
import type { DudaClinica } from "@/lib/types"
import type { SupabaseClient } from "@supabase/supabase-js"

const MIN_MONTH = "2026-01"
const N_MONTHS = 12

interface Props {
  open: boolean
  onClose: () => void
  clinicas: DudaClinica[]
}

interface RawEntry {
  date: string
  clinica_id: string
  valor: number
}

interface Point {
  x: number
  y: number
  v: number
}

// Round up to a "nice" Y-axis ceiling (e.g. 423 → 500, 1834 → 2000)
function niceCeil(value: number): number {
  if (value <= 0) return 1000
  const exp = Math.pow(10, Math.floor(Math.log10(value)))
  const f = value / exp
  let nice: number
  if (f <= 1) nice = 1
  else if (f <= 2) nice = 2
  else if (f <= 5) nice = 5
  else nice = 10
  return nice * exp
}

// Split points into contiguous non-zero runs (so the line breaks on missing months).
function buildSegments(points: Point[]): Point[][] {
  const segments: Point[][] = []
  let current: Point[] = []
  for (const p of points) {
    if (p.v > 0) {
      current.push(p)
    } else if (current.length > 0) {
      segments.push(current)
      current = []
    }
  }
  if (current.length > 0) segments.push(current)
  return segments
}

export function TendenciasSheet({ open, onClose, clinicas }: Props) {
  const sbRef = useRef<SupabaseClient | null>(null)
  const sb = useCallback(() => {
    if (!sbRef.current) sbRef.current = createClient()
    return sbRef.current
  }, [])

  const [entries, setEntries] = useState<RawEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())

  function toggleHidden(id: string) {
    setHiddenIds((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const months = useMemo(() => {
    const cur = isoMonthToday()
    const list: string[] = []
    for (let i = N_MONTHS - 1; i >= 0; i--) {
      const m = addMonths(cur, -i)
      if (m >= MIN_MONTH) list.push(m)
    }
    return list
  }, [])

  const fetchEntries = useCallback(async () => {
    if (months.length === 0) { setLoading(false); return }
    const { start } = monthRange(months[0])
    const { end } = monthRange(months[months.length - 1])
    const { data } = await sb()
      .from("duda_entries")
      .select("date, clinica_id, valor")
      .gte("date", start)
      .lte("date", end)
    if (data) setEntries(data as RawEntry[])
    setLoading(false)
  }, [sb, months])

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetchEntries()
  }, [open, fetchEntries])

  const totals = useMemo(() => {
    const m = new Map<string, Map<string, number>>()
    months.forEach((mm) => m.set(mm, new Map()))
    for (const e of entries) {
      const mk = isoMonthOf(e.date)
      const inner = m.get(mk)
      if (!inner) continue
      inner.set(e.clinica_id, (inner.get(e.clinica_id) ?? 0) + Number(e.valor))
    }
    return m
  }, [months, entries])

  // Clinics with data in the visible window (used for filter chips).
  const candidateClinicas = useMemo(() => {
    return clinicas.filter((c) =>
      months.some((m) => (totals.get(m)?.get(c.id) ?? 0) > 0)
    )
  }, [clinicas, months, totals])

  // Visible clinics = candidates that aren't hidden by user filter.
  const visibleClinicas = useMemo(
    () => candidateClinicas.filter((c) => !hiddenIds.has(c.id)),
    [candidateClinicas, hiddenIds]
  )

  const yMax = useMemo(() => {
    let max = 0
    for (const c of visibleClinicas) {
      for (const m of months) {
        const v = totals.get(m)?.get(c.id) ?? 0
        if (v > max) max = v
      }
    }
    return niceCeil(max)
  }, [visibleClinicas, months, totals])

  // SVG layout — viewBox sized closer to mobile aspect for readable text on phones.
  const W = 480
  const H = 280
  const PAD = { l: 28, r: 14, t: 22, b: 26 }
  const chartW = W - PAD.l - PAD.r
  const chartH = H - PAD.t - PAD.b

  const xAt = (i: number) =>
    months.length <= 1
      ? PAD.l + chartW / 2
      : PAD.l + (i / (months.length - 1)) * chartW
  const yAt = (v: number) => PAD.t + (1 - v / yMax) * chartH

  const formatLabel = (v: number) => Math.round(v).toLocaleString("pt-BR")

  // Per-(month, clinic) data label Y position with collision avoidance.
  const labelY = useMemo(() => {
    const map = new Map<string, number>()
    const MIN_GAP = 13
    months.forEach((m, i) => {
      const items = visibleClinicas
        .map((c) => {
          const v = totals.get(m)?.get(c.id) ?? 0
          return { id: c.id, y: yAt(v), v }
        })
        .filter((l) => l.v > 0)
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
  }, [months, visibleClinicas, totals, yAt])

  // Sigla Y position with collision avoidance (siglas anchored at first non-zero point).
  const siglaY = useMemo(() => {
    const map = new Map<string, number>()
    const byIdx = new Map<number, { id: string; y: number }[]>()
    for (const c of visibleClinicas) {
      let firstIdx = -1
      let firstY = 0
      for (let i = 0; i < months.length; i++) {
        const v = totals.get(months[i])?.get(c.id) ?? 0
        if (v > 0) { firstIdx = i; firstY = yAt(v); break }
      }
      if (firstIdx < 0) continue
      if (!byIdx.has(firstIdx)) byIdx.set(firstIdx, [])
      byIdx.get(firstIdx)!.push({ id: c.id, y: firstY })
    }
    const MIN_GAP = 14
    byIdx.forEach((items) => {
      items.sort((a, b) => a.y - b.y)
      let lastY = -Infinity
      for (const it of items) {
        let y = it.y
        if (y < lastY + MIN_GAP) y = lastY + MIN_GAP
        lastY = y
        map.set(it.id, y)
      }
    })
    return map
  }, [visibleClinicas, months, totals, yAt])

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto px-5">
        <SheetHeader className="mb-4">
          <SheetTitle>Tendência mensal</SheetTitle>
        </SheetHeader>

        <div className="pb-6">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-6">Carregando…</p>
          ) : candidateClinicas.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Sem dados ainda.</p>
          ) : (
            <>
              {/* Filter chips */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {candidateClinicas.map((c) => {
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
                      {c.sigla || c.nome}
                    </button>
                  )
                })}
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-2">
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
                  {/* X labels (months) */}
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

                  {visibleClinicas.map((c) => {
                    const points: Point[] = months.map((m, i) => ({
                      x: xAt(i),
                      y: yAt(totals.get(m)?.get(c.id) ?? 0),
                      v: totals.get(m)?.get(c.id) ?? 0,
                    }))
                    const segments = buildSegments(points)
                    const anchorIdx = points.findIndex((p) => p.v > 0)
                    const anchor = anchorIdx >= 0 ? points[anchorIdx] : null
                    if (!anchor) return null

                    return (
                      <g key={c.id}>
                        {/* Line segments (broken on zeros) */}
                        {segments.map((seg, si) => {
                          if (seg.length < 2) {
                            // single point — render as just a dot (no line)
                            return null
                          }
                          const path = seg
                            .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
                            .join(" ")
                          return (
                            <path
                              key={si}
                              d={path}
                              fill="none"
                              stroke={c.cor}
                              strokeWidth={2}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          )
                        })}
                        {/* Dots only on non-zero points */}
                        {points.map((p, i) =>
                          p.v > 0 ? (
                            <circle
                              key={i}
                              cx={p.x}
                              cy={p.y}
                              r={3}
                              fill="#fff"
                              stroke={c.cor}
                              strokeWidth={2}
                            >
                              <title>{`${c.sigla || c.nome} · ${formatMonthShort(months[i])}: ${formatBRL(p.v)}`}</title>
                            </circle>
                          ) : null
                        )}
                        {/* Data labels with collision avoidance */}
                        {points.map((p, i) => {
                          if (p.v <= 0) return null
                          const ly = labelY.get(`${i}-${c.id}`) ?? p.y - 8
                          return (
                            <text
                              key={`lbl-${i}`}
                              x={p.x}
                              y={ly}
                              textAnchor="middle"
                              fontSize={11}
                              fontWeight={500}
                              fill={c.cor}
                            >
                              {formatLabel(p.v)}
                            </text>
                          )
                        })}
                        {/* Sigla at start of line (first non-zero point) */}
                        <text
                          x={anchor.x - 6}
                          y={siglaY.get(c.id) ?? anchor.y}
                          textAnchor="end"
                          dominantBaseline="middle"
                          fontSize={13}
                          fontWeight={700}
                          fill={c.cor}
                        >
                          {c.sigla || c.nome.slice(0, 2)}
                        </text>
                      </g>
                    )
                  })}
                </svg>
              </div>

              {/* Per-clinic monthly totals table */}
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-400">
                      <th className="text-left font-medium pr-3 pb-1.5"></th>
                      {months.map((m) => (
                        <th key={m} className="text-right font-medium px-2 pb-1.5 capitalize tabular-nums">
                          {formatMonthShort(m)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleClinicas.map((c) => (
                      <tr key={c.id} className="border-t border-gray-100">
                        <td className="py-1.5 pr-3 flex items-center gap-1.5">
                          <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.cor }} />
                          <span className="font-medium text-gray-700">{c.sigla || c.nome}</span>
                        </td>
                        {months.map((m) => {
                          const v = totals.get(m)?.get(c.id) ?? 0
                          return (
                            <td key={m} className="text-right px-2 py-1.5 tabular-nums text-gray-600">
                              {v > 0 ? formatBRL(v).replace("R$ ", "") : "—"}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
