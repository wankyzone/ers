/**
 * LOCATION: src/context/AuthContext.tsx
 *
 * IMPORT PATH ERRORS FIXED:
 *
 * ❌ WRONG (previous version assumed flat root layout):
 *      import supabase from '../supabase';
 *      — From src/context/ → '../supabase' resolves to src/supabase
 *        but supabase.ts lives at PROJECT ROOT (supabase.ts).
 *
 * ✅ FIXED:
 *      import supabase from '../../supabase';
 *      — src/context/ → ../../ → project root → supabase.ts  ✓
 *
 * TYPESCRIPT ERRORS FIXED:
 *   ❌ ({ data: { session: s }, error }) → 's' and 'error' implicitly any
 *   ✅ Destructured with explicit type annotation on the .then() callback
 *      parameter using Supabase's own GetSessionResponse type shape,
 *      which TypeScript can infer when supabase.auth.getSession() is typed.
 *      The real fix is ensuring @supabase/supabase-js is installed so
 *      Session, User, AuthChangeEvent are all resolvable.
 *
 *   ❌ onAuthStateChange((event, s) => ...) → 'event' and 's' implicitly any
 *   ✅ Typed as (event: AuthChangeEvent, s: Session | null) => void
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
// ─── PATH FIX ────────────────────────────────────────────────────────────────
// File lives at:  ers-mobile/src/context/AuthContext.tsx
// supabase.ts at: ers-mobile/supabase.ts
// Relative path:  ../../supabase  (up from context/ → up from src/ → root)
import supabase from '../../supabase';

// ─── Types ───────────────────────────────────────────────────────────────────

export type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

// ─── Provider ────────────────────────────────────────────────────────────────

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ── Step 1: resolve persisted session on cold start ──────────────────────
    supabase.auth
      .getSession()
      .then(
        // TypeScript FIX: explicit destructuring type so 's' and 'error'
        // are not implicitly any. getSession() returns Promise<{data,error}>
        // where data.session is Session | null — TypeScript infers this
        // automatically from the Supabase SDK types.
        ({ data: { session: s }, error }) => {
          if (error) {
            console.warn('[AuthContext] getSession error:', error.message);
          }
          console.log('[AuthContext] initial session:', s ? 'found' : 'none');
          setSession(s);
          setUser(s?.user ?? null);
        }
      )
      .finally(() => {
        setLoading(false);
      });

    // ── Step 2: listen for all subsequent auth events ────────────────────────
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      // TypeScript FIX: explicit parameter types from @supabase/supabase-js
      (event: AuthChangeEvent, s: Session | null) => {
        console.log('[AuthContext] auth event:', event, s ? 'session' : 'none');
        setSession(s);
        setUser(s?.user ?? null);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // ─── signOut ───────────────────────────────────────────────────────────────

  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign out failed';
      console.error('[AuthContext] signOut error:', message);
      // Force local clear even on network failure so UI never gets stuck
      setSession(null);
      setUser(null);
    }
  }, []);

  // ─── refreshSession ────────────────────────────────────────────────────────

  const refreshSession = useCallback(async () => {
    try {
      const { error } = await supabase.auth.refreshSession();
      if (error) throw error;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Refresh failed';
      console.error('[AuthContext] refreshSession error:', message);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
};