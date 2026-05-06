"use client"

import { useEffect, useState, useCallback, useRef, useMemo } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { cn, monthRange, dateRange, formatMonthLong, isoToday } from "@/lib/utils"
import type { DudaClinica, DudaAgendaSlot, DudaEntry } from "@/lib/types"
import type { SupabaseClient } from "@supabase/supabase-js"

const WEEKDAY_HEADERS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

interface Props {
  open: boolean
  onClose: () => void
  month: string                         // "YYYY-MM"
  clinicas: DudaClinica[]
  agenda: DudaAgendaSlot[]
  entries: DudaEntry[]
  daysOff: string[]                     // YYYY-MM-DD list (current month)
  onDaysOffChange: () => void           // notify parent to refetch
}

function getJsWeekday(date: string): number {
  const [y, m, d] = date.split("-").map(Number)
  return new Date(y, m - 1, d).getDay()
}

export function PlanoMesSheet({
  open, onClose, month, clinicas, agenda, entries, daysOff, onDaysOffChange,
}: Props) {
  const sbRef = useRef<SupabaseClient | null>(null)
  const sb = useCallback(() => {
    if (!sbRef.current) sbRef.current = createClient()
    return sbRef.current
  }, [])

  const [pending, setPending] = useState<Set<string>>(new Set())
  // Local optimistic copy; resync from parent when daysOff changes
  const [localOff, setLocalOff] = useState<Set<string>>(new Set(daysOff))

  useEffect(() => {
    setLocalOff(new Set(daysOff))
  }, [daysOff])

  const today = isoToday()

  const clinicaById = useCallback(
    (id: string) => clinicas.find((c) => c.id === id),
    [clinicas]
  )

  const entryDates = useMemo(() => {
    const m = new Map<string, DudaEntry[]>()
    entries.forEach((e) => {
      if (!m.has(e.date)) m.set(e.date, [])
      m.get(e.date)!.push(e)
    })
    return m
  }, [entries])

  const slotsByWeekday = useMemo(() => {
    const m = new Map<number, DudaAgendaSlot[]>()
    agenda.forEach((s) => {
      if (!m.has(s.weekday)) m.set(s.weekday, [])
      m.get(s.weekday)!.push(s)
    })
    return m
  }, [agenda])

  // Build calendar cells for the month: leading empties + days
  const cells = useMemo(() => {
    const { start, end } = monthRange(month)
    const dates = dateRange(start, end)
    const firstWeekday = getJsWeekday(start)
    const empties: (string | null)[] = Array(firstWeekday).fill(null)
    return [...empties, ...dates] as (string | null)[]
  }, [month])

  async function toggleOff(date: string) {
    if (pending.has(date)) return
    const isCurrentlyOff = localOff.has(date)
    setPending((p) => new Set(p).add(date))

    // Optimistic update
    setLocalOff((prev) => {
      const next = new Set(prev)
      if (isCurrentlyOff) next.delete(date)
      else next.add(date)
      return next
    })

    if (isCurrentlyOff) {
      const { error } = await sb().from("duda_dia_off").delete().eq("date", date)
      if (error) {
        toast.error("Erro ao reativar dia")
        // revert
        setLocalOff((prev) => { const n = new Set(prev); n.add(date); return n })
      } else {
        onDaysOffChange()
      }
    } else {
      const { error } = await sb().from("duda_dia_off").insert({ date })
      if (error) {
        toast.error("Erro ao marcar folga")
        setLocalOff((prev) => { const n = new Set(prev); n.delete(date); return n })
      } else {
        onDaysOffChange()
      }
    }
    setPending((p) => { const n = new Set(p); n.delete(date); return n })
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto px-5">
        <SheetHeader className="mb-4">
          <SheetTitle className="capitalize">Plano · {formatMonthLong(month)}</SheetTitle>
        </SheetHeader>

        <div className="pb-6 max-w-sm mx-auto">
          <p className="text-xs text-gray-500 mb-3">
            Tap num dia da agenda pra marcar como folga (feriado, especialização, etc).
            Folgas excluem o dia da projeção.
          </p>

          <div className="grid grid-cols-7 gap-1 mb-1.5">
            {WEEKDAY_HEADERS.map((w) => (
              <div key={w} className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-center">
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((date, i) => {
              if (date === null) return <div key={`empty-${i}`} />
              const dayNum = Number(date.split("-")[2])
              const wd = getJsWeekday(date)
              const slots = slotsByWeekday.get(wd) ?? []
              const dayEntries = entryDates.get(date) ?? []
              const isOff = localOff.has(date)
              const hasEntry = dayEntries.length > 0
              const isAgendaDay = slots.length > 0
              const isToday = date === today
              const isPending = pending.has(date)

              // Cells we display: agenda clinics (default) OR entry clinics
              // Combine: prefer entry's actual clinic, else agenda default
              const entryClinicaIds = new Set(dayEntries.map((e) => e.clinica_id))
              const displayClinicas = [
                ...dayEntries.map((e) => clinicaById(e.clinica_id)).filter(Boolean) as DudaClinica[],
                ...slots
                  .map((s) => clinicaById(s.clinica_id))
                  .filter((c) => c && !entryClinicaIds.has(c.id)) as DudaClinica[],
              ]

              const isPast = date < today
              const interactive = isAgendaDay && !hasEntry && !isPast

              return (
                <button
                  key={date}
                  onClick={() => interactive && toggleOff(date)}
                  disabled={!interactive || isPending}
                  style={isOff ? {
                    backgroundColor: "#f3f4f6",
                    backgroundImage: "repeating-linear-gradient(45deg, transparent 0, transparent 4px, rgba(107, 114, 128, 0.45) 4px, rgba(107, 114, 128, 0.45) 5px)",
                  } : undefined}
                  className={cn(
                    "aspect-square rounded-md border text-left p-0.5 flex flex-col transition-all overflow-hidden",
                    isToday ? "border-blue-400 ring-1 ring-blue-200" : "border-gray-100",
                    interactive ? "hover:bg-gray-50 active:scale-95 cursor-pointer" : "cursor-default",
                    !isAgendaDay && !hasEntry && !isOff && "bg-gray-50/40",
                    isOff && "border-gray-300",
                    isPast && !hasEntry && !isOff && "opacity-60",
                    isPending && "opacity-60",
                  )}
                >
                  <span className={cn(
                    "text-[11px] font-semibold leading-none px-0.5",
                    isOff ? "text-gray-400 line-through" : "text-gray-700",
                    isToday && "text-blue-600",
                  )}>
                    {dayNum}
                  </span>
                  <div className="flex-1 flex items-end gap-0.5 flex-wrap px-0.5 pb-0.5">
                    {displayClinicas.map((c, idx) => (
                      <span
                        key={`${c.id}-${idx}`}
                        className={cn(
                          "text-[7px] font-bold leading-none px-0.5 py-0.5 rounded",
                          isOff && "line-through opacity-50",
                        )}
                        style={{
                          backgroundColor: hasEntry && entryClinicaIds.has(c.id)
                            ? c.cor
                            : `${c.cor}1a`,
                          color: hasEntry && entryClinicaIds.has(c.id) ? "#fff" : c.cor,
                        }}
                      >
                        {c.sigla || c.nome.slice(0, 2)}
                      </span>
                    ))}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-3 text-[10px] text-gray-500">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded border border-gray-200 bg-white" />
              <span>Agenda</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block w-3 h-3 rounded border border-gray-300"
                style={{
                  backgroundColor: "#f3f4f6",
                  backgroundImage: "repeating-linear-gradient(45deg, transparent 0, transparent 2px, rgba(107, 114, 128, 0.45) 2px, rgba(107, 114, 128, 0.45) 3px)",
                }}
              />
              <span>Folga</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded border border-blue-400 ring-1 ring-blue-200" />
              <span>Hoje</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block px-1 py-0.5 text-[7px] font-bold rounded bg-blue-500 text-white leading-none">XX</span>
              <span>Lançado</span>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
