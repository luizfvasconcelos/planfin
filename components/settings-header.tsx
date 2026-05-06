"use client"

import { useState, useRef } from "react"
import { Radar } from "lucide-react"
import { formatBRL, parseDecimal } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import type { Settings, SaldoModo } from "@/lib/types"

interface Props {
  settings: Settings
  presenceUsers: string[]
  onSaldoChange: (value: number) => Promise<void>
  onModoChange: (modo: SaldoModo) => Promise<void>
  onRadarOpen: () => void
}

export function SettingsHeader({
  settings,
  presenceUsers,
  onSaldoChange,
  onModoChange,
  onRadarOpen,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const modo = settings.saldo_modo
  const currentValue = modo === 'projetado' ? settings.saldo_projetado : settings.saldo_inicial
  const label = modo === 'projetado' ? "Saldo projetado" : "Saldo atual"

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = "/login"
  }

  function startEdit() {
    setDraft(String(currentValue).replace(".", ","))
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  async function commitEdit() {
    setEditing(false)
    const value = parseDecimal(draft)
    if (value !== currentValue) {
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
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
              <SegmentedToggle modo={modo} onChange={onModoChange} />
            </div>
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
                {formatBRL(currentValue)}
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
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

function SegmentedToggle({
  modo,
  onChange,
}: {
  modo: SaldoModo
  onChange: (m: SaldoModo) => void | Promise<void>
}) {
  const options: { value: SaldoModo; label: string }[] = [
    { value: "atual", label: "Atual" },
    { value: "projetado", label: "Projetado" },
  ]
  return (
    <div className="inline-flex bg-gray-100 rounded-full p-0.5">
      {options.map((opt) => {
        const active = modo === opt.value
        return (
          <button
            key={opt.value}
            onClick={() => !active && onChange(opt.value)}
            className={`text-[10px] font-semibold uppercase tracking-wide px-2.5 py-0.5 rounded-full transition-colors ${
              active ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
