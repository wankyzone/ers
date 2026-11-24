"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOutCustomer } from "../../lib/customer-auth";
import { getSupabaseBrowserClient } from "../../lib/supabase/browser";

export default function CustomerSignOut() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState("");

  const signOut = async () => {
    setErrorMessage("");
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setErrorMessage("Sign out is temporarily unavailable.");
      return;
    }
    const { error } = await signOutCustomer(supabase.auth);
    if (error) {
      setErrorMessage("Unable to sign out. Please try again.");
      return;
    }
    router.replace("/");
    router.refresh();
  };

  return (
    <>
      <button
        type="button"
        onClick={signOut}
        className="min-h-11 rounded-full border border-white/15 px-4 py-2 font-semibold transition hover:border-[#19c963]/60 hover:text-[#68e992]"
      >
        Sign out
      </button>
      {errorMessage && (
        <span role="alert" className="text-xs text-red-200">
          {errorMessage}
        </span>
      )}
    </>
  );
}
