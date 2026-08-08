import type { ReactNode } from "react";

import { AdminAuthProvider } from "@/components/auth/admin-auth-provider";
import { DashboardLayout } from "@/components/layout/dashboard-layout";

interface DashboardRouteLayoutProps {
  children: ReactNode;
}

export default function DashboardRouteLayout({
  children,
}: DashboardRouteLayoutProps) {
  return (
    <AdminAuthProvider>
      <DashboardLayout>{children}</DashboardLayout>
    </AdminAuthProvider>
  );
}
