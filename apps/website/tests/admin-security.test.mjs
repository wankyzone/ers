import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { after } from "node:test";
import { createAdminSession, verifyAdminSession } from "../lib/admin-session.ts";
import { POST as adminLogin } from "../app/api/admin-auth/route.ts";
import { POST as adminLogout } from "../app/api/admin-logout/route.ts";
import { GET as getAdminWaitlist } from "../app/api/admin-waitlist/route.ts";
import { GET as getWaitlistExport } from "../app/api/admin-waitlist/export/route.ts";
import { GET as getWaitlistPage } from "../app/waitlist/route.ts";
import { POST as disabledWaitlist } from "../app/api/waitlist/route.ts";
import { POST as createErrand } from "../app/api/errands/route.ts";
import { requireWaitlistAdminPageAccess } from "../lib/waitlist-admin-page-access.ts";
import { submitWaitlist } from "../lib/waitlist-submission.ts";

const originalEnvironment = {
  sessionSecret: process.env.ADMIN_SESSION_SECRET,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  nodeEnv: process.env.NODE_ENV,
  resendApiKey: process.env.RESEND_API_KEY,
  waitlistAdminEnabled: process.env.ERS_WAITLIST_ADMIN_ENABLED,
};

process.env.ADMIN_SESSION_SECRET = "unit-test-only-session-secret-at-least-32-bytes";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://unit-test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "unit-test-only-service-role-key";
process.env.NODE_ENV = "test";
process.env.RESEND_API_KEY = "re_test_only_not_real";
process.env.ERS_WAITLIST_ADMIN_ENABLED = "true";

after(() => {
  for (const [key, value] of [
    ["ADMIN_SESSION_SECRET", originalEnvironment.sessionSecret],
    ["NEXT_PUBLIC_SUPABASE_URL", originalEnvironment.supabaseUrl],
    ["SUPABASE_SERVICE_ROLE_KEY", originalEnvironment.serviceRoleKey],
    ["NODE_ENV", originalEnvironment.nodeEnv],
    ["RESEND_API_KEY", originalEnvironment.resendApiKey],
    ["ERS_WAITLIST_ADMIN_ENABLED", originalEnvironment.waitlistAdminEnabled],
  ]) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

async function withWaitlistAdminFlag(value, run) {
  const previous = process.env.ERS_WAITLIST_ADMIN_ENABLED;
  if (value === undefined) delete process.env.ERS_WAITLIST_ADMIN_ENABLED;
  else process.env.ERS_WAITLIST_ADMIN_ENABLED = value;

  try {
    return await run();
  } finally {
    if (previous === undefined) delete process.env.ERS_WAITLIST_ADMIN_ENABLED;
    else process.env.ERS_WAITLIST_ADMIN_ENABLED = previous;
  }
}

function requestWithSession(url, session) {
  return new Request(url, {
    headers: { cookie: `ers_admin_session=${session}` },
  });
}

function mockSupabaseFetch(t, responder) {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (input, init = {}) => {
    const request = input instanceof Request ? input : null;
    const call = {
      url: new URL(request?.url ?? String(input)),
      method: init.method ?? request?.method ?? "GET",
      headers: new Headers(init.headers ?? request?.headers),
      body: init.body ?? null,
    };
    calls.push(call);
    return responder(call);
  });
  return calls;
}

function countResponse(count) {
  return new Response(null, {
    status: 200,
    headers: { "content-range": `0-0/${count}` },
  });
}

test("/waitlist returns a genuine 404 response", async () => {
  const response = await getWaitlistPage();
  assert.equal(response.status, 404);
});

test("public marketing routes do not expose waitlist signup or links", async () => {
  const publicFiles = [
    "../app/page.tsx",
    "../app/components/cta.tsx",
    "../app/components/navbar.tsx",
    "../app/components/footer.tsx",
  ];
  const sources = await Promise.all(
    publicFiles.map((path) =>
      readFile(new URL(path, import.meta.url), "utf8")
    )
  );
  const sitemap = await readFile(
    new URL("../app/sitemap.ts", import.meta.url),
    "utf8"
  );

  assert.doesNotMatch(sources.join("\n"), /waitlist|early access/i);
  assert.doesNotMatch(sources.join("\n"), /WaitlistForm|\/api\/waitlist/i);
  assert.doesNotMatch(sitemap, /\/waitlist/);
});

test("public waitlist submissions are gone and trigger no external side effects", async (t) => {
  const calls = mockSupabaseFetch(t, () => {
    assert.fail("disabled submission must not call Supabase or email providers");
  });

  const response = await disabledWaitlist(
    new Request("https://ers.example/api/waitlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "new@example.com",
        referralCode: "FRIEND1",
      }),
    })
  );

  assert.equal(response.status, 410);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    ok: false,
    error: "Waitlist signups are closed.",
  });
  assert.equal(calls.length, 0);
});

