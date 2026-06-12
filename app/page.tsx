"use client"

import Link from "next/link"
import { CalendarDays, Receipt, Wallet, Target, ChevronRight } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { CSSProperties } from "react"
import { createClient } from "@/lib/supabase/client"

interface Section {
  href: string
  title: string
  sub: string
  color: string
  icon?: LucideIcon
  avatarSrc?: string
}

// Cor de seção do DESIGN.md (timeline azul, fixas âmbar, gastos roxo,
// orçamento rosa, Duda verde). A cor vira a âncora visual de cada card.
const sections: Section[] = [
  { href: "/timeline", title: "Timeline", sub: "Fluxo de caixa diário", color: "#2563eb", icon: CalendarDays },
  { href: "/contas-fixas", title: "Contas Fixas", sub: "Despesas recorrentes", color: "#d97706", icon: Receipt },
  { href: "/gastos", title: "Gastos Variáveis", sub: "Registro do dia-a-dia", color: "#9333ea", icon: Wallet },
  { href: "/orcamento", title: "Orçamento", sub: "Teto por período", color: "#e11d48", icon: Target },
  { href: "/faturamento", title: "Faturamento Duda", sub: "Renda variável diária", color: "#16a34a", avatarSrc: "/duda.png" },
]

export default function HomePage() {
  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = "/login"
  }

  return (
    <div
      className="min-h-screen flex flex-col bg-repeat"
      style={{ backgroundImage: "url('/cover-bg.png')", backgroundSize: "260px auto" }}
    >
      <header className="px-5 pt-6 pb-2 flex items-center justify-end">
        <button
          onClick={handleLogout}
          className="text-xs text-gray-500 hover:text-gray-800 transition-colors px-3 py-1.5 rounded-full bg-white/70 backdrop-blur-sm border border-white/80"
        >
          Sair
        </button>
      </header>

      <main className="flex-1 flex flex-col justify-center max-w-2xl w-full mx-auto px-5 pb-10 gap-4">
        <div className="mb-2 text-center">
          <div className="w-full rounded-2xl border border-white/60 bg-white/75 backdrop-blur-md px-6 py-7 shadow-[0_4px_24px_rgba(17,24,39,0.08)]">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-gray-400">Controle de Finanças</p>
            <h1 className="text-5xl font-extrabold tracking-tighter text-gray-900 mt-1.5 leading-none">PlanFin</h1>
          </div>
        </div>

        {sections.map((section, i) => (
          <SectionCard key={section.href} section={section} index={i} />
        ))}
      </main>
    </div>
  )
}

function SectionCard({ section, index }: { section: Section; index: number }) {
  const { href, title, sub, color, icon: Icon, avatarSrc } = section

  return (
    <Link
      href={href}
      style={{ animationDelay: `${index * 60}ms` } as CSSProperties}
      className="group flex items-center gap-4 rounded-2xl border border-white/60 bg-white/70 backdrop-blur-md px-5 py-5 shadow-[0_4px_24px_rgba(17,24,39,0.08)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-white/85 hover:shadow-[0_10px_34px_rgba(17,24,39,0.14)] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-500"
    >
      {avatarSrc ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={avatarSrc}
          alt={title}
          className="h-14 w-14 shrink-0 rounded-full object-cover object-[50%_22%]"
          style={{ boxShadow: `0 0 0 2px ${color}, 0 6px 16px ${color}40` }}
        />
      ) : Icon ? (
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white transition-transform duration-300 ease-out group-hover:scale-105"
          style={{ backgroundColor: color, boxShadow: `0 6px 16px ${color}55` }}
        >
          <Icon size={26} strokeWidth={2.2} />
        </div>
      ) : null}

      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-600">{sub}</p>
      </div>

      <ChevronRight
        size={20}
        className="shrink-0 text-gray-400 transition-transform duration-300 ease-out group-hover:translate-x-0.5"
      />
    </Link>
  )
}
