import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type {
  Session,
  User,
} from "@supabase/supabase-js";

import { AuthContext } from "../context/AuthContext";

import { supabase } from "@ers/auth";

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

const [loading, setLoading] =
    useState(true);

useEffect(() => {

    async function restoreSession() {

        const {
            data
        } = await supabase.auth.getSession();

        setSession(data.session);

        setUser(data.session?.user ?? null);

        setLoading(false);

    }

    restoreSession();

}, []);

useEffect(() => {

    const {
        data: listener,
    } = supabase.auth.onAuthStateChange(
        (_event, session) => {

            setSession(session);

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

    loading,

    signIn,

    signUp,

    signOut,

}), [

    user,

    session,

    loading,

]);

return (

<AuthContext.Provider value={value}>

    {children}

</AuthContext.Provider>

);
}