test("legacy waitlist admin defaults to unavailable without disclosing data", async (t) => {
  const calls = mockSupabaseFetch(t, () => {
    assert.fail("disabled waitlist administration must not query Supabase");
  });
  const session = await createAdminSession();

  await withWaitlistAdminFlag(undefined, async () => {
    await assert.rejects(
      async () => requireWaitlistAdminPageAccess(),
      (error) => error?.digest === "NEXT_HTTP_ERROR_FALLBACK;404",
    );

    const login = await adminLogin(
      new Request("https://ers.example/api/admin-auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "unit-test-only-password" }),
      }),
    );
    assert.equal(login.status, 503);
    assert.equal(login.headers.get("set-cookie"), null);

    const listing = await getAdminWaitlist(
      requestWithSession("https://ers.example/api/admin-waitlist", session),
    );
    const exported = await getWaitlistExport(
      requestWithSession(
        "https://ers.example/api/admin-waitlist/export",
        session,
      ),
    );

    for (const response of [listing, exported]) {
      assert.equal(response.status, 503);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.deepEqual(await response.json(), {
        error: "Waitlist administration is unavailable.",
      });
    }
  });

  assert.equal(calls.length, 0);
});

test("explicit disable values keep waitlist administration unavailable", async (t) => {
  const calls = mockSupabaseFetch(t, () => {
    assert.fail("disabled waitlist administration must not query Supabase");
  });

  for (const flag of ["", "false", "TRUE", "1"]) {
    await withWaitlistAdminFlag(flag, async () => {
      const response = await getWaitlistExport(
        new Request("https://ers.example/api/admin-waitlist/export"),
      );
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), {
        error: "Waitlist administration is unavailable.",
      });
    });
  }

  assert.equal(calls.length, 0);
});

test("explicit enable keeps the legacy admin page access path available", async () => {
  await withWaitlistAdminFlag("true", async () => {
    assert.doesNotThrow(() => requireWaitlistAdminPageAccess());
  });
});

test("the errand mock returns 501 without logging or calling external services", async (t) => {
  const calls = mockSupabaseFetch(t, () => {
    assert.fail("the placeholder errand endpoint must not call external services");
  });
  const log = t.mock.method(console, "log");
  const personalData = "private-customer-details";

  const response = await createErrand(
    new Request("https://ers.example/api/errands", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ task: personalData }),
    }),
  );

  assert.equal(response.status, 501);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.text();
  assert.match(body, /Errand creation is not available through this endpoint yet\./);
  assert.doesNotMatch(body, new RegExp(personalData));
  assert.equal(log.mock.callCount(), 0);
  assert.equal(calls.length, 0);
});

test("sessions reject missing, malformed, tampered, and expired values", async () => {
  assert.equal(await verifyAdminSession(undefined), false);
  assert.equal(await verifyAdminSession("ers_admin=true"), false);
  assert.equal(await verifyAdminSession("v1.not-an-expiry.nonce.signature"), false);

  const validSession = await createAdminSession();
  assert.ok(validSession);
  assert.equal(await verifyAdminSession(validSession), true);

  const signatureSeparator = validSession.lastIndexOf(".");
  const encodedSignature = validSession.slice(signatureSeparator + 1);
  const tamperedSignature = `${encodedSignature[0] === "A" ? "B" : "A"}${encodedSignature.slice(1)}`;
  const tampered = `${validSession.slice(0, signatureSeparator + 1)}${tamperedSignature}`;
  assert.equal(
    await verifyAdminSession(tampered),
    false,
    "a signature with a changed significant bit must be rejected"
  );
  const encoder = new TextEncoder();
  const payload = "v1.1.AAAAAAAAAAAAAAAAAAAAAA";
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(process.env.ADMIN_SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(payload))
  );
  const signatureBase64 = Buffer.from(signature).toString("base64url");
  assert.equal(
    await verifyAdminSession(`${payload}.${signatureBase64}`),
    false
  );
});

test("admin login rejects missing credentials or session configuration", async () => {
  delete process.env.ADMIN_PASSWORD;
  const response = await adminLogin(
    new Request("https://ers.example/api/admin-auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    })
  );
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("set-cookie"), null);
});

test("admin login issues an HttpOnly, Secure, SameSite signed session", async () => {
  process.env.ADMIN_PASSWORD = "unit-test-only-password";
  process.env.NODE_ENV = "production";
  const response = await adminLogin(
    new Request("https://ers.example/api/admin-auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "unit-test-only-password" }),
    })
  );
  process.env.NODE_ENV = "test";

  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie");
  assert.match(cookie, /ers_admin_session=/);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /Secure/i);
  assert.match(cookie, /SameSite=Strict/i);
  assert.match(cookie, /Path=\//i);
  const token = cookie.match(/ers_admin_session=([^;]+)/)?.[1];
  assert.equal(await verifyAdminSession(token), true);
});

