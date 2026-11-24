import type { SupabaseClient } from "@supabase/supabase-js";

type AuthClient = SupabaseClient["auth"];

export function getSafeCustomerRedirectPath(value: string | null) {
  return value === "/customer" || value === "/reset-password"
    ? value
    : "/customer";
}

export async function signUpCustomer(
  auth: AuthClient,
  input: {
    email: string;
    password: string;
    fullName: string;
    emailRedirectTo: string;
  },
) {
  return auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: { full_name: input.fullName },
      emailRedirectTo: input.emailRedirectTo,
    },
  });
}

export function getSignupOutcome(
  error: { message: string } | null,
  hasSession: boolean,
  emailVerified: boolean,
) {
  if (!error && hasSession && emailVerified) return "authenticated";
  if (!error || /already registered|already exists/i.test(error.message)) {
    return "verification-required";
  }
  return "error";
}

export async function signInCustomer(
  auth: AuthClient,
  email: string,
  password: string,
) {
  return auth.signInWithPassword({ email, password });
}

export function getLoginErrorMessage(message: string) {
  return /not confirmed/i.test(message)
    ? "Verify your email before signing in."
    : "Email or password is incorrect.";
}

export async function requestCustomerPasswordReset(
  auth: AuthClient,
  email: string,
  redirectTo: string,
) {
  return auth.resetPasswordForEmail(email, { redirectTo });
}

export async function updateCustomerPassword(
  auth: AuthClient,
  password: string,
) {
  return auth.updateUser({ password });
}

export async function signOutCustomer(auth: AuthClient) {
  return auth.signOut();
}
