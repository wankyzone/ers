"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { getSupabaseClient } from "@/lib/supabase";
import { setAuthToken } from "@/lib/api/auth";
import { request } from "@/lib/api/request";

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
    let lastVerifiedToken: string | null = null;

    async function verifyAdminAndSet(token: string | null) {
      if (!token) return;
      // avoid duplicate verification for the same token
      if (token === lastVerifiedToken) return;

      try {
        const payload = await request<{ success: boolean; data: { id: string; email?: string | null; role: string } }>(
          '/admin/me',
          { method: 'GET' }
        );

        if (!mounted) return;

        if (payload && payload.success) {
          lastVerifiedToken = token;
          setIsLoading(false);
          return;
        }

        // If payload not successful, treat as unauthorized
        setAuthToken(null);
        router.replace('/login');
      } catch (err: unknown) {
        const statusCandidate =
          typeof err === 'object' && err !== null
            ? ((err as Record<string, unknown>).status ?? (err as Record<string, unknown>).statusCode)
            : null;

        const status = typeof statusCandidate === 'number' ? statusCandidate : null;

        if (status === 401) {
          setAuthToken(null);
          if (mounted) router.replace('/login');
          return;
        }

        if (status === 403) {
          // Authenticated but not admin
          if (mounted) router.replace('/unauthorized');
          return;
        }

        // Fallback: clear token and redirect to login
        setAuthToken(null);
        if (mounted) router.replace('/login');
      }
    }

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
      await verifyAdminAndSet(session.access_token ?? null);
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
      void verifyAdminAndSet(session.access_token ?? null);
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
