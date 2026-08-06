"use client"

import { ReactNode, useState } from "react"

import { Header } from "@/components/layout/header"
import { MobileSidebar } from "@/components/layout/mobile-sidebar"
import { Sidebar } from "@/components/layout/sidebar"

interface DashboardLayoutProps {
  children: ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MobileSidebar
        open={mobileSidebarOpen}
        onOpenChange={setMobileSidebarOpen}
      />
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-h-screen flex-1 flex-col">
          <Header onOpenMobileSidebar={() => setMobileSidebarOpen(true)} />
          <main className="flex-1 overflow-y-auto px-4 pb-6 pt-4 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  )
}
