"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase/browser";
import {
  getLoginErrorMessage,
  getSignupOutcome,
  requestCustomerPasswordReset,
  signInCustomer,
  signUpCustomer,
  updateCustomerPassword,
} from "../../lib/customer-auth";
import {
  validateCustomerLogin,
  validateCustomerSignup,
  validatePasswordRecovery,
  validatePasswordReset,
} from "../../lib/customer-auth-validation";
import { isEmailVerified } from "../../lib/customer-profile";

type AuthMode = "signup" | "login" | "recovery" | "reset";

const fieldClass =
  "mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-[#111a15] px-4 py-3 text-base text-white placeholder:text-white/35 focus:border-[#19c963] focus:outline-none focus:ring-2 focus:ring-[#19c963]/30 disabled:opacity-60";

export default function CustomerAuthForm({
  mode,
  initialMessage,
}: {
  mode: AuthMode;
  initialMessage?: string;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState(initialMessage ?? "");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");

    const normalizedEmail = email.trim().toLowerCase();
    const validationError =
      mode === "signup"
        ? validateCustomerSignup({ fullName, email, password, confirmPassword })
        : mode === "login"
          ? validateCustomerLogin({ email, password })
          : mode === "recovery"
            ? validatePasswordRecovery(email)
            : validatePasswordReset({ password, confirmPassword });
    if (validationError) {
      setError(validationError);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Customer accounts are temporarily unavailable. Please try again later.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error: signupError } = await signUpCustomer(
          supabase.auth,
          {
            email: normalizedEmail,
            password,
            fullName: fullName.trim(),
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/customer`,
          },
        );
        const outcome = getSignupOutcome(
          signupError,
          Boolean(data.session),
          isEmailVerified(data.user),
        );
        if (outcome === "error") {
          setError("We couldn't create your account. Check your details and try again.");
          return;
        }

        if (outcome === "authenticated") {
          const profileResponse = await fetch("/api/customer/profile", {
            method: "POST",
          });
          if (!profileResponse.ok) {
            setError(
              profileResponse.status === 403
                ? "This account does not have customer access."
                : "We couldn't finish setting up your customer profile. Please try again.",
            );
            return;
          }
          router.replace("/customer");
          router.refresh();
          return;
        }

        setMessage(
          "If this address can be registered, a verification link will be sent.",
        );
        return;
      }

      if (mode === "login") {
        const { data: loginData, error: loginError } = await signInCustomer(
          supabase.auth,
          normalizedEmail,
          password,
        );
        if (loginError) {
          setError(getLoginErrorMessage(loginError.message));
          return;
        }
        if (!isEmailVerified(loginData.user)) {
          setError("Verify your email before signing in.");
          return;
        }
        const profileResponse = await fetch("/api/customer/profile", {
          method: "POST",
        });
        if (!profileResponse.ok) {
          setError(
            profileResponse.status === 403
              ? "This account does not have customer access."
              : "We couldn't load your customer profile. Please try again.",
          );
          return;
        }
        router.replace("/customer");
        router.refresh();
        return;
      }

      if (mode === "recovery") {
        const { error: recoveryError } = await requestCustomerPasswordReset(
          supabase.auth,
          normalizedEmail,
          `${window.location.origin}/auth/callback?next=/reset-password`,
        );
        if (recoveryError) {
          setError("We couldn't process that request. Please try again.");
          return;
        }
        setMessage("If an account exists for that address, a password reset link will be sent.");
        return;
      }

      const { error: resetError } = await updateCustomerPassword(
        supabase.auth,
        password,
      );
      if (resetError) {
        setError("This reset link is invalid or expired. Request a new one to continue.");
        return;
      }
      setMessage("Your password has been updated.");
      router.replace("/customer");
      router.refresh();
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      setError("A connection problem prevented that request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {mode === "signup" && (
        <div>
          <label htmlFor="full-name" className="text-sm font-semibold text-white/85">
            Name
          </label>
          <input
            id="full-name"
            name="name"
            type="text"
            autoComplete="name"
            maxLength={100}
            required
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className={fieldClass}
            disabled={loading}
          />
        </div>
      )}

      {mode !== "reset" && (
        <div>
          <label htmlFor="email" className="text-sm font-semibold text-white/85">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={fieldClass}
            disabled={loading}
          />
        </div>
      )}

      {mode !== "recovery" && (
        <div>
          <label htmlFor="password" className="text-sm font-semibold text-white/85">
            {mode === "reset" ? "New password" : "Password"}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={8}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={fieldClass}
            disabled={loading}
          />
        </div>
      )}

      {(mode === "signup" || mode === "reset") && (
        <div>
          <label htmlFor="confirm-password" className="text-sm font-semibold text-white/85">
            Confirm password
          </label>
          <input
            id="confirm-password"
            name="confirm-password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className={fieldClass}
            disabled={loading}
          />
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}
      {message && (
        <p role="status" aria-live="polite" className="rounded-xl border border-[#19c963]/25 bg-[#19c963]/10 px-4 py-3 text-sm text-[#a5f2bd]">
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="flex min-h-12 w-full items-center justify-center rounded-full bg-[#19c963] px-6 py-3 text-sm font-bold text-[#07110b] transition hover:bg-[#42df7d] disabled:cursor-wait disabled:opacity-60"
      >
        {loading
          ? "Please wait…"
          : mode === "signup"
            ? "Create customer account"
            : mode === "login"
              ? "Sign in"
              : mode === "recovery"
                ? "Send reset link"
                : "Update password"}
      </button>

      {mode === "login" && (
        <div className="flex flex-col items-center gap-3 pt-1 text-sm text-white/55 sm:flex-row sm:justify-between">
          <Link href="/forgot-password" className="min-h-11 inline-flex items-center text-[#68e992] hover:text-white">
            Forgot password?
          </Link>
          <Link href="/signup" className="min-h-11 inline-flex items-center text-[#68e992] hover:text-white">
            Create an account
          </Link>
        </div>
      )}
      {mode === "signup" && (
        <p className="text-center text-sm text-white/55">
          Already registered?{" "}
          <Link href="/login" className="text-[#68e992] hover:text-white">
            Sign in
          </Link>
        </p>
      )}
      {mode === "recovery" && (
        <p className="text-center text-sm text-white/55">
          <Link href="/login" className="text-[#68e992] hover:text-white">
            Back to sign in
          </Link>
        </p>
      )}
    </form>
  );
}
