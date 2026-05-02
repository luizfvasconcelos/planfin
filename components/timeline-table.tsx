"use client"

import { formatBRL, formatDateBR, getDayOfWeek } from "@/lib/utils"
import type { DayRow } from "@/lib/types"
import { cn } from "@/lib/utils"

interface Props {
  rows: DayRow[]
  onRowClick: (row: DayRow) => void
}

export function TimelineTable({ rows, onRowClick }: Props) {
  return (
    <div className="max-w-2xl mx-auto px-2 py-3 space-y-1">
      {rows.map((row) => (
        <button
          key={row.date}
          onClick={() => onRowClick(row)}
          className={cn(
            "w-full text-left rounded-xl px-3 py-2.5 transition-colors active:scale-[0.99]",
            row.isToday
              ? "bg-blue-50 border border-blue-200 shadow-sm"
              : row.isEmpty
              ? "bg-white border border-transparent hover:bg-gray-50"
              : "bg-white border border-gray-100 hover:bg-gray-50 shadow-sm"
          )}
        >
          <div className="flex items-center gap-2">
            {/* Date + weekday */}
            <div className="w-20 shrink-0">
              <p className={cn(
                "text-xs font-medium",
                row.isToday ? "text-blue-700" : "text-gray-500"
              )}>
                {getDayOfWeek(row.date)}
              </p>
              <p className={cn(
                "text-sm font-semibold",
                row.isToday ? "text-blue-800" : row.isEmpty ? "text-gray-400" : "text-gray-800"
              )}>
                {formatDateBR(row.date)}
              </p>
            </div>

            {/* Entrada / Saída */}
            <div className="flex-1 grid grid-cols-2 gap-1">
              <div>
                {row.entrada > 0 ? (
                  <>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Entrada</p>
                    <p className="text-sm font-medium text-green-700">{formatBRL(row.entrada)}</p>
                  </>
                ) : (
                  <p className="text-sm text-gray-200">—</p>
                )}
              </div>
              <div>
                {row.saida > 0 ? (
                  <>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Saída</p>
                    <p className="text-sm font-medium text-orange-600">{formatBRL(row.saida)}</p>
                  </>
                ) : (
                  <p className="text-sm text-gray-200">—</p>
                )}
              </div>
            </div>

            {/* Acumulado */}
            <div className="text-right w-24 shrink-0">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Saldo</p>
              <p className={cn(
                "text-sm font-semibold tabular-nums",
                row.acumulado < 0 ? "text-red-600" : "text-gray-800"
              )}>
                {formatBRL(row.acumulado)}
              </p>
            </div>
          </div>

          {row.descricao && (
            <p className="mt-1 text-xs text-gray-400 truncate pl-20">{row.descricao}</p>
          )}
        </button>
      ))}
    </div>
  )
}
