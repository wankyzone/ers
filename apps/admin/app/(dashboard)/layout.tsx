import type { ReactNode } from "react";

import { DashboardLayout } from "@/components/layout/dashboard-layout";

interface DashboardRouteLayoutProps {
  children: ReactNode;
}

export default function DashboardRouteLayout({
  children,
}: DashboardRouteLayoutProps) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
