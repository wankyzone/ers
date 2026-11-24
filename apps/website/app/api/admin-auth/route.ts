import { NextResponse } from "next/server.js";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  createAdminSession,
} from "../../../lib/admin-session.ts";
import {
  isWaitlistAdminEnabled,
  waitlistAdminUnavailableResponse,
} from "../../../lib/waitlist-admin-access.ts";

const encoder = new TextEncoder();

async function passwordsMatch(candidate: string, configured: string) {
  const [candidateHash, configuredHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(candidate)),
    crypto.subtle.digest("SHA-256", encoder.encode(configured)),
  ]);
  const candidateBytes = new Uint8Array(candidateHash);
  const configuredBytes = new Uint8Array(configuredHash);
  let difference = 0;

  for (let index = 0; index < candidateBytes.length; index += 1) {
    difference |= candidateBytes[index] ^ configuredBytes[index];
  }

  return difference === 0;
}

export async function POST(req: Request) {
  if (!isWaitlistAdminEnabled()) return waitlistAdminUnavailableResponse();

  const configuredPassword = process.env.ADMIN_PASSWORD;
  if (!configuredPassword?.trim() || !process.env.ADMIN_SESSION_SECRET?.trim()) {
    return NextResponse.json(
      { ok: false, error: "Admin authentication is not configured" },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const password =
    typeof body === "object" &&
    body !== null &&
    "password" in body &&
    typeof body.password === "string"
      ? body.password
      : null;

  if (
    !password ||
    !(await passwordsMatch(password, configuredPassword))
  ) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const session = await createAdminSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Admin authentication is not configured" },
      { status: 503 }
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE,
  });

  return response;
}