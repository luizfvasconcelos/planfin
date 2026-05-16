"use client"

import { useMemo } from "react"
import { formatBRL, formatMonthShort } from "@/lib/utils"

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

interface Props {
  months: string[]
  totalPorMes: Map<string, number>
}

export function ContasFixasChart({ months, totalPorMes }: Props) {
  const values = useMemo(
    () => months.map((m) => totalPorMes.get(m) ?? 0),
    [months, totalPorMes]
  )
  const hasData = values.some((v) => v > 0)
  const yMax = useMemo(() => niceCeil(Math.max(...values, 0)), [values])

  const W = 480
  const H = 200
  const PAD = { l: 28, r: 14, t: 22, b: 26 }
  const chartW = W - PAD.l - PAD.r
  const chartH = H - PAD.t - PAD.b

  const xAt = (i: number) =>
    months.length <= 1
      ? PAD.l + chartW / 2
      : PAD.l + (i / (months.length - 1)) * chartW
  const yAt = (v: number) => PAD.t + (1 - v / yMax) * chartH

  const formatLabel = (v: number) =>
    v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : String(Math.round(v))

  if (!hasData) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
        <p className="text-sm text-gray-300">Sem valores no período selecionado.</p>
      </div>
    )
  }

  const path = values
    .map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`)
    .join(" ")

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        {/* Eixo X (meses) */}
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

        {/* Linha */}
        <path
          d={path}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Pontos + labels */}
        {values.map((v, i) => (
          <g key={i}>
            <circle
              cx={xAt(i)}
              cy={yAt(v)}
              r={3}
              fill="#fff"
              stroke="#3b82f6"
              strokeWidth={2}
            >
              <title>{`${formatMonthShort(months[i])}: ${formatBRL(v)}`}</title>
            </circle>
            <text
              x={xAt(i)}
              y={yAt(v) - 8}
              textAnchor="middle"
              fontSize={11}
              fontWeight={500}
              fill="#3b82f6"
            >
              {formatLabel(v)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}
