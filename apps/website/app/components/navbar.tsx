"use client";

import { Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signOutCustomer } from "../../lib/customer-auth";
import { getSupabaseBrowserClient } from "../../lib/supabase/browser";

export default function Navbar() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isCustomer, setIsCustomer] = useState(false);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    let active = true;
    const syncCustomerState = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!active) return;
      if (error || !data.user) {
        setIsCustomer(false);
        return;
      }
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();
      if (active) setIsCustomer(!profileError && profile?.role === "client");
    };

    void syncCustomerState().catch((error: unknown) => {
      if (!(error instanceof Error)) throw error;
      if (active) setAuthError("Unable to refresh your account status.");
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsCustomer(false);
      if (session?.user) {
        window.setTimeout(() => {
          void syncCustomerState().catch((error: unknown) => {
            if (!(error instanceof Error)) throw error;
            if (active) setAuthError("Unable to refresh your account status.");
          });
        }, 0);
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { error } = await signOutCustomer(supabase.auth);
    if (error) {
      setAuthError("Unable to sign out. Please try again.");
      return;
    }
    setIsCustomer(false);
    setOpen(false);
    router.refresh();
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#080d0a]/90 text-white backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center" aria-label="ERS home">
          <Image
            src="/ers-logo.png"
            alt="ERS logo"
            width={150}
            height={40}
            priority
            className="h-9 w-auto"
          />
        </Link>

        <div className="hidden items-center gap-5 text-xs font-medium text-white/65 xl:flex">
          <Link href="/how-it-works" className="transition hover:text-white">How it works</Link>
          <Link href="/#services" className="transition hover:text-white">Explore services</Link>
          <Link href="/safety" className="transition hover:text-white">Safety &amp; trust</Link>
          <Link href="/about" className="transition hover:text-white">About</Link>
          <Link href="/for-runners" className="transition hover:text-white">Become a runner</Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {isCustomer ? (
            <Link href="/customer" className="hidden rounded-full border border-white/15 px-4 py-2.5 text-sm font-semibold text-white transition hover:border-[#19c963]/60 sm:inline-flex">
              Customer dashboard
            </Link>
          ) : (
            <Link href="/login" className="hidden rounded-full border border-white/15 px-4 py-2.5 text-sm font-semibold text-white transition hover:border-[#19c963]/60 sm:inline-flex">
              Sign in
            </Link>
          )}
          {isCustomer && (
            <button
              type="button"
              onClick={handleSignOut}
              className="hidden rounded-full border border-white/15 px-4 py-2.5 text-sm font-semibold text-white transition hover:border-[#19c963]/60 xl:inline-flex"
            >
              Sign out
            </button>
          )}
          <Link href="/how-it-works" className="hidden rounded-full bg-[#19c963] px-5 py-2.5 text-sm font-bold text-[#07110b] transition hover:bg-[#42df7d] sm:inline-flex">
            Explore ERS
          </Link>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="rounded-xl border border-white/15 p-2 text-white transition hover:border-[#19c963]/60 xl:hidden"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-white/10 bg-[#080d0a] px-5 py-5 xl:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 text-sm font-medium text-white/70">
            <Link href="/how-it-works" onClick={() => setOpen(false)} className="flex min-h-11 items-center">How it works</Link>
            <Link href="/#services" onClick={() => setOpen(false)} className="flex min-h-11 items-center">Explore services</Link>
            <Link href="/safety" onClick={() => setOpen(false)} className="flex min-h-11 items-center">Safety &amp; trust</Link>
            <Link href="/about" onClick={() => setOpen(false)} className="flex min-h-11 items-center">About</Link>
            <Link href="/for-runners" onClick={() => setOpen(false)} className="flex min-h-11 items-center">Become a runner</Link>
            {isCustomer ? (
              <>
                <Link href="/customer" onClick={() => setOpen(false)} className="flex min-h-11 items-center">Customer dashboard</Link>
                <button type="button" onClick={handleSignOut} className="flex min-h-11 items-center text-left">Sign out</button>
              </>
            ) : (
              <>
                <Link href="/login" onClick={() => setOpen(false)} className="flex min-h-11 items-center">Sign in</Link>
                <Link href="/signup" onClick={() => setOpen(false)} className="flex min-h-11 items-center">Create customer account</Link>
              </>
            )}
            <Link href="/how-it-works" onClick={() => setOpen(false)} className="mt-3 flex min-h-12 items-center justify-center rounded-full bg-[#19c963] px-5 py-3 font-bold text-[#07110b]">
              Explore ERS
            </Link>
            {authError && <p role="alert" className="text-sm text-red-200">{authError}</p>}
          </div>
        </div>
      )}
      {authError && !open && (
        <p role="alert" className="mx-auto max-w-7xl px-5 pb-3 text-xs text-red-200">
          {authError}
        </p>
      )}
    </nav>
  );
}
