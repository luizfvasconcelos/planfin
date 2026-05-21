"use client"

import Link from "next/link"
import { CalendarDays, Receipt, Wallet, Target } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

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
        <div className="text-center mb-4">
          <div className="inline-block px-7 py-4 rounded-3xl bg-white/85 backdrop-blur-md shadow-lg border border-white/80">
            <h1 className="text-4xl font-extrabold tracking-tight text-gray-900">
              PlanFin
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">Controle de fluxo de caixa</p>
          </div>
        </div>

        <Link
          href="/timeline"
          className="group bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md hover:border-blue-200 transition-all px-6 py-7 flex items-center gap-5"
        >
          <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-100 transition-colors">
            <CalendarDays size={28} />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900">Timeline</h2>
            <p className="text-sm text-gray-500">Fluxo de caixa diário</p>
          </div>
        </Link>

        <Link
          href="/contas-fixas"
          className="group bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md hover:border-amber-200 transition-all px-6 py-7 flex items-center gap-5"
        >
          <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 group-hover:bg-amber-100 transition-colors">
            <Receipt size={28} />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900">Contas Fixas</h2>
            <p className="text-sm text-gray-500">Despesas recorrentes</p>
          </div>
        </Link>

        <Link
          href="/gastos"
          className="group bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md hover:border-purple-200 transition-all px-6 py-7 flex items-center gap-5"
        >
          <div className="w-14 h-14 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 group-hover:bg-purple-100 transition-colors">
            <Wallet size={28} />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900">Gastos Variáveis</h2>
            <p className="text-sm text-gray-500">Registro do dia-a-dia</p>
          </div>
        </Link>

        <Link
          href="/orcamento"
          className="group bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md hover:border-rose-200 transition-all px-6 py-7 flex items-center gap-5"
        >
          <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600 group-hover:bg-rose-100 transition-colors">
            <Target size={28} />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900">Orçamento</h2>
            <p className="text-sm text-gray-500">Teto por período</p>
          </div>
        </Link>

        <Link
          href="/faturamento"
          className="group bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md hover:border-green-200 transition-all px-6 py-7 flex items-center gap-5"
        >
          <div className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-green-100 group-hover:ring-green-200 transition-colors flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/duda.png"
              alt="Duda"
              className="w-full h-full object-cover object-[50%_22%]"
            />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900">Faturamento Duda</h2>
            <p className="text-sm text-gray-500">Renda variável diária</p>
          </div>
        </Link>
      </main>
    </div>
  )
}
