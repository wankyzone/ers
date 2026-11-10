import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type {
  AuthChangeEvent,
  Session,
  User,
} from "@supabase/supabase-js";

import { AuthContext } from "../context/AuthContext";

import { supabase } from "@ers/auth";
import { setApiAuthToken } from "../services/api";

async function resolveApplicationUser(authUser: User | null): Promise<User | null> {
  if (!authUser) return null;

  let applicationRole = "client";

  try {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", authUser.id)
      .maybeSingle();

    if (error) {
      console.warn("[AuthProvider] Failed to resolve application role:", error.message);
    } else if (profile?.role) {
      applicationRole = profile.role;
    }
  } catch (error) {
    console.warn("[AuthProvider] Application role lookup failed:", error);
  }

  return {
    ...authUser,
    user_metadata: {
      ...authUser.user_metadata,
      // Role comes from the RLS-protected application profile, never from
      // client-controlled signup metadata.
      role: applicationRole,
    },
  };
}


interface Props {
  children: ReactNode;
}

export default function AuthProvider({
  children,
}: Props) {
const [user, setUser] =
    useState<User | null>(null);

const [session, setSession] =
    useState<Session | null>(null);

const [accessToken, setAccessToken] =
    useState<string | null>(null);

const [loading, setLoading] =
    useState(true);

const authResolutionVersion = useRef(0);

useEffect(() => {

    async function restoreSession() {

        const {
            data
        } = await supabase.auth.getSession();

        const currentSession = data.session;

        setSession(currentSession);

        setAccessToken(currentSession?.access_token ?? null);
        setApiAuthToken(currentSession?.access_token ?? null);

        const resolutionVersion = ++authResolutionVersion.current;
        const resolvedUser = await resolveApplicationUser(currentSession?.user ?? null);
        if (resolutionVersion === authResolutionVersion.current) {
          setUser(resolvedUser);
        }

        setLoading(false);

    }

    restoreSession();

}, []);

useEffect(() => {

    const {
        data: listener,
    } = supabase.auth.onAuthStateChange(
        (_event: AuthChangeEvent, session: Session | null) => {

            setSession(session);

            setAccessToken(session?.access_token ?? null);
            setApiAuthToken(session?.access_token ?? null);

            const authUser = session?.user ?? null;
            const resolutionVersion = ++authResolutionVersion.current;
            setUser(authUser);

            // Defer profile lookup until the Supabase auth callback has returned.
            if (authUser) {
              setTimeout(() => {
                void resolveApplicationUser(authUser)
                  .then((resolvedUser) => {
                    if (resolutionVersion === authResolutionVersion.current) {
                      setUser(resolvedUser);
                    }
                  })
                  .catch((error) => {
                    console.warn("[AuthProvider] Application role lookup failed:", error);
                  });
              }, 0);
            }

        }
    );

    return () => {

        listener.subscription.unsubscribe();

    };

}, []);

async function signIn(
    email: string,
    password: string
) {

    const { error } =
        await supabase.auth.signInWithPassword({

            email,

            password,

        });

    if (error) throw error;

}

async function signUp(

    email: string,

    password: string,

) {

    const { error } =
        await supabase.auth.signUp({

            email,

            password,

        });

    if (error) throw error;

}

async function signOut() {

    const { error } =
        await supabase.auth.signOut();

    if (error) throw error;

}

const value = useMemo(() => ({

    user,

    session,

    accessToken,

    loading,

    signIn,

    signUp,

    signOut,

}), [

    user,

    session,

    accessToken,

    loading,

]);

return (

<AuthContext.Provider value={value}>

    {children}

</AuthContext.Provider>

);
}
