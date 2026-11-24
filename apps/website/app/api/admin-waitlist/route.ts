import { NextResponse } from "next/server.js";
import { isAdminRequest } from "../../../lib/admin-authorization.ts";
import { getWaitlistDashboardPage } from "../../../lib/admin-waitlist.ts";
import {
  isWaitlistAdminEnabled,
  waitlistAdminUnavailableResponse,
} from "../../../lib/waitlist-admin-access.ts";

export async function GET(request: Request) {
  if (!isWaitlistAdminEnabled()) return waitlistAdminUnavailableResponse();

  if (!(await isAdminRequest(request))) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  const url = new URL(request.url);
  const requestedPage = Number(url.searchParams.get("page") ?? "1");
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? Math.min(requestedPage, 1_000_000)
      : 1;
  const search = (url.searchParams.get("search") ?? "").trim().slice(0, 100);

  try {
    const pageSize = 25;
    const result = await getWaitlistDashboardPage(page, pageSize, search);

    return NextResponse.json(
      {
        ...result,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(result.totalRows / pageSize)),
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    console.error("Admin waitlist query failed:", error);
    return NextResponse.json(
      { error: "Unable to load waitlist data" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
