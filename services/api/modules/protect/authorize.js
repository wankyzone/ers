import { hasActiveRunnerCapability } from "./authService.js";

/**
 * Wanky Protect authorization middleware.
 *
 * Authentication answers:
 *   "Who is this user?"
 *
 * Authorization answers:
 *   "Is this user allowed to perform this action?"
 *
 * Usage:
 *   authorize("runner")
 *   authorize("admin")
 *   authorize("client", "runner")
 */
const ROLE_HIERARCHY = {
  admin: ["super_admin"],
};

function getAllowedRoles(allowedRoles) {
  const resolvedRoles = new Set(allowedRoles);

  for (const role of allowedRoles) {
    const inheritedRoles = ROLE_HIERARCHY[role] || [];
    inheritedRoles.forEach((inheritedRole) => resolvedRoles.add(inheritedRole));
  }

  return resolvedRoles;
}

export function authorize(...allowedRoles) {
  const resolvedAllowedRoles = getAllowedRoles(allowedRoles);

  return function authorizeRole(req, res, next) {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication is required.",
      });
    }

    if (!req.user.role) {
      return res.status(403).json({
        success: false,
        message: "User role is unavailable.",
      });
    }

    if (!resolvedAllowedRoles.has(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to perform this action.",
      });
    }

    return next();
  };
}

export function authorizeCustomer() {
  return function authorizeVerifiedCustomer(req, res, next) {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication is required.",
      });
    }

    if (!["client", "runner"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Customer access is not available for this account.",
      });
    }

    if (!req.user.emailVerified) {
      return res.status(403).json({
        success: false,
        message: "Email verification is required.",
      });
    }

    return next();
  };
}

export function authorizeCustomerOrRoles(...allowedRoles) {
  const authorizeOtherRole = authorize(...allowedRoles);

  return function authorizeCustomerOrAccountRole(req, res, next) {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication is required.",
      });
    }

    if (
      ["client", "runner"].includes(req.user.role) &&
      req.user.emailVerified
    ) {
      return next();
    }

    if (req.user.role === "runner" || req.user.role === "client") {
      return res.status(403).json({
        success: false,
        message: "Email verification is required.",
      });
    }

    return authorizeOtherRole(req, res, next);
  };
}

export function authorizeRunnerApplication() {
  return function authorizeVerifiedRunnerApplicant(req, res, next) {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication is required.",
      });
    }

    if (req.user.role !== "runner") {
      return res.status(403).json({
        success: false,
        message: "Runner application access is not available for this account.",
      });
    }

    if (!req.user.emailVerified) {
      return res.status(403).json({
        success: false,
        message: "Email verification is required.",
      });
    }

    return next();
  };
}

export function authorizeActiveRunner() {
  return async function authorizeApprovedActiveRunner(req, res, next) {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication is required.",
      });
    }

    if (req.user.role !== "runner") {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to perform this action.",
      });
    }

    if (!req.user.emailVerified) {
      return res.status(403).json({
        success: false,
        message: "Email verification is required.",
      });
    }

    if (req.user.verified !== true) {
      return res.status(403).json({
        success: false,
        message: "Runner approval is required.",
      });
    }

    try {
      if (!(await hasActiveRunnerCapability(req.user.id))) {
        return res.status(403).json({
          success: false,
          message: "Runner capability is not active.",
        });
      }

      return next();
    } catch (error) {
      console.error("[Wanky Protect] Runner capability check failed:", error);
      return res.status(503).json({
        success: false,
        message: "Runner authorization is unavailable.",
      });
    }
  };
}

export function authorizeAdmin() {
  return authorize("admin");
}