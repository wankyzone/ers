import { cookies } from "next/headers";
import AdminDashboard from "./admin-dashboard";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSession,
} from "../../lib/admin-session";
import { requireWaitlistAdminPageAccess } from "../../lib/waitlist-admin-page-access";

export default async function AdminPage() {
  requireWaitlistAdminPageAccess();

  const session = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  const initiallyAuthorized = await verifyAdminSession(session);

  return <AdminDashboard initiallyAuthorized={initiallyAuthorized} />;
}
