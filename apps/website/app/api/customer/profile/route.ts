import { NextResponse } from "next/server";
import {
  ensureCustomerProfile,
  isEmailVerified,
  requireCustomerUser,
  updateCustomerProfileName,
} from "../../../../lib/customer-profile";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function GET() {
  const supabase = await createSupabaseServerClient(true);
  const { user, profile } = await requireCustomerUser(supabase);
  if (!user || !profile) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  return NextResponse.json({
    profile: {
      id: profile.id,
      email: user.email ?? null,
      full_name: profile.full_name,
    },
  });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const supabase = await createSupabaseServerClient(true);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user || !isEmailVerified(data.user)) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const profile = await ensureCustomerProfile(supabase, data.user);
  if (profile.role !== "client") {
    return NextResponse.json(
      { error: "This account does not have customer access." },
      { status: 403 },
    );
  }

  return NextResponse.json({
    profile: {
      id: profile.id,
      email: data.user.email ?? null,
      full_name: profile.full_name,
    },
  });
}

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const supabase = await createSupabaseServerClient(true);
  const { user, profile } = await requireCustomerUser(supabase);
  if (!user || !profile) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).length !== 1 ||
    !("full_name" in body) ||
    typeof body.full_name !== "string"
  ) {
    return NextResponse.json({ error: "Enter a valid name." }, { status: 400 });
  }

  const fullName = body.full_name.trim();
  if (fullName.length < 2 || fullName.length > 100) {
    return NextResponse.json(
      { error: "Name must be between 2 and 100 characters." },
      { status: 400 },
    );
  }

  const { data, error } = await updateCustomerProfileName(
    supabase,
    user,
    fullName,
  );

  if (error) {
    return NextResponse.json(
      { error: "Unable to update your profile." },
      { status: 500 },
    );
  }

  return NextResponse.json({ profile: data });
}
