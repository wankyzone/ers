"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { getSupabaseClient } from "@/lib/supabase";
import { setAuthToken } from "@/lib/api/auth";

interface AdminAuthProviderProps {
  children: ReactNode;
}

export function AdminAuthProvider({
  children,
}: AdminAuthProviderProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const supabase = getSupabaseClient();

    const syncSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) {
        return;
      }

      if (!session) {
        setAuthToken(null);
        router.replace("/login");
        return;
      }

      setAuthToken(session.access_token);
      setIsLoading(false);
    };

    void syncSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setAuthToken(null);
        router.replace("/login");
        return;
      }

      setAuthToken(session.access_token);
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p>Checking authentication...</p>
      </main>
    );
  }

  return children;
}
