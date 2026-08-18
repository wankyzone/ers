"use client"

import Link from "next/link"
import { useMemo } from "react"
import { usePathname } from "next/navigation"
import {
  BellIcon,
  ChevronRightIcon,
  LogOutIcon,
  MenuIcon,
  ShieldCheckIcon,
  SettingsIcon,
  UserIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { getSupabaseClient } from "@/lib/supabase"
import { setAuthToken } from "@/lib/api/auth"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

const breadcrumbLabels: Record<string, string> = {
  dashboard: "Dashboard",
  runners: "Runners",
  clients: "Clients",
  kyc: "KYC Reviews",
  errands: "Errands",
  analytics: "Analytics",
  settings: "Settings",
}

interface HeaderProps {
  onOpenMobileSidebar: () => void
}

export function Header({ onOpenMobileSidebar }: HeaderProps) {
  const pathname = usePathname() ?? ""

  const handleLogout = async () => {
    const supabase = getSupabaseClient()
    await supabase.auth.signOut()
    setAuthToken(null)
  }

  const breadcrumbs = useMemo(() => {
    const segments = pathname.split("/").filter(Boolean)
    const crumbs = [{ label: "Dashboard", href: "/dashboard" }]

    if (segments.length > 0 && segments[0] !== "dashboard") {
      crumbs.push({
        label: breadcrumbLabels[segments[0]] ?? segments[0],
        href: `/${segments[0]}`,
      })
    }

    return crumbs
  }, [pathname])

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="md:hidden"
              onClick={onOpenMobileSidebar}
              aria-label="Open navigation menu"
            >
              <MenuIcon className="size-5" />
            </Button>
            <div>
              <p className="text-sm font-semibold">ERS Admin Control Center</p>
              <div className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
                {breadcrumbs.map((crumb, index) => (
                  <span key={crumb.href} className="inline-flex items-center gap-2">
                    {index > 0 && <ChevronRightIcon className="size-3 text-muted-foreground" />}
                    {index === breadcrumbs.length - 1 ? (
                      <span className="font-medium text-foreground">{crumb.label}</span>
                    ) : (
                      <Link
                        href={crumb.href}
                        className="text-sm text-muted-foreground transition hover:text-foreground"
                      >
                        {crumb.label}
                      </Link>
                    )}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:block md:w-[24rem]">
              <Input
                type="search"
                placeholder="Search ERS..."
                aria-label="Search"
              />
            </div>
            <Button variant="outline" size="icon" className="hidden md:inline-flex">
              <BellIcon className="size-5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="icon" className="rounded-full">
                    <Avatar>
                      <AvatarFallback>AD</AvatarFallback>
                    </Avatar>
                  </Button>
                }
              />
              <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>Signed in as Admin</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <UserIcon className="mr-2 size-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <SettingsIcon className="mr-2 size-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <ShieldCheckIcon className="mr-2 size-4" />
                  Security
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOutIcon className="mr-2 size-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="flex flex-col gap-3 md:hidden">
          <Input type="search" placeholder="Search ERS..." aria-label="Search" />
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-3xl border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
              <BellIcon className="size-4" />
              Notifications
            </div>
            <div className="inline-flex items-center gap-2 rounded-3xl border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
              <Avatar size="sm">
                <AvatarFallback>AD</AvatarFallback>
              </Avatar>
              <span>Admin</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
