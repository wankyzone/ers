import supabase from "../../supabase.js";

export function isEmailVerifiedAuthUser(user) {
  const confirmedAt = user?.email_confirmed_at;
  const timestampPattern =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|([+-])(\d{2}):(\d{2}))$/;
  const match =
    typeof confirmedAt === "string" ? timestampPattern.exec(confirmedAt) : null;

  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[9] ? Number(match[9]) : 0;
  const offsetMinute = match[10] ? Number(match[10]) : 0;
  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    isLeapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ][month - 1];

  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59 &&
    offsetHour <= 23 &&
    offsetMinute <= 59 &&
    Number.isFinite(Date.parse(confirmedAt))
  );
}

export async function hasActiveRunnerCapability(userId) {
  const [kycResult, runnerResult] = await Promise.all([
    supabase
      .from("kyc_profiles")
      .select("status")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("runners")
      .select("is_available")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  if (kycResult.error) {
    throw new Error("Unable to verify runner approval.");
  }

  if (runnerResult.error) {
    throw new Error("Unable to verify runner activation.");
  }

  return (
    kycResult.data?.status === "approved" &&
    runnerResult.data?.is_available === true
  );
}

export async function verifyAccessToken(token) {
  if (!token) {
    return {
      success: false,
      message: "Access token is required.",
    };
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return {
      success: false,
      message: "Invalid or expired access token.",
    };
  }

  return {
    success: true,
    user,
  };
}

export async function getApplicationUser(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select(`
      id,
      email,
      role,
      date_of_birth,
      verified,
      created_at
    `)
    .eq("id", userId)
    .single();

  if (error) {
    console.error(
      "[Wanky Protect] Failed to resolve application user:",
      {
        userId,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      }
    );

    return {
      success: false,
      message: "Application user not found.",
    };
  }

  if (!data) {
    console.error(
      "[Wanky Protect] Application profile missing:",
      userId
    );

    return {
      success: false,
      message: "Application user not found.",
    };
  }

  return {
    success: true,
    user: data,
  };
}