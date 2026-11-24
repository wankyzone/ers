import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCustomerUser } from "../../lib/customer-profile";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import CustomerSignOut from "./sign-out";

export const dynamic = "force-dynamic";

export default async function CustomerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createSupabaseServerClient();
  const { user } = await requireCustomerUser(supabase);
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-[#080d0a] text-white">
      <header className="border-b border-white/10">
        <nav className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/customer" className="font-display text-lg font-bold tracking-tight">
            ERS <span className="text-[#19c963]">CUSTOMER</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden max-w-48 truncate text-white/55 sm:inline">
              {user.email}
            </span>
            <CustomerSignOut />
          </div>
        </nav>
      </header>
      {children}
    </div>
  );
}
