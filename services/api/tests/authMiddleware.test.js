import test, { mock } from "node:test";
import assert from "node:assert/strict";

process.env.SUPABASE_URL = "http://127.0.0.1:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY = "unit-test-service-role-key";

const [
  { authenticate },
  {
    authorize,
    authorizeAdmin,
    authorizeCustomer,
    authorizeCustomerOrRoles,
    authorizeRunnerApplication,
    authorizeActiveRunner,
  },
  { default: supabase },
] = await Promise.all([
  import("../modules/protect/authenticate.js"),
  import("../modules/protect/authorize.js"),
  import("../supabase.js"),
]);

const CLIENT_ID = "00000000-0000-0000-0000-000000000201";
const OTHER_ID = "00000000-0000-0000-0000-000000000202";
const RUNNER_ID = "00000000-0000-0000-0000-000000000203";
const ADMIN_ID = "00000000-0000-0000-0000-000000000204";

function installAuthUser(user) {
  mock.method(supabase.auth, "getUser", async (token) => {
    if (token !== "valid-token") {
      return {
        data: { user: null },
        error: new Error("Invalid test token"),
      };
    }

    return { data: { user }, error: null };
  });
}

function installProfile(profile, runnerCapability = {}) {
  mock.method(supabase, "from", (table) => {
    const query = {
      select() {
        return query;
      },
      eq(column, value) {
        assert.equal(
          column,
          table === "kyc_profiles" ? "user_id" : "id"
        );
        query.userId = value;
        return query;
      },
      async single() {
        assert.equal(table, "profiles");
        if (profile?.id !== query.userId) {
          return {
            data: null,
            error: { code: "PGRST116", message: "No rows found" },
          };
        }

        return { data: profile, error: null };
      },
      async maybeSingle() {
        if (table === "kyc_profiles") {
          return {
            data: runnerCapability.approved
              ? { status: "approved" }
              : null,
            error: null,
          };
        }

        if (table === "runners") {
          return {
            data: runnerCapability.active
              ? { is_available: true }
              : runnerCapability.present
                ? { is_available: false }
                : null,
            error: null,
          };
        }

        assert.fail(`Unexpected maybeSingle table: ${table}`);
      },
    };

    return query;
  });
}