test("admin logout expires the session cookie", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";

  let response;
  try {
    response = await withWaitlistAdminFlag("false", () => adminLogout());
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
  }

  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie");
  assert.match(cookie, /ers_admin_session=/);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /Secure/i);
  assert.match(cookie, /SameSite=Strict/i);
  assert.match(cookie, /Max-Age=0/i);
});

test("waitlist endpoint rejects unauthorized requests without querying Supabase", async (t) => {
  mockSupabaseFetch(t, () => {
    assert.fail("unauthorized request must not reach Supabase");
  });

  const response = await getAdminWaitlist(
    new Request("https://ers.example/api/admin-waitlist")
  );
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { error: "Unauthorized" });

  const forgedResponse = await getAdminWaitlist(
    new Request("https://ers.example/api/admin-waitlist", {
      headers: { cookie: "ers_admin=true" },
    })
  );
  assert.equal(forgedResponse.status, 401);
});

test("waitlist endpoint authorizes a session and issues explicit paginated queries", async (t) => {
  assert.equal(process.env.ERS_WAITLIST_ADMIN_ENABLED, "true");

  const calls = mockSupabaseFetch(t, ({ url, method }) => {
    if (method === "HEAD") {
      if (url.searchParams.has("created_at")) return countResponse(5);
      if (url.searchParams.has("referred_by")) return countResponse(8);
      return countResponse(42);
    }
    return Response.json(
      [
        {
          email: "runner@example.com",
          created_at: "2026-10-12T08:00:00.000Z",
          referral_code: "RUNNER1",
          referred_by: "FRIEND1",
          referrals_count: 2,
        },
      ],
      { headers: { "content-range": "25-25/42" } }
    );
  });

  const session = await createAdminSession();
  const response = await getAdminWaitlist(
    requestWithSession(
      "https://ers.example/api/admin-waitlist?page=2&search=runner_%",
      session
    )
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const result = await response.json();
  assert.equal(result.totalRows, 42);
  assert.equal(result.metrics.totalSignups, 42);
  assert.equal(result.metrics.recentSignups, 5);
  assert.equal(result.metrics.referralSignups, 8);
  assert.equal(result.rows[0].email, "runner@example.com");
  assert.equal(result.page, 2);
  assert.equal(result.pageSize, 25);

  const listCall = calls.find(
    (call) => call.method !== "HEAD" && call.url.pathname.endsWith("/waitlist")
  );
  assert.ok(listCall);
  assert.equal(
    listCall.url.searchParams.get("select"),
    "email,created_at,referral_code,referred_by,referrals_count"
  );
  assert.equal(listCall.url.searchParams.get("offset"), "25");
  assert.equal(listCall.url.searchParams.get("limit"), "25");
  assert.equal(listCall.url.searchParams.get("email"), "ilike.%runner\\_\\%%");
});

test("CSV endpoint authorizes requests and escapes fields safely", async (t) => {
  assert.equal(process.env.ERS_WAITLIST_ADMIN_ENABLED, "true");

  mockSupabaseFetch(t, () =>
    Response.json([
      {
        email: 'runner,"test"@example.com',
        created_at: "2026-10-12T08:00:00.000Z",
        referral_code: "=HYPERLINK(1)",
        referred_by: "FRIEND,1",
        referrals_count: 2,
      },
    ])
  );

  const session = await createAdminSession();
  const response = await getWaitlistExport(
    requestWithSession("https://ers.example/api/admin-waitlist/export", session)
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.match(
    response.headers.get("content-disposition"),
    /attachment; filename="ers-waitlist\.csv"/
  );
  assert.equal(
    await response.text(),
    [
      '"Email","Signup date","Referral code","Referred by","Referrals received"',
      '"runner,""test""@example.com","2026-10-12T08:00:00.000Z","\'=HYPERLINK(1)","FRIEND,1","2"',
    ].join("\r\n")
  );
});

test("CSV endpoint rejects unauthorized requests without querying Supabase", async (t) => {
  mockSupabaseFetch(t, () => {
    assert.fail("unauthorized export must not reach Supabase");
  });

  const response = await getWaitlistExport(
    new Request("https://ers.example/api/admin-waitlist/export")
  );
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("signup only increments a validated referral after a successful insert", async (t) => {
  const calls = mockSupabaseFetch(t, ({ url, method }) => {
    if (url.hostname === "api.resend.com" && url.pathname === "/emails") {
      return Response.json({ id: "test-email-id" });
    }
    if (url.pathname.endsWith("/rpc/increment_referrals")) {
      return new Response(null, { status: 204 });
    }

    if (method === "POST" && url.pathname.endsWith("/waitlist")) {
      return Response.json({ referral_code: "NEWCODE" });
    }

    if (url.searchParams.get("select") === "referral_code") {
      if (url.searchParams.get("email") === "eq.new@example.com") {
        return Response.json(null);
      }
      if (url.searchParams.get("referral_code") === "eq.FRIEND1") {
        return Response.json({ referral_code: "FRIEND1" });
      }
      return Response.json(null);
    }
    if (url.searchParams.get("select") === "id") return Response.json(null);

    return Response.json({ message: "Unexpected test query" }, { status: 500 });
  });

  const response = await submitWaitlist(
    new Request("https://ers.example/api/waitlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "new@example.com",
        referralCode: "friend1",
      }),
    })
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    data: { referral_code: "NEWCODE" },
  });
  const insert = calls.find(
    (call) => call.method === "POST" && call.url.pathname.endsWith("/waitlist")
  );
  assert.ok(insert);
  assert.equal(JSON.parse(insert.body).referred_by, "FRIEND1");
  const rpc = calls.find((call) =>
    call.url.pathname.endsWith("/rpc/increment_referrals")
  );
  assert.ok(rpc);
  assert.deepEqual(JSON.parse(rpc.body), { code_input: "FRIEND1" });

  const emailCall = calls.find(
    (call) => call.url.hostname === "api.resend.com" && call.url.pathname === "/emails"
  );
  assert.ok(emailCall, "a confirmation email should be sent for a new signup");

  const emailPayload = JSON.parse(emailCall.body);
  assert.equal(emailPayload.from, "ERS Team <waitlist@ers.wankysoftware.com>");
  assert.equal(emailPayload.to, "new@example.com");
  assert.equal(emailPayload.subject, "You're on the ERS waitlist");
  assert.match(emailPayload.html, /You're on the ERS waitlist/);
  assert.match(emailPayload.text, /WE DON'T WAIT\./);
});

test("duplicate waitlist signup does not send another confirmation email", async (t) => {
  const calls = mockSupabaseFetch(t, ({ url }) => {
    if (url.hostname === "api.resend.com") {
      return Response.json({ id: "unexpected-email" });
    }

    if (url.searchParams.get("select") === "referral_code") {
      return Response.json({ referral_code: "EXISTING" });
    }

    return Response.json({ message: "Unexpected test query" }, { status: 500 });
  });

  const response = await submitWaitlist(
    new Request("https://ers.example/api/waitlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "existing@example.com" }),
    })
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    message: "Already on waitlist",
    data: { referral_code: "EXISTING" },
  });
  assert.equal(
    calls.filter((call) => call.url.hostname === "api.resend.com").length,
    0,
    "duplicate signup must not send a confirmation email"
  );
});

