import { createClient } from "@supabase/supabase-js";

export const ADMIN_WAITLIST_COLUMNS =
  "email, created_at, referral_code, referred_by, referrals_count";

export type WaitlistAdminRow = {
  email: string;
  created_at: string;
  referral_code: string | null;
  referred_by: string | null;
  referrals_count: number;
};

function createAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Waitlist admin database configuration is missing");
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

function escapeLikeSearch(search: string) {
  return search.replace(/[\\%_]/g, "\\$&");
}

function throwOnQueryError(error: { message: string } | null) {
  if (error) throw new Error(`Waitlist query failed: ${error.message}`);
}

export async function getWaitlistDashboardPage(
  page: number,
  pageSize: number,
  search: string
) {
  const supabase = createAdminSupabase();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  let listQuery = supabase
    .from("waitlist")
    .select(ADMIN_WAITLIST_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (search) {
    listQuery = listQuery.ilike("email", `%${escapeLikeSearch(search)}%`);
  }

  const [listResult, totalResult, recentResult, referredResult] =
    await Promise.all([
      listQuery,
      supabase.from("waitlist").select("email", { count: "exact", head: true }),
      supabase
        .from("waitlist")
        .select("email", { count: "exact", head: true })
        .gte("created_at", since),
      supabase
        .from("waitlist")
        .select("email", { count: "exact", head: true })
        .not("referred_by", "is", null),
    ]);

  throwOnQueryError(listResult.error);
  throwOnQueryError(totalResult.error);
  throwOnQueryError(recentResult.error);
  throwOnQueryError(referredResult.error);

  return {
    rows: (listResult.data ?? []) as WaitlistAdminRow[],
    totalRows: listResult.count ?? 0,
    metrics: {
      totalSignups: totalResult.count ?? 0,
      recentSignups: recentResult.count ?? 0,
      referralSignups: referredResult.count ?? 0,
    },
  };
}

export async function getWaitlistExportRows(search: string) {
  const supabase = createAdminSupabase();
  const pageSize = 1000;
  const rows: WaitlistAdminRow[] = [];

  for (let from = 0; ; from += pageSize) {
    let query = supabase
      .from("waitlist")
      .select(ADMIN_WAITLIST_COLUMNS)
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (search) {
      query = query.ilike("email", `%${escapeLikeSearch(search)}%`);
    }

    const { data, error } = await query;
    throwOnQueryError(error);
    const batch = (data ?? []) as WaitlistAdminRow[];
    rows.push(...batch);
    if (batch.length < pageSize) return rows;
  }
}

function csvCell(value: string | number | null) {
  let text = String(value ?? "");
  if (/^\s*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function createWaitlistCsv(rows: WaitlistAdminRow[]) {
  const columns: Array<keyof WaitlistAdminRow> = [
    "email",
    "created_at",
    "referral_code",
    "referred_by",
    "referrals_count",
  ];
  const header = [
    "Email",
    "Signup date",
    "Referral code",
    "Referred by",
    "Referrals received",
  ];

  return [
    header.map(csvCell).join(","),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(",")),
  ].join("\r\n");
}
