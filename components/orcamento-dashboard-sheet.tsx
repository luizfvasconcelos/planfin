"use client"

import { useMemo } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { cn, formatBRL } from "@/lib/utils"
import { computeStats, formatPeriodo } from "@/lib/orcamento"
import type { GastoVariavel, Orcamento } from "@/lib/types"

interface Props {
  open: boolean
  onClose: () => void
  orcamentos: Orcamento[]
  gastos: GastoVariavel[]
}

interface Row {
  orcamento: Orcamento
  pct: number       // 0..1+
  gasto: number
  delta: number     // gasto - teto (positivo = estourou)
  status: "cumpriu" | "estourou" | "em_andamento" | "futuro"
}

const COR_OK = "#10b981"
const COR_ESTOUROU = "#ef4444"
const COR_ATIVO = "#3b82f6"
const COR_FUTURO = "#9ca3af"

export function OrcamentoDashboardSheet({ open, onClose, orcamentos, gastos }: Props) {
  // Computa linha por orçamento, ordenado do mais antigo pro mais novo
  // (eixo X cresce com o tempo, leitura natural esquerda → direita).
  const rows: Row[] = useMemo(() => {
    return orcamentos
      .slice()
      .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio))
      .map((o) => {
        const stats = computeStats(o, gastos)
        const teto = Number(o.valor_teto)
        const delta = stats.gasto - teto
        let status: Row["status"]
        if (stats.status === "futuro") status = "futuro"
        else if (stats.status === "ativo") status = "em_andamento"
        else status = stats.pctConsumido > 1 ? "estourou" : "cumpriu"
        return { orcamento: o, pct: stats.pctConsumido, gasto: stats.gasto, delta, status }
      })
  }, [orcamentos, gastos])

  // KPIs — só sobre orçamentos encerrados (cumprido/estourou). Em andamento
  // e futuros não entram no track record porque ainda não há veredito.
  const closed = rows.filter((r) => r.status === "cumpriu" || r.status === "estourou")
  const cumpridos = closed.filter((r) => r.status === "cumpriu").length
  const estourados = closed.filter((r) => r.status === "estourou").length
  const taxa = closed.length > 0 ? cumpridos / closed.length : 0
  const totalEconomizado = closed
    .filter((r) => r.status === "cumpriu")
    .reduce((s, r) => s + (Number(r.orcamento.valor_teto) - r.gasto), 0)
  const totalEstourado = closed
    .filter((r) => r.status === "estourou")
    .reduce((s, r) => s + r.delta, 0)

  // Layout do gráfico de barras — escala Y vai de 0 a max(120%, maior pct).
  const yMax = Math.max(1.2, ...rows.map((r) => r.pct))

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto px-5">
        <SheetHeader className="mb-4">
          <SheetTitle>Dashboard de orçamentos</SheetTitle>
        </SheetHeader>

        <div className="pb-6 space-y-4">
          {rows.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              Sem orçamentos pra avaliar ainda.
            </p>
          ) : (
            <>
              {/* KPIs */}
              <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
                {closed.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center">
                    Nenhum orçamento encerrado ainda. O veredito sai quando o período termina.
                  </p>
                ) : (
                  <>
                    <div className="flex items-baseline justify-between">
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">Taxa de cumprimento</p>
                        <p className={cn(
                          "text-2xl font-semibold tabular-nums",
                          taxa >= 0.7 ? "text-emerald-600" : taxa >= 0.4 ? "text-amber-600" : "text-red-600"
                        )}>
                          {Math.round(taxa * 100)}%
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">Encerrados</p>
                        <p className="text-sm font-semibold text-gray-700 tabular-nums">
                          <span className="text-emerald-600">{cumpridos}</span>
                          <span className="text-gray-300 mx-1">·</span>
                          <span className="text-red-600">{estourados}</span>
                        </p>
                        <p className="text-[10px] text-gray-400">cumpriu · estourou</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                      <div>
                        <p className="text-[10px] text-emerald-600 uppercase tracking-wide">Economizou</p>
                        <p className="text-sm font-semibold text-emerald-600 tabular-nums">
                          {formatBRL(totalEconomizado)}
                        </p>
                        <p className="text-[10px] text-gray-400">soma dos cumpridos</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-red-600 uppercase tracking-wide">Estourou</p>
                        <p className="text-sm font-semibold text-red-600 tabular-nums">
                          {formatBRL(totalEstourado)}
                        </p>
                        <p className="text-[10px] text-gray-400">soma dos estouros</p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Gráfico de barras */}
              <div className="bg-white rounded-xl border border-gray-100 p-3 space-y-2">
                <p className="text-xs text-gray-400 uppercase tracking-wide font-medium px-1">
                  % do teto consumido por orçamento
                </p>
                <BarChart rows={rows} yMax={yMax} />
                <Legend />
              </div>

              {/* Lista compacta */}
              <div className="space-y-2">
                <p className="text-xs text-gray-400 uppercase tracking-wide font-medium px-1">
                  Detalhe
                </p>
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  {rows.slice().reverse().map((r) => (
                    <RowItem key={r.orcamento.id} row={r} />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// --- Gráfico de barras --------------------------------------------------

function BarChart({ rows, yMax }: { rows: Row[]; yMax: number }) {
  // SVG layout
  const W = 480
  const H = 220
  const PAD = { l: 32, r: 14, t: 18, b: 38 }
  const chartW = W - PAD.l - PAD.r
  const chartH = H - PAD.t - PAD.b

  const n = rows.length
  // Largura de cada barra com gap proporcional.
  const slotW = n > 0 ? chartW / n : chartW
  const barW = Math.min(40, slotW * 0.6)
  const barX = (i: number) => PAD.l + i * slotW + (slotW - barW) / 2

  const yAt = (pct: number) => PAD.t + (1 - pct / yMax) * chartH
  const y100 = yAt(1)

  // Marcadores do eixo Y: 0%, 50%, 100%, e o topo do yMax arredondado.
  const yTicks = [0, 0.5, 1]
  if (yMax > 1.2) yTicks.push(Math.ceil(yMax * 10) / 10)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      {/* Grid + labels Y */}
      {yTicks.map((t) => (
        <g key={t}>
          <line
            x1={PAD.l}
            x2={W - PAD.r}
            y1={yAt(t)}
            y2={yAt(t)}
            stroke={t === 1 ? "#d1d5db" : "#f3f4f6"}
            strokeWidth={t === 1 ? 1.5 : 1}
            strokeDasharray={t === 1 ? "4 3" : "0"}
          />
          <text
            x={PAD.l - 4}
            y={yAt(t) + 3}
            textAnchor="end"
            fontSize={10}
            fill="#9ca3af"
          >
            {Math.round(t * 100)}%
          </text>
        </g>
      ))}

      {/* Barras */}
      {rows.map((r, i) => {
        const x = barX(i)
        const y = yAt(r.pct)
        const h = chartH - (y - PAD.t)
        const color =
          r.status === "estourou" ? COR_ESTOUROU
          : r.status === "cumpriu" ? COR_OK
          : r.status === "em_andamento" ? COR_ATIVO
          : COR_FUTURO
        const pctLabel = `${Math.round(r.pct * 100)}%`
        return (
          <g key={r.orcamento.id}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={Math.max(0, h)}
              fill={color}
              rx={2}
              opacity={r.status === "futuro" ? 0.4 : r.status === "em_andamento" ? 0.6 : 1}
            >
              <title>
                {`${formatPeriodo(r.orcamento)}\nTeto: ${formatBRL(Number(r.orcamento.valor_teto))}\nGastou: ${formatBRL(r.gasto)} (${pctLabel})`}
              </title>
            </rect>
            {/* Rótulo do % no topo da barra */}
            {r.status !== "futuro" && (
              <text
                x={x + barW / 2}
                y={Math.max(PAD.t + 9, y - 4)}
                textAnchor="middle"
                fontSize={10}
                fontWeight={500}
                fill={color}
              >
                {pctLabel}
              </text>
            )}
            {/* Período abaixo do eixo X */}
            <text
              x={x + barW / 2}
              y={H - PAD.b + 12}
              textAnchor="middle"
              fontSize={9}
              fill="#9ca3af"
            >
              {formatPeriodo(r.orcamento).split("–")[0].trim().slice(0, 6)}
            </text>
            <text
              x={x + barW / 2}
              y={H - PAD.b + 22}
              textAnchor="middle"
              fontSize={9}
              fill="#9ca3af"
            >
              {(() => {
                const parts = formatPeriodo(r.orcamento).split("–")
                if (parts.length < 2) return ""
                const fim = parts[1].trim()
                return fim.slice(0, 7)
              })()}
            </text>
          </g>
        )
      })}

      {/* Linha "TETO" — destaque após as barras pra ficar por cima */}
      <text
        x={W - PAD.r}
        y={y100 - 4}
        textAnchor="end"
        fontSize={9}
        fontWeight={600}
        fill="#6b7280"
      >
        TETO
      </text>
    </svg>
  )
}

function Legend() {
  const items: Array<{ color: string; label: string }> = [
    { color: COR_OK, label: "Cumpriu" },
    { color: COR_ESTOUROU, label: "Estourou" },
    { color: COR_ATIVO, label: "Em andamento" },
    { color: COR_FUTURO, label: "Futuro" },
  ]
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 px-1">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1 text-[10px] text-gray-500">
          <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  )
}

// --- Item da lista compacta ---------------------------------------------

function RowItem({ row }: { row: Row }) {
  const teto = Number(row.orcamento.valor_teto)
  const statusLabel =
    row.status === "cumpriu" ? "✓ Cumpriu"
    : row.status === "estourou" ? "✗ Estourou"
    : row.status === "em_andamento" ? "Em andamento"
    : "Futuro"
  const statusColor =
    row.status === "cumpriu" ? "text-emerald-600"
    : row.status === "estourou" ? "text-red-600"
    : row.status === "em_andamento" ? "text-blue-600"
    : "text-gray-400"

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-gray-100 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800 capitalize">
          {formatPeriodo(row.orcamento)}
        </p>
        <p className="text-xs text-gray-400 tabular-nums">
          {formatBRL(row.gasto)} de {formatBRL(teto)} · {Math.round(row.pct * 100)}%
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className={cn("text-xs font-semibold", statusColor)}>{statusLabel}</p>
        {(row.status === "cumpriu" || row.status === "estourou") && (
          <p className={cn(
            "text-[10px] tabular-nums",
            row.status === "cumpriu" ? "text-emerald-600" : "text-red-600"
          )}>
            {row.status === "cumpriu"
              ? `economizou ${formatBRL(-row.delta).replace("R$ ", "R$ ")}`
              : `+${formatBRL(row.delta).replace("R$ ", "R$ ")}`}
          </p>
        )}
      </div>
    </div>
  )
}
