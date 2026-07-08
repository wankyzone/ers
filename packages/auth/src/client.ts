import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

export type {
  AuthChangeEvent,
  Session,
  User,
  SupabaseClient,
} from "@supabase/supabase-js";

let sharedSupabaseClient: SupabaseClient | null = null;

declare const process:
  | {
      env: Record<string, string | undefined>;
    }
  | undefined;

export function createSupabaseClient(
  supabaseUrl: string,
  supabaseAnonKey: string
) {
  return createClient(supabaseUrl, supabaseAnonKey);
}

function getRequiredEnv(name: string): string {
  const value =
    typeof process === "undefined" ? undefined : process.env[name];

  if (!value) {
    throw new Error(`${name} is required to initialize Supabase`);
  }

  return value;
}

export function getSupabaseClient(
  supabaseUrl = getRequiredEnv("EXPO_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey = getRequiredEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY")
) {
  if (!sharedSupabaseClient) {
    sharedSupabaseClient = createSupabaseClient(
      supabaseUrl,
      supabaseAnonKey
    );
  }

  return sharedSupabaseClient;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, property: keyof SupabaseClient) {
    return getSupabaseClient()[property];
  },
});
