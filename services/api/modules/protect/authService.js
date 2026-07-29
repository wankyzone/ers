import supabase from "../../supabase.js";

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