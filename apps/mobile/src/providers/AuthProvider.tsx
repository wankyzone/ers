import {
  useEffect,
  useMemo,
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

useEffect(() => {

    async function restoreSession() {

        const {
            data
        } = await supabase.auth.getSession();

        const currentSession = data.session;

        setSession(currentSession);

        setAccessToken(currentSession?.access_token ?? null);
        setApiAuthToken(currentSession?.access_token ?? null);

        setUser(currentSession?.user ?? null);

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

            setUser(session?.user ?? null);

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
