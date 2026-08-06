"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3Icon,
  BriefcaseIcon,
  HomeIcon,
  ListChecksIcon,
  SettingsIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "lucide-react"

import { navigation } from "@/lib/navigation"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

const navigationIcons: Record<string, typeof HomeIcon> = {
  Dashboard: HomeIcon,
  Runners: UsersIcon,
  Clients: BriefcaseIcon,
  "KYC Reviews": ShieldCheckIcon,
  Errands: ListChecksIcon,
  Analytics: BarChart3Icon,
  Settings: SettingsIcon,
}

export function Sidebar() {
  const pathname = usePathname() ?? ""

  return (
    <aside className="hidden w-72 shrink-0 flex-col border-r border-border bg-background/95 px-4 py-6 md:flex">
      <div className="flex flex-col gap-8">
        <div className="flex items-center gap-3 rounded-3xl bg-muted px-4 py-3 shadow-sm ring-1 ring-border/50">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <span className="text-lg font-semibold">E</span>
          </div>
          <div>
            <p className="text-sm font-semibold">ERS Control Center</p>
            <p className="text-xs text-muted-foreground">Admin workspace</p>
          </div>
        </div>
        <nav aria-label="Dashboard navigation" className="space-y-1">
          {navigation.map((item) => {
            const Icon = navigationIcons[item.label] ?? HomeIcon
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`)

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-3 rounded-3xl px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "size-4 transition-colors",
                    active ? "text-primary-foreground" : "text-muted-foreground"
                  )}
                />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
      <Separator className="my-6" />
      <div className="rounded-3xl border border-border bg-muted p-4 text-sm text-muted-foreground">
        <p className="font-semibold text-foreground">Admin tools</p>
        <p className="mt-2 leading-6">
          Review system workflows, manage users, and keep ERS operations running smoothly.
        </p>
      </div>
    </aside>
  )
}
