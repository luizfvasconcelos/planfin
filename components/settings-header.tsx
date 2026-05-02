"use client"

import { useState, useRef } from "react"
import { formatBRL, parseDecimal } from "@/lib/utils"
import type { Settings, DayRow } from "@/lib/types"

interface Props {
  settings: Settings
  rows: DayRow[]
  presenceUsers: string[]
  onSaldoChange: (value: number) => Promise<void>
}

export function SettingsHeader({ settings, rows, presenceUsers, onSaldoChange }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const saldoFinal = rows.length > 0 ? rows[rows.length - 1].acumulado : settings.saldo_inicial

  function startEdit() {
    setDraft(String(settings.saldo_inicial).replace(".", ","))
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  async function commitEdit() {
    setEditing(false)
    const value = parseDecimal(draft)
    if (value !== settings.saldo_inicial) {
      await onSaldoChange(value)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") commitEdit()
    if (e.key === "Escape") setEditing(false)
  }

  const otherUsers = presenceUsers.filter(Boolean)

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-2xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Saldo inicial</p>
            {editing ? (
              <input
                ref={inputRef}
                className="text-lg font-semibold text-gray-900 w-36 border-b-2 border-blue-500 outline-none bg-transparent"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={handleKeyDown}
              />
            ) : (
              <button
                onClick={startEdit}
                className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors text-left"
                title="Clique para editar"
              >
                {formatBRL(settings.saldo_inicial)}
              </button>
            )}
          </div>

          <div className="text-right">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Saldo final projetado</p>
            <p
              className={`text-lg font-semibold ${
                saldoFinal < 0 ? "text-red-600" : "text-green-700"
              }`}
            >
              {formatBRL(saldoFinal)}
            </p>
          </div>
        </div>

        {otherUsers.length > 0 && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-gray-500">
              {otherUsers.join(", ")} online agora
            </span>
          </div>
        )}
      </div>
    </header>
  )
}
