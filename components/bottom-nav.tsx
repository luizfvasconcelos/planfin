"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, CalendarDays, Receipt } from "lucide-react"
import type { LucideIcon } from "lucide-react"

interface Tab {
  href: string
  label: string
  icon?: LucideIcon
  avatarSrc?: string
}

const tabs: Tab[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/timeline", label: "Timeline", icon: CalendarDays },
  { href: "/contas-fixas", label: "Fixas", icon: Receipt },
  { href: "/faturamento", label: "Duda", avatarSrc: "/duda.png" },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-100 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-2xl mx-auto h-16 flex">
        {tabs.map(({ href, label, icon: Icon, avatarSrc }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${
                active ? "text-blue-600" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {avatarSrc ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={avatarSrc}
                  alt={label}
                  className={`w-6 h-6 rounded-full object-cover object-[50%_22%] ring-2 transition-colors ${
                    active ? "ring-blue-600" : "ring-gray-200"
                  }`}
                />
              ) : Icon ? (
                <Icon size={20} />
              ) : null}
              <span className="text-[10px] font-medium tracking-wide">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
