"use client"

import { useState, useRef, useEffect } from "react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Check } from "lucide-react"
import { cn, formatBRL, formatMonthShort, parseDecimal } from "@/lib/utils"
import { resolveCell } from "@/lib/contas-fixas"
import type {
  ContaFixa,
  ContaFixaVigencia,
  ContaFixaCelula,
} from "@/lib/types"

interface Props {
  contas: ContaFixa[]
  months: string[]
  vigencias: ContaFixaVigencia[]
  celulas: ContaFixaCelula[]
  totalPorMes: Map<string, number>
  onContaClick: (id: string) => void
  onCellSave: (contaId: string, mes: string, valor: number | null) => void
  onPagoToggle: (contaId: string, mes: string) => void
  onReorder: (reordered: ContaFixa[]) => void
}

const NAME_COL = "w-32"  // 128px
const MES_COL = "w-20"   // 80px

// Compacta valores grandes: 1234 -> "1.234"; 12345 -> "12.345"; 123456 -> "123k".
function compact(v: number): string {
  if (v >= 100000) return `${Math.round(v / 1000)}k`
  return Math.round(v).toLocaleString("pt-BR")
}

export function ContasFixasTable({
  contas,
  months,
  vigencias,
  celulas,
  totalPorMes,
  onContaClick,
  onCellSave,
  onPagoToggle,
  onReorder,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = contas.findIndex((c) => c.id === active.id)
    const newIndex = contas.findIndex((c) => c.id === over.id)
    onReorder(arrayMove(contas, oldIndex, newIndex))
  }

  if (contas.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
        <p className="text-sm text-gray-300">Nenhuma conta cadastrada.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
      <div className="min-w-fit">
        {/* Header de meses */}
        <div className="flex border-b border-gray-100">
          <div className={cn("sticky left-0 z-10 bg-white shrink-0", NAME_COL)} />
          {months.map((m) => (
            <div
              key={m}
              className={cn(
                "shrink-0 px-1 py-2 text-center text-[10px] font-medium text-gray-400 uppercase tabular-nums",
                MES_COL
              )}
            >
              {formatMonthShort(m)}
            </div>
          ))}
        </div>

        {/* Linhas (contas) */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={contas.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            {contas.map((c) => (
              <SortableRow
                key={c.id}
                conta={c}
                months={months}
                vigencias={vigencias}
                celulas={celulas}
                onContaClick={onContaClick}
                onCellSave={onCellSave}
                onPagoToggle={onPagoToggle}
              />
            ))}
          </SortableContext>
        </DndContext>

        {/* Total */}
        <div className="flex border-t border-gray-200 bg-gray-50">
          <div
            className={cn(
              "sticky left-0 z-10 bg-gray-50 shrink-0 px-2 py-2 text-sm font-semibold text-gray-700",
              NAME_COL
            )}
          >
            Total
          </div>
          {months.map((m) => {
            const v = totalPorMes.get(m) ?? 0
            return (
              <div
                key={m}
                className={cn(
                  "shrink-0 px-1 py-2 text-right text-sm font-semibold text-gray-700 tabular-nums",
                  MES_COL
                )}
                title={formatBRL(v)}
              >
                {v > 0 ? (
                  <>
                    <span className="text-[9px] text-gray-400 mr-0.5 font-normal">R$</span>
                    {compact(v)}
                  </>
                ) : "—"}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

interface RowProps {
  conta: ContaFixa
  months: string[]
  vigencias: ContaFixaVigencia[]
  celulas: ContaFixaCelula[]
  onContaClick: (id: string) => void
  onCellSave: (contaId: string, mes: string, valor: number | null) => void
  onPagoToggle: (contaId: string, mes: string) => void
}

function SortableRow({
  conta,
  months,
  vigencias,
  celulas,
  onContaClick,
  onCellSave,
  onPagoToggle,
}: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: conta.id })

  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex border-b border-gray-100 last:border-0",
        isDragging && "opacity-40"
      )}
    >
      <div
        className={cn(
          "sticky left-0 z-10 bg-white shrink-0 flex items-center gap-1 px-1 py-2 border-r border-gray-100",
          NAME_COL
        )}
      >
        <button
          {...attributes}
          {...listeners}
          className="shrink-0 p-0.5 text-gray-200 hover:text-gray-400 cursor-grab active:cursor-grabbing touch-none"
          aria-label="Reordenar"
        >
          <GripVertical size={14} />
        </button>
        <button
          onClick={() => onContaClick(conta.id)}
          className="flex-1 min-w-0 text-left text-sm font-medium text-gray-800 truncate"
        >
          {conta.nome}
        </button>
      </div>
      {months.map((m) => {
        const r = resolveCell(conta.id, m, vigencias, celulas)
        return (
          <Cell
            key={m}
            contaId={conta.id}
            mes={m}
            resolved={r}
            onCellSave={onCellSave}
            onPagoToggle={onPagoToggle}
          />
        )
      })}
    </div>
  )
}

interface CellProps {
  contaId: string
  mes: string
  resolved: ReturnType<typeof resolveCell>
  onCellSave: (contaId: string, mes: string, valor: number | null) => void
  onPagoToggle: (contaId: string, mes: string) => void
}

function Cell({ contaId, mes, resolved, onCellSave, onPagoToggle }: CellProps) {
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  function startEdit() {
    setInput(
      resolved.value !== null
        ? String(resolved.value).replace(".", ",")
        : ""
    )
    setEditing(true)
  }

  function commit() {
    setEditing(false)
    const trimmed = input.trim()
    if (trimmed === "") {
      // Limpa override → volta a herdar
      if (resolved.source === "override") onCellSave(contaId, mes, null)
      return
    }
    const valor = parseDecimal(trimmed)
    // Só salva se mudou (evita request inútil)
    if (resolved.source === "override" && valor === resolved.value) return
    if (resolved.source !== "override" && valor === resolved.value) return
    onCellSave(contaId, mes, valor)
  }

  function cancel() {
    setEditing(false)
  }

  const hasValue = resolved.value !== null
  const isInherited = resolved.source === "vigencia"
  const isEmpty = resolved.source === "empty"

  if (editing) {
    return (
      <div
        className={cn(
          "shrink-0 px-1 py-1 border-l border-gray-100",
          MES_COL
        )}
      >
        <input
          ref={inputRef}
          inputMode="decimal"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commit() }
            else if (e.key === "Escape") { e.preventDefault(); cancel() }
          }}
          className="w-full text-right text-sm tabular-nums bg-blue-50 border border-blue-300 rounded px-1 py-1 outline-none"
        />
      </div>
    )
  }

  return (
    <div className={cn("relative shrink-0 border-l border-gray-100", MES_COL)}>
      <button
        onClick={startEdit}
        className={cn(
          "w-full h-full px-1 py-2 text-right text-sm tabular-nums hover:bg-gray-50 transition-colors",
          isEmpty && "text-gray-300",
          isInherited && "text-gray-400 italic",
          !isEmpty && !isInherited && "text-gray-900"
        )}
        title={
          hasValue
            ? `${formatBRL(resolved.value!)}${isInherited ? " (vigência)" : ""}`
            : "Sem valor"
        }
      >
        {hasValue ? (
          <>
            <span className="text-[9px] text-gray-300 mr-0.5 font-normal not-italic">R$</span>
            {compact(resolved.value!)}
          </>
        ) : "—"}
      </button>
      {hasValue && (
        <button
          onClick={() => onPagoToggle(contaId, mes)}
          className={cn(
            "absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center transition-colors",
            resolved.pago
              ? "bg-green-500 text-white"
              : "bg-gray-100 text-transparent hover:bg-gray-200"
          )}
          title={resolved.pago ? "Marcar como pendente" : "Marcar como pago"}
        >
          <Check size={9} strokeWidth={3} />
        </button>
      )}
    </div>
  )
}
