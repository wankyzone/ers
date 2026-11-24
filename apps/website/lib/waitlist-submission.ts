import { NextResponse } from "next/server.js";
import { createClient } from "@supabase/supabase-js";
import { sendWaitlistConfirmation } from "./email/send-waitlist-confirmation.ts";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    const missing = [
      !url ? "NEXT_PUBLIC_SUPABASE_URL" : null,
      !key ? "SUPABASE_SERVICE_ROLE_KEY" : null,
    ].filter(Boolean) as string[];

    throw new Error(
      `Missing Supabase env vars: ${missing.join(", ")}`
    );
  }

  return createClient(url, key);
}

function getSafeErrorMessage(message: string) {
  const isDev = process.env.NODE_ENV !== "production";

  return isDev ? message : "Something went wrong. Please try again.";
}

// Stronger referral code generator
function generateCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// Basic email validation
function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function submitWaitlist(req: Request) {
  try {
    const supabase = getSupabase();

    const body = await req.json();
    const email = body?.email?.toLowerCase()?.trim();
    const requestedReferralCode =
      typeof body?.referralCode === "string"
        ? body.referralCode.trim().toUpperCase().slice(0, 100)
        : null;

    // Validate email
    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { ok: false, error: "Invalid email" },
        { status: 400 }
      );
    }

    // Check if email already exists
    const { data: existing, error: existingError } = await supabase
      .from("waitlist")
      .select("referral_code")
      .eq("email", email)
      .maybeSingle();

    if (existingError) {
      console.error("Waitlist lookup error:", existingError);
      return NextResponse.json(
        { ok: false, error: "Unable to check waitlist signup" },
        { status: 500 }
      );
    }

    if (existing) {
      return NextResponse.json({
        ok: true,
        message: "Already on waitlist",
        data: existing,
      });
    }

    let referralCode: string | null = null;
    if (requestedReferralCode) {
      const { data: referrer, error: referralLookupError } = await supabase
        .from("waitlist")
        .select("referral_code")
        .eq("referral_code", requestedReferralCode)
        .maybeSingle();

      if (referralLookupError) {
        console.error("Referral lookup error:", referralLookupError);
        return NextResponse.json(
          { ok: false, error: "Unable to process referral" },
          { status: 500 }
        );
      }

      referralCode = referrer?.referral_code ?? null;
    }

    // Generate unique referral code (retry max 3 times)
    let code = generateCode();
    let attempts = 0;

    while (attempts < 3) {
      const { data: existingCode } = await supabase
        .from("waitlist")
        .select("id")
        .eq("referral_code", code)
        .maybeSingle();

      if (!existingCode) break;

      code = generateCode();
      attempts++;
    }

    // Insert new user
    const { data, error } = await supabase
      .from("waitlist")
      .insert({
        email,
        referral_code: code,
        referred_by: referralCode,
      })
      .select("referral_code")
      .single();

    if (error) {
      const insertError = error.message || "Failed to join waitlist";
      console.error("Insert error:", error);

      return NextResponse.json(
        {
          ok: false,
          error: getSafeErrorMessage(insertError),
          details: process.env.NODE_ENV !== "production" ? insertError : undefined,
        },
        { status: 500 }
      );
    }

    // Increment referral count (safe Supabase pattern)
    if (referralCode) {
      const { error: rpcError } = await supabase.rpc(
        "increment_referrals",
        {
          code_input: referralCode,
        }
      );

      if (rpcError) {
        console.error("Referral increment error:", rpcError);
      }
    }

    // Email delivery must not turn a successful signup into a failure.
    await sendWaitlistConfirmation(email);

    return NextResponse.json({
      ok: true,
      data,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown server error";
    console.error("Waitlist API error:", err);

    return NextResponse.json(
      {
        ok: false,
        error: getSafeErrorMessage(message),
        details: process.env.NODE_ENV !== "production" ? message : undefined,
      },
      { status: 500 }
    );
  }
}