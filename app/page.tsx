"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import type { SupabaseClient } from "@supabase/supabase-js"
import { SettingsHeader } from "@/components/settings-header"
import { TimelineTable } from "@/components/timeline-table"
import { EntryEditSheet } from "@/components/entry-edit-sheet"
import { RangeManager } from "@/components/range-manager"
import { RadarSheet } from "@/components/radar-sheet"
import { Toaster } from "@/components/ui/sonner"
import { toast } from "sonner"
import { dateRange, isoToday } from "@/lib/utils"
import type { Settings, Entry, DayRow } from "@/lib/types"
import type { RealtimeChannel } from "@supabase/supabase-js"

function buildRows(settings: Settings, entries: Entry[]): DayRow[] {
  const entryMap = new Map<string, Entry>()
  entries.forEach((e) => entryMap.set(e.date, e))

  const today = isoToday()
  const dates = dateRange(settings.start_date, settings.end_date)

  let running = settings.saldo_inicial
  return dates.map((date) => {
    const entry = entryMap.get(date)
    const entrada = entry?.entrada ?? 0
    const saida = entry?.saida ?? 0
    running = running + entrada - saida
    return {
      date,
      entrada,
      saida,
      descricao: entry?.descricao ?? "",
      acumulado: running,
      isToday: date === today,
      isEmpty: !entry,
      entryId: entry?.id ?? null,
    }
  })
}

export default function HomePage() {
  // Lazy-init: createClient is never called during SSR (only after mount)
  const supabaseRef = useRef<SupabaseClient | null>(null)
  const sb = useCallback(() => {
    if (!supabaseRef.current) supabaseRef.current = createClient()
    return supabaseRef.current
  }, [])

  const [settings, setSettings] = useState<Settings | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [rows, setRows] = useState<DayRow[]>([])
  const [selectedRow, setSelectedRow] = useState<DayRow | null>(null)
  const [presenceUsers, setPresenceUsers] = useState<string[]>([])
  const [radarOpen, setRadarOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (settings) {
      setRows(buildRows(settings, entries))
    }
  }, [settings, entries])

  const fetchAll = useCallback(async () => {
    const [{ data: s }, { data: e }] = await Promise.all([
      sb().from("settings").select("*").single(),
      sb().from("entries").select("*").order("date"),
    ])
    if (s) setSettings(s as Settings)
    if (e) setEntries(e as Entry[])
    setLoading(false)
  }, [sb])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  useEffect(() => {
    if (!loading) {
      const todayEl = document.getElementById("today-row")
      todayEl?.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [loading])

  useEffect(() => {
    let channel: RealtimeChannel

    async function setupRealtime() {
      const supabase = sb()
      const { data: { user } } = await supabase.auth.getUser()
      const userEmail = user?.email ?? "Alguém"

      channel = supabase.channel("planfin-room", {
        config: { presence: { key: userEmail } },
      })

      channel
        .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, () => {
          fetchAll()
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "entries" }, () => {
          fetchAll()
        })
        .on("presence", { event: "sync" }, () => {
          const state = channel.presenceState()
          const others = Object.keys(state).filter((k) => k !== userEmail)
          setPresenceUsers(others)
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel.track({ online_at: new Date().toISOString() })
          }
        })
    }

    setupRealtime()
    return () => { sb().removeChannel(channel) }
  }, [sb, fetchAll])

  async function handleSaldoChange(value: number) {
    const { error } = await sb()
      .from("settings")
      .update({ saldo_inicial: value })
      .eq("id", 1)
    if (error) toast.error("Erro ao salvar saldo inicial")
    else setSettings((prev) => prev ? { ...prev, saldo_inicial: value } : prev)
  }

  async function handleSaveEntry(
    date: string,
    entrada: number,
    saida: number,
    descricao: string
  ) {
    const supabase = sb()
    const { data: { user } } = await supabase.auth.getUser()
    const isEmpty = entrada === 0 && saida === 0 && descricao === ""
    const existing = entries.find((e) => e.date === date)

    if (isEmpty && existing) {
      const { error } = await supabase.from("entries").delete().eq("id", existing.id)
      if (error) toast.error("Erro ao deletar entrada")
      else setEntries((prev) => prev.filter((e) => e.id !== existing.id))
      return
    }

    if (isEmpty) return

    if (existing) {
      const { data, error } = await supabase
        .from("entries")
        .update({ entrada, saida, descricao, updated_by: user?.id })
        .eq("id", existing.id)
        .select()
        .single()
      if (error) toast.error("Erro ao salvar")
      else setEntries((prev) => prev.map((e) => (e.id === existing.id ? (data as Entry) : e)))
    } else {
      const { data, error } = await supabase
        .from("entries")
        .insert({ date, entrada, saida, descricao, updated_by: user?.id })
        .select()
        .single()
      if (error) toast.error("Erro ao salvar")
      else setEntries((prev) => [...prev, data as Entry].sort((a, b) => a.date.localeCompare(b.date)))
    }
  }

  async function handleRemoveStart(newStartDate: string) {
    const supabase = sb()
    const { error: delError } = await supabase
      .from("entries")
      .delete()
      .lt("date", newStartDate)
    if (delError) { toast.error("Erro ao remover entradas"); return }

    const { error } = await supabase
      .from("settings")
      .update({ start_date: newStartDate })
      .eq("id", 1)
    if (error) toast.error("Erro ao atualizar período")
    else {
      setSettings((prev) => prev ? { ...prev, start_date: newStartDate } : prev)
      setEntries((prev) => prev.filter((e) => e.date >= newStartDate))
      toast.success("Período atualizado")
    }
  }

  async function handleExtendEnd(newEndDate: string) {
    const { error } = await sb()
      .from("settings")
      .update({ end_date: newEndDate })
      .eq("id", 1)
    if (error) toast.error("Erro ao atualizar período")
    else {
      setSettings((prev) => prev ? { ...prev, end_date: newEndDate } : prev)
      toast.success("Período atualizado")
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400 text-sm">Carregando…</p>
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-500 text-sm">Erro ao carregar configurações.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SettingsHeader
        settings={settings}
        presenceUsers={presenceUsers}
        onSaldoChange={handleSaldoChange}
        onRadarOpen={() => setRadarOpen(true)}
      />

      <main className="pb-32">
        <TimelineTable rows={rows} onRowClick={setSelectedRow} />
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-10 bg-white border-t border-gray-100">
        <RangeManager
          settings={settings}
          onRemoveStart={handleRemoveStart}
          onExtendEnd={handleExtendEnd}
        />
      </div>

      <EntryEditSheet
        row={selectedRow}
        onClose={() => setSelectedRow(null)}
        onSave={handleSaveEntry}
      />

      <RadarSheet open={radarOpen} onClose={() => setRadarOpen(false)} />

      <Toaster />
    </div>
  )
}
