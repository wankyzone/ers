import {
  verifyAccessToken,
  getApplicationUser,
} from "./authService.js";

/**
 * Wanky Protect authentication middleware.
 *
 * Responsibilities:
 * 1. Read the Bearer token.
 * 2. Verify the token with Supabase Auth.
 * 3. Resolve the corresponding ERS account.
 * 4. Attach trusted identity information to req.user.
 */
export async function authenticate(req, res, next) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization) {
      return res.status(401).json({
        success: false,
        message: "Authorization header is required.",
      });
    }

    const [scheme, token] = authorization.split(" ");

    if (
      scheme?.toLowerCase() !== "bearer" ||
      !token
    ) {
      return res.status(401).json({
        success: false,
        message: "Authorization header must use the Bearer scheme.",
      });
    }

    const authResult = await verifyAccessToken(token);

    if (!authResult.success) {
      return res.status(401).json({
        success: false,
        message: authResult.message,
      });
    }

    const accountResult = await getApplicationUser(
      authResult.user.id
    );

    if (!accountResult.success) {
      return res.status(403).json({
        success: false,
        message: accountResult.message,
      });
    }

    req.user = {
      id: authResult.user.id,
      email:
        accountResult.user.email ??
        authResult.user.email ??
        null,
      role: accountResult.user.role,
      fullName: accountResult.user.full_name,
      kycVerified: accountResult.user.kyc_verified,
      pinSet: accountResult.user.pin_set,
      riskScore: accountResult.user.risk_score,
      verified: accountResult.user.verified,
    };

    return next();
  } catch (error) {
    console.error(
      "[Wanky Protect] Authentication failure:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Authentication service unavailable.",
    });
  }
}