function response() {
  return {
    statusCode: null,
    body: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

async function authenticateRequest({
  authorization = "Bearer valid-token",
  user,
  profile,
  headers = {},
  body = {},
  roles = [],
  customerGuard = false,
  customerOrRoles = [],
  runnerApplicationGuard = false,
  activeRunnerGuard = false,
  runnerCapability = {},
}) {
  installAuthUser(user);
  installProfile(profile, runnerCapability);

  const req = {
    headers: { authorization, ...headers },
    body,
  };
  const res = response();
  const next = mock.fn();

  await authenticate(req, res, next);

  if (
    next.mock.calls.length > 0 &&
    (roles.length > 0 ||
      customerGuard ||
      customerOrRoles.length > 0 ||
      runnerApplicationGuard ||
      activeRunnerGuard)
  ) {
    const authorizationResult = response();
    const authorizedNext = mock.fn();
    if (customerGuard) {
      authorizeCustomer()(req, authorizationResult, authorizedNext);
    } else if (runnerApplicationGuard) {
      authorizeRunnerApplication()(req, authorizationResult, authorizedNext);
    } else if (activeRunnerGuard) {
      await authorizeActiveRunner()(req, authorizationResult, authorizedNext);
    } else if (customerOrRoles.length > 0) {
      authorizeCustomerOrRoles(...customerOrRoles)(
        req,
        authorizationResult,
        authorizedNext
      );
    } else {
      authorize(...roles)(req, authorizationResult, authorizedNext);
    }
    return {
      req,
      res: authorizationResult,
      next: authorizedNext,
    };
  }

  return { req, res, next };
}

test.afterEach(() => {
  mock.restoreAll();
});

test("accepts a verified Auth customer with a matching profile", async () => {
  const result = await authenticateRequest({
    user: {
      id: CLIENT_ID,
      email: "customer@example.test",
      email_confirmed_at: "2026-01-01T00:00:00.000Z",
    },
    profile: {
      id: CLIENT_ID,
      email: "customer@example.test",
      role: "client",
      verified: false,
    },
    customerGuard: true,
  });

  assert.equal(result.next.mock.calls.length, 1);
  assert.equal(result.req.user.id, CLIENT_ID);
  assert.equal(result.req.user.role, "client");
  assert.equal(result.req.user.emailVerified, true);
});

test("customer access rejects unverified Auth users despite profile and request claims", async () => {
  const result = await authenticateRequest({
    user: {
      id: CLIENT_ID,
      email: "customer@example.test",
      email_confirmed_at: null,
    },
    profile: {
      id: CLIENT_ID,
      email: "customer@example.test",
      role: "client",
      verified: true,
    },
    headers: {
      "x-email-verified": "true",
      "x-user-id": OTHER_ID,
      "x-role": "admin",
    },
    body: {
      id: OTHER_ID,
      role: "admin",
      email_confirmed_at: "2026-01-01T00:00:00.000Z",
    },
    customerGuard: true,
  });

  assert.equal(result.res.statusCode, 403);
  assert.equal(result.res.body.message, "Email verification is required.");
  assert.equal(result.next.mock.calls.length, 0);
});

test("customer access rejects malformed Auth confirmation timestamps", async () => {
  for (const email_confirmed_at of [
    "yesterday",
    "2026-02-31T00:00:00.000Z",
  ]) {
    const result = await authenticateRequest({
      user: {
        id: CLIENT_ID,
        email: "customer@example.test",
        email_confirmed_at,
      },
      profile: {
        id: CLIENT_ID,
        role: "client",
      },
      customerGuard: true,
    });

    assert.equal(result.res.statusCode, 403, email_confirmed_at);
    assert.equal(result.next.mock.calls.length, 0, email_confirmed_at);
    mock.restoreAll();
  }
});

test("verified Auth users receive customer access independent of profile role", async () => {
  const result = await authenticateRequest({
    user: {
      id: RUNNER_ID,
      email_confirmed_at: "2026-01-01T00:00:00.000Z",
    },
    profile: { id: RUNNER_ID, role: "runner" },
    customerGuard: true,
  });

  assert.equal(result.next.mock.calls.length, 1);
  assert.equal(result.req.user.emailVerified, true);
});

test("unverified runner account is denied, while verified suspended runner keeps customer access", async () => {
  const runner = await authenticateRequest({
    user: { id: RUNNER_ID, email: "runner@example.test" },
    profile: { id: RUNNER_ID, role: "runner", verified: true },
    customerOrRoles: ["runner"],
  });
  assert.equal(runner.res.statusCode, 403);
  assert.equal(runner.next.mock.calls.length, 0);

  mock.restoreAll();

  const suspendedRunner = await authenticateRequest({
    user: {
      id: RUNNER_ID,
      email: "runner@example.test",
      email_confirmed_at: "2026-01-01T00:00:00.000Z",
    },
    profile: { id: RUNNER_ID, role: "runner", verified: true },
    customerOrRoles: ["runner"],
  });

  assert.equal(suspendedRunner.next.mock.calls.length, 1);
  assert.equal(suspendedRunner.req.user.id, RUNNER_ID);
});

test("runner application access requires verified email but not runner approval", async () => {
  const pendingRunner = await authenticateRequest({
    user: {
      id: RUNNER_ID,
      email_confirmed_at: "2026-01-01T00:00:00.000Z",
    },
    profile: { id: RUNNER_ID, role: "runner", verified: false },
    runnerApplicationGuard: true,
  });

  assert.equal(pendingRunner.next.mock.calls.length, 1);

  mock.restoreAll();

  const unverifiedRunner = await authenticateRequest({
    user: { id: RUNNER_ID },
    profile: { id: RUNNER_ID, role: "runner", verified: false },
    runnerApplicationGuard: true,
  });

  assert.equal(unverifiedRunner.res.statusCode, 403);
  assert.equal(unverifiedRunner.next.mock.calls.length, 0);
});

test("runner-only capability requires approval and active status", async () => {
  const activeRunner = await authenticateRequest({
    user: {
      id: RUNNER_ID,
      email_confirmed_at: "2026-01-01T00:00:00.000Z",
    },
    profile: { id: RUNNER_ID, role: "runner", verified: true },
    runnerCapability: { approved: true, active: true },
    activeRunnerGuard: true,
  });

  assert.equal(activeRunner.next.mock.calls.length, 1);

  mock.restoreAll();

  const pendingRunner = await authenticateRequest({
    user: {
      id: RUNNER_ID,
      email_confirmed_at: "2026-01-01T00:00:00.000Z",
    },
    profile: { id: RUNNER_ID, role: "runner", verified: false },
    runnerCapability: { approved: false, active: true },
    activeRunnerGuard: true,
  });

  assert.equal(pendingRunner.res.statusCode, 403);
  assert.equal(pendingRunner.next.mock.calls.length, 0);

  mock.restoreAll();

  const suspendedRunner = await authenticateRequest({
    user: {
      id: RUNNER_ID,
      email_confirmed_at: "2026-01-01T00:00:00.000Z",
    },
    profile: { id: RUNNER_ID, role: "runner", verified: true },
    runnerCapability: { approved: true, active: false, present: true },
    activeRunnerGuard: true,
  });

  assert.equal(suspendedRunner.res.statusCode, 403);
  assert.equal(suspendedRunner.next.mock.calls.length, 0);
});

test("rejects requests without a bearer token", async () => {
  const result = await authenticateRequest({
    authorization: null,
    user: {
      id: CLIENT_ID,
      email_confirmed_at: "2026-01-01T00:00:00.000Z",
    },
    profile: { id: CLIENT_ID, role: "client" },
  });

  assert.equal(result.res.statusCode, 401);
  assert.equal(result.next.mock.calls.length, 0);
});

test("rejects invalid or expired bearer tokens", async () => {
  const result = await authenticateRequest({
    authorization: "Bearer expired-token",
    user: {
      id: CLIENT_ID,
      email_confirmed_at: "2026-01-01T00:00:00.000Z",
    },
    profile: { id: CLIENT_ID, role: "client" },
  });

  assert.equal(result.res.statusCode, 401);
  assert.equal(result.next.mock.calls.length, 0);
});

test("rejects Auth users without a profile", async () => {
  const result = await authenticateRequest({
    user: {
      id: CLIENT_ID,
      email_confirmed_at: "2026-01-01T00:00:00.000Z",
    },
    profile: null,
    roles: ["client"],
  });

  assert.equal(result.res.statusCode, 403);
  assert.equal(result.next.mock.calls.length, 0);
});

test("uses Auth identity and profile role instead of caller-supplied identity or role", async () => {
  const result = await authenticateRequest({
    user: {
      id: CLIENT_ID,
      email: "customer@example.test",
      email_confirmed_at: "2026-01-01T00:00:00.000Z",
    },
    profile: {
      id: CLIENT_ID,
      email: "customer@example.test",
      role: "client",
    },
    headers: {
      "x-user-id": OTHER_ID,
      "x-role": "admin",
    },
    body: {
      id: OTHER_ID,
      role: "admin",
    },
    roles: ["client"],
  });

  assert.equal(result.next.mock.calls.length, 1);
  assert.equal(result.req.user.id, CLIENT_ID);
  assert.equal(result.req.user.role, "client");
});

test("verified active runner and existing admin authorization are preserved", async () => {
  const runner = await authenticateRequest({
    user: {
      id: RUNNER_ID,
      email: "runner@example.test",
      email_confirmed_at: "2026-01-01T00:00:00.000Z",
    },
    profile: { id: RUNNER_ID, role: "runner", verified: true },
    runnerCapability: { approved: true, active: true },
    activeRunnerGuard: true,
  });

  assert.equal(runner.next.mock.calls.length, 1);
  assert.equal(runner.res.statusCode, null);

  mock.restoreAll();

  const adminUser = {
    id: ADMIN_ID,
    email: "admin@example.test",
  };
  installAuthUser(adminUser);
  installProfile({ id: ADMIN_ID, role: "admin" });

  const req = { headers: { authorization: "Bearer valid-token" } };
  const authRes = response();
  const authenticatedNext = mock.fn();
  await authenticate(req, authRes, authenticatedNext);

  const adminRes = response();
  const adminNext = mock.fn();
  authorizeAdmin()(req, adminRes, adminNext);

  assert.equal(authenticatedNext.mock.calls.length, 1);
  assert.equal(adminNext.mock.calls.length, 1);
  assert.equal(adminRes.statusCode, null);
});

test("customer role authorization rejects an ineligible profile role", async () => {
  const result = await authenticateRequest({
    user: {
      id: CLIENT_ID,
      email_confirmed_at: "2026-01-01T00:00:00.000Z",
    },
    profile: { id: CLIENT_ID, role: "runner" },
    roles: ["client"],
  });

  assert.equal(result.res.statusCode, 403);
  assert.equal(result.next.mock.calls.length, 0);
});
