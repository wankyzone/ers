import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const publishableKey =
  process.env.SUPABASE_PUBLIC_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('SUPABASE_URL is missing');
}

if (!serviceRoleKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing');
}

if (!publishableKey) {
  throw new Error(
    'SUPABASE_PUBLIC_KEY, SUPABASE_PUBLISHABLE_KEY, or SUPABASE_ANON_KEY is missing'
  );
}

const authOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
};

export const adminSupabase = createClient(
  supabaseUrl,
  serviceRoleKey,
  authOptions
);

export const publicSupabase = createClient(
  supabaseUrl,
  publishableKey,
  authOptions
);

export async function createAuthUser({
  email,
  password,
  role,
}) {
  const { data, error } = await adminSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role },
  });

  if (error) {
    throw error;
  }

  if (!data.user) {
    throw new Error('Supabase did not return the created user');
  }

  return data.user;
}

export async function signInUser({ email, password }) {
  const { data, error } = await publicSupabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  if (!data.session?.access_token) {
    throw new Error('Supabase did not return an access token');
  }

  return {
    user: data.user,
    session: data.session,
    accessToken: data.session.access_token,
  };
}

export async function deleteAuthUser(userId) {
  const { error } =
    await adminSupabase.auth.admin.deleteUser(userId);

  if (error) {
    throw error;
  }
}