test("waitlist signup succeeds when Resend returns an email error", async (t) => {
  const calls = mockSupabaseFetch(t, ({ url, method }) => {
    if (url.hostname === "api.resend.com" && url.pathname === "/emails") {
      return Response.json(
        { message: "Simulated Resend failure" },
        { status: 500 }
      );
    }

    if (method === "POST" && url.pathname.endsWith("/waitlist")) {
      return Response.json({ referral_code: "NEWCODE" });
    }

    if (url.searchParams.get("select") === "referral_code") {
      return Response.json(null);
    }

    if (url.searchParams.get("select") === "id") {
      return Response.json(null);
    }

    return Response.json({ message: "Unexpected test query" }, { status: 500 });
  });

  const response = await submitWaitlist(
    new Request("https://ers.example/api/waitlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "new@example.com" }),
    })
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    data: { referral_code: "NEWCODE" },
  });
  assert.ok(
    calls.some(
      (call) => call.url.hostname === "api.resend.com" && call.url.pathname === "/emails"
    ),
    "the confirmation email should have been attempted"
  );
});

test("referral migration removes public execution and grants only the server role", async () => {
  const migration = await readFile(
    new URL(
      "../supabase/migrations/20261013_secure_increment_referrals.sql",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(migration, /security invoker/i);
  assert.match(
    migration,
    /revoke all privileges on function public\.increment_referrals\(text\)\s+from public, anon, authenticated/i
  );
  assert.match(
    migration,
    /grant execute on function public\.increment_referrals\(text\) to service_role/i
  );
  assert.doesNotMatch(migration, /grant execute[^;]+to anon/i);
  assert.doesNotMatch(migration, /grant execute[^;]+to authenticated/i);
});
