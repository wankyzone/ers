import type { SupabaseClient, User } from "@supabase/supabase-js";

export type CustomerProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
};

export function isCustomerRole(role: string | null | undefined) {
  return role === "client";
}

export function isEmailVerified(
  user: Pick<User, "email_confirmed_at"> | null | undefined,
) {
  return Boolean(user?.email_confirmed_at);
}

export async function getCustomerProfile(
  supabase: SupabaseClient,
  user: User,
) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw new Error("Unable to retrieve customer profile.");
  return profile as CustomerProfile | null;
}

export async function updateCustomerProfileName(
  supabase: SupabaseClient,
  user: User,
  fullName: string,
) {
  return supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", user.id)
    .select("id, email, full_name")
    .single();
}

export async function ensureCustomerProfile(
  supabase: SupabaseClient,
  user: User,
) {
  let profile = await getCustomerProfile(supabase, user);
  if (profile) return profile;

  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name.trim().slice(0, 100)
      : null;

  const { error } = await supabase.from("profiles").insert({
    id: user.id,
    full_name: fullName || null,
    role: "client",
  });
  if (error && error.code !== "23505") {
    throw new Error("Unable to provision customer profile.");
  }

  profile = await getCustomerProfile(supabase, user);
  if (!profile) throw new Error("Customer profile is not available.");
  return profile;
}

export async function requireCustomerUser(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user || !isEmailVerified(data.user)) {
    return { user: null, profile: null };
  }

  const profile = await getCustomerProfile(supabase, data.user);
  if (!profile || !isCustomerRole(profile.role)) {
    return { user: null, profile };
  }

  return { user: data.user, profile };
}
