"use client"

import { formatBRL, formatMonthShort } from "@/lib/utils"

interface Props {
  mes: string  // YYYY-MM
  total: number
  pago: number
}

export function ContasFixasStatusCard({ mes, total, pago }: Props) {
  const falta = Math.max(total - pago, 0)
  const pct = total > 0 ? Math.min(Math.round((pago / total) * 100), 100) : 0
  const allPago = total > 0 && pago >= total

  if (total === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 text-center">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
          {formatMonthShort(mes)}
        </p>
        <p className="text-sm text-gray-300 mt-1">Sem contas neste mês.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
          {formatMonthShort(mes)}
        </p>
        <p className="text-[10px] font-semibold text-gray-500 tabular-nums">{pct}%</p>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-2.5">
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Total</p>
          <p className="text-sm font-semibold text-gray-800 tabular-nums">{formatBRL(total)}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Pago</p>
          <p className="text-sm font-semibold text-green-600 tabular-nums">{formatBRL(pago)}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Falta</p>
          <p className={`text-sm font-semibold tabular-nums ${allPago ? "text-gray-300" : "text-gray-900"}`}>
            {formatBRL(falta)}
          </p>
        </div>
      </div>

      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full bg-green-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
