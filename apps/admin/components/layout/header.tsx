"use client"

import Link from "next/link"
import { useEffect, useMemo } from "react"
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
import { getAdminNotifications } from "@/lib/api/notifications"
import { useApi } from "@/hooks/useApi"
import { useAsync } from "@/hooks/useAsync"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

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

function formatNotificationCount(count: number): string {
  return count > 99 ? "99+" : String(count)
}

export function Header({ onOpenMobileSidebar }: HeaderProps) {
  const pathname = usePathname() ?? ""
  const api = useApi()

  const {
    data: notificationData,
    error: notificationError,
    isLoading: notificationsLoading,
    run: runNotifications,
  } = useAsync(
    () => getAdminNotifications(api),
    { executeOnMount: true },
  )

  useEffect(() => {
    const interval = window.setInterval(() => {
      void runNotifications()
    }, 60_000)

    return () => window.clearInterval(interval)
  }, [runNotifications])

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

  const notifications = notificationData?.notifications ?? []
  const activeAlertCount = notificationData?.activeAlertCount ?? 0

  const notificationMenu = (
    <>
      <DropdownMenuLabel className="flex items-center justify-between gap-4">
        <span>Notifications</span>
        {activeAlertCount > 0 && (
          <span className="rounded-full bg-destructive px-2 py-0.5 text-xs font-medium text-destructive-foreground">
            {formatNotificationCount(activeAlertCount)}
          </span>
        )}
      </DropdownMenuLabel>

      <DropdownMenuSeparator />

      {notificationsLoading ? (
        <DropdownMenuItem disabled>
          Loading notifications...
        </DropdownMenuItem>
      ) : notificationError ? (
        <DropdownMenuItem disabled>
          Unable to load notifications.
        </DropdownMenuItem>
      ) : notifications.length === 0 ? (
        <DropdownMenuItem disabled>
          You're all caught up.
        </DropdownMenuItem>
      ) : (
        notifications.map((notification) => (
          <DropdownMenuItem
            key={notification.id}
            render={<Link href={notification.href} />}
          >
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex items-center gap-2">
                <span
                  className={`size-2 shrink-0 rounded-full ${
                    notification.type === "action"
                      ? "bg-destructive"
                      : "bg-muted-foreground"
                  }`}
                  aria-hidden="true"
                />
                <span className="truncate font-medium">
                  {notification.title}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {notification.description}
              </span>
            </div>
          </DropdownMenuItem>
        ))
      )}
    </>
  )

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
                  <span
                    key={crumb.href}
                    className="inline-flex items-center gap-2"
                  >
                    {index > 0 && (
                      <ChevronRightIcon className="size-3 text-muted-foreground" />
                    )}

                    {index === breadcrumbs.length - 1 ? (
                      <span className="font-medium text-foreground">
                        {crumb.label}
                      </span>
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

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    className="relative hidden md:inline-flex"
                    aria-label={
                      activeAlertCount > 0
                        ? `${activeAlertCount} active notifications`
                        : "Notifications"
                    }
                  >
                    <BellIcon className="size-5" />

                    {activeAlertCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
                        {formatNotificationCount(activeAlertCount)}
                      </span>
                    )}
                  </Button>
                }
              />

              <DropdownMenuContent
                align="end"
                className="w-80 border border-border bg-popover/95 shadow-xl shadow-black/40 backdrop-blur-sm"
              >
                {notificationMenu}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-full"
                  >
                    <Avatar>
                      <AvatarFallback>AD</AvatarFallback>
                    </Avatar>
                  </Button>
                }
              />

              <DropdownMenuContent className="w-56 border border-border bg-popover/95 shadow-xl shadow-black/40 backdrop-blur-sm">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Signed in as Admin</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                </DropdownMenuGroup>

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
          <Input
            type="search"
            placeholder="Search ERS..."
            aria-label="Search"
          />

          <div className="flex items-center justify-between gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    className="relative rounded-3xl"
                    aria-label={
                      activeAlertCount > 0
                        ? `${activeAlertCount} active notifications`
                        : "Notifications"
                    }
                  >
                    <BellIcon className="size-4" />
                    Notifications

                    {activeAlertCount > 0 && (
                      <span className="flex min-h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
                        {formatNotificationCount(activeAlertCount)}
                      </span>
                    )}
                  </Button>
                }
              />

              <DropdownMenuContent
                align="start"
                className="w-[calc(100vw-2rem)] max-w-80 border border-border bg-popover/95 shadow-xl shadow-black/40 backdrop-blur-sm"
              >
                {notificationMenu}
              </DropdownMenuContent>
            </DropdownMenu>

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
