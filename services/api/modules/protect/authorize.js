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

export function authorizeAdmin() {
  return authorize("admin");
}