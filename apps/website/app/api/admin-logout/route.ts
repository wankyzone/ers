import { NextResponse } from "next/server.js";
import { ADMIN_SESSION_COOKIE } from "../../../lib/admin-session.ts";

export async function POST() {
  const res = NextResponse.json({ ok: true });

  res.cookies.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });

  return res;
}