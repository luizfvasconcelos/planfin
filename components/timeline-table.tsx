"use client"

import { TrendingDown } from "lucide-react"
import { formatBRL, formatDateShort, getDayOfWeek } from "@/lib/utils"
import type { DayRow } from "@/lib/types"
import { cn } from "@/lib/utils"

function isWeekend(date: string): boolean {
  const [y, m, d] = date.split("-").map(Number)
  const day = new Date(y, m - 1, d).getDay()
  return day === 0 || day === 6
}

interface Props {
  rows: DayRow[]
  onRowClick: (row: DayRow) => void
}

export function TimelineTable({ rows, onRowClick }: Props) {
  return (
    <div className="max-w-2xl mx-auto py-3 relative">
      {/* Linha vertical contínua — alinhada ao centro da coluna de dots (w-10 = 40px → left-5 = 20px) */}
      <div className="absolute top-0 bottom-0 left-5 w-px bg-gray-200 pointer-events-none" />

      {rows.map((row, index) => {
        const weekend = isWeekend(row.date)
        const negative = row.acumulado < 0
        const prevNegative = index > 0 && rows[index - 1].acumulado < 0
        const isBreakPoint = negative && !prevNegative

        if (row.isEmpty) {
          return (
            <button
              key={row.date}
              onClick={() => onRowClick(row)}
              className={cn(
                "w-full flex items-center min-h-[44px] px-2 text-left",
                weekend && "bg-gray-50/50"
              )}
            >
              {/* Dot: outline, vazio */}
              <div className="relative z-10 w-10 shrink-0 flex justify-center">
                <div className={cn(
                  "rounded-full border border-gray-300 bg-white",
                  row.isToday ? "w-3 h-3 border-gray-500" : "w-2 h-2"
                )} />
              </div>

              {/* Data */}
              <div className="flex items-baseline gap-1.5">
                <span className={cn(
                  "text-sm",
                  row.isToday ? "text-gray-700 font-semibold" : "text-gray-300"
                )}>
                  {formatDateShort(row.date)}
                </span>
                <span className={cn(
                  "text-xs",
                  row.isToday ? "text-gray-600 font-medium" : "text-gray-300"
                )}>
                  {getDayOfWeek(row.date)}
                </span>
              </div>
            </button>
          )
        }

        return (
          <button
            key={row.date}
            onClick={() => onRowClick(row)}
            className={cn(
              "w-full flex flex-col min-h-[44px] px-2 py-2.5 text-left",
              weekend ? "bg-gray-50/40" : "bg-white",
              row.isToday ? "border-y border-gray-200" : "border-b border-gray-100/60"
            )}
          >
            {/* Linha 1: dot + data + dia da semana */}
            <div className="flex items-center w-full">
              <div className="relative z-10 w-10 shrink-0 flex justify-center">
                <div className={cn(
                  "rounded-full bg-gray-500",
                  row.isToday ? "w-3.5 h-3.5 bg-gray-800" : "w-2.5 h-2.5"
                )} />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className={cn(
                  "text-sm font-semibold",
                  negative ? "text-red-400" : row.isToday ? "text-gray-900" : "text-gray-800"
                )}>
                  {formatDateShort(row.date)}
                </span>
                <span className={cn(
                  "text-xs font-medium",
                  negative ? "text-red-300" : row.isToday ? "text-gray-700" : "text-gray-500"
                )}>
                  {getDayOfWeek(row.date)}
                </span>
                {isBreakPoint && (
                  <TrendingDown size={14} strokeWidth={2.4} className="self-center text-red-600" />
                )}
              </div>
            </div>

            {/* Linha 2: entrada / saída / saldo — grid fixo pra preservar colunas mesmo quando uma delas está vazia */}
            <div className="grid grid-cols-[1fr_1fr_auto] items-start gap-4 pl-10 pt-1.5">
              <div>
                {row.entrada > 0 && (
                  <>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Entrada</p>
                    <p className="text-sm font-medium text-gray-800">{formatBRL(row.entrada)}</p>
                    {row.descricao && row.saida === 0 && (
                      <p className="text-xs text-gray-400 truncate pt-1">{row.descricao}</p>
                    )}
                  </>
                )}
              </div>
              <div>
                {row.saida > 0 && (
                  <>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Saída</p>
                    <p className="text-sm font-medium text-gray-800">{formatBRL(row.saida)}</p>
                    {row.descricao && row.entrada === 0 && (
                      <p className="text-xs text-gray-400 truncate pt-1">{row.descricao}</p>
                    )}
                  </>
                )}
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Saldo</p>
                <p className={cn(
                  "text-sm font-semibold tabular-nums",
                  negative ? "text-red-500 font-bold" : "text-gray-600"
                )}>
                  {formatBRL(row.acumulado)}
                </p>
              </div>
            </div>

            {row.descricao && row.entrada > 0 && row.saida > 0 && (
              <p className="text-xs text-gray-400 truncate pl-10 pt-1.5">{row.descricao}</p>
            )}
          </button>
        )
      })}
    </div>
  )
}
