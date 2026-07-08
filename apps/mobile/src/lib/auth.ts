import { AuthService } from "@ers/auth";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const auth = new AuthService(
  supabaseUrl,
  supabaseAnonKey
);