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
  XIcon,
} from "lucide-react"

import { navigation } from "@/lib/navigation"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
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

interface MobileSidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MobileSidebar({ open, onOpenChange }: MobileSidebarProps) {
  const pathname = usePathname() ?? ""

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="flex h-full min-h-screen max-w-xs flex-col bg-background px-0 py-4"
      >
        <SheetHeader className="px-5 pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground">
                <span className="text-lg font-semibold">E</span>
              </div>
              <div>
                <SheetTitle className="text-base">ERS Control Center</SheetTitle>
                <p className="text-sm text-muted-foreground">Mobile navigation</p>
              </div>
            </div>
            <SheetClose>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground transition hover:bg-muted/80"
                aria-label="Close sidebar"
              >
                <XIcon className="size-5" />
              </button>
            </SheetClose>
          </div>
        </SheetHeader>
        <Separator className="mx-5" />
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pt-4">
          {navigation.map((item) => {
            const Icon = navigationIcons[item.label] ?? HomeIcon
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`)

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => onOpenChange(false)}
                className={cn(
                  "flex items-center gap-3 rounded-3xl px-4 py-3 text-sm font-medium transition",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted"
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
        <Separator className="mx-5 mt-4" />
        <div className="mt-4 px-5 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">Admin insights</p>
          <p className="mt-2 leading-6">
            Use the menu to navigate ERS workflows and manage admin tasks on the go.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
