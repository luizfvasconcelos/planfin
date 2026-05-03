"use client"

import { useState, useRef } from "react"
import { Radar } from "lucide-react"
import { formatBRL, parseDecimal } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import type { Settings } from "@/lib/types"

interface Props {
  settings: Settings
  presenceUsers: string[]
  onSaldoChange: (value: number) => Promise<void>
  onRadarOpen: () => void
}

export function SettingsHeader({ settings, presenceUsers, onSaldoChange, onRadarOpen }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = "/login"
  }

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
          <div className="flex-1">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Saldo atual</p>
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

          <div className="flex items-center gap-1">
            <button
              onClick={handleLogout}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors px-2 py-1"
              title="Sair"
            >
              Sair
            </button>
            <button
              onClick={onRadarOpen}
              className="p-2 text-gray-400 hover:text-gray-700 transition-colors rounded-lg"
              title="Radar"
            >
              <Radar size={20} />
            </button>
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
