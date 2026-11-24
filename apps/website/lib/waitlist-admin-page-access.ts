import { notFound } from "next/navigation.js";
import { isWaitlistAdminEnabled } from "./waitlist-admin-access.ts";

export function requireWaitlistAdminPageAccess() {
  if (!isWaitlistAdminEnabled()) notFound();
}
