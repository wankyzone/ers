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
export function authorize(...allowedRoles) {
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

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to perform this action.",
      });
    }

    return next();
  };
}