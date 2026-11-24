import { NextResponse, type NextRequest } from "next/server";
import { getSafeCustomerRedirectPath } from "../../../lib/customer-auth";
import {
  ensureCustomerProfile,
  isEmailVerified,
  isCustomerRole,
} from "../../../lib/customer-profile";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/login?error=link", request.url));
  }

  const supabase = await createSupabaseServerClient(true);
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/login?error=link", request.url));
  }

  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user || !isEmailVerified(data.user)) {
    return NextResponse.redirect(new URL("/login?error=link", request.url));
  }

  const profile = await ensureCustomerProfile(supabase, data.user);
  if (!isCustomerRole(profile.role)) {
    return NextResponse.redirect(new URL("/login?error=role", request.url));
  }

  return NextResponse.redirect(
    new URL(
      getSafeCustomerRedirectPath(request.nextUrl.searchParams.get("next")),
      request.url,
    ),
  );
}
