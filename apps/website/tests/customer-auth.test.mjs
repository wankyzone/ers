import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  getLoginErrorMessage,
  getSafeCustomerRedirectPath,
  getSignupOutcome,
  requestCustomerPasswordReset,
  signInCustomer,
  signOutCustomer,
  signUpCustomer,
  updateCustomerPassword,
} from "../lib/customer-auth.ts";
import {
  validateCustomerLogin,
  validateCustomerSignup,
  validatePasswordRecovery,
  validatePasswordReset,
} from "../lib/customer-auth-validation.ts";
import {
  ensureCustomerProfile,
  isEmailVerified,
  isCustomerRole,
  requireCustomerUser,
  updateCustomerProfileName,
} from "../lib/customer-profile.ts";
import { proxy } from "../proxy.ts";
import { NextRequest } from "next/server.js";

function createProfileClient({ user, profile }) {
  let currentProfile = profile;
  const lookups = [];
  const inserts = [];
  const updates = [];
  const query = {
    select() {
      return this;
    },
    eq(field, value) {
      lookups.push({ field, value });
      return this;
    },
    async maybeSingle() {
      return { data: currentProfile, error: null };
    },
    async insert(values) {
      inserts.push(values);
      currentProfile = values;
      return { data: null, error: null };
    },
    update(values) {
      updates.push(values);
      return this;
    },
    async single() {
      return { data: currentProfile, error: null };
    },
  };

  return {
    lookups,
    inserts,
    updates,
    auth: {
      async getUser() {
        return { data: { user }, error: null };
      },
    },
    from(table) {
      assert.equal(table, "profiles");
      return query;
    },
  };
}

test("customer signup validates fields and does not assign a role", async () => {
  assert.equal(
    validateCustomerSignup({
      fullName: "Ada Example",
      email: " ADA@example.com ",
      password: "a-secure-password",
      confirmPassword: "a-secure-password",
    }),
    null,
  );
  assert.match(
    validateCustomerSignup({
      fullName: "A",
      email: "not-an-email",
      password: "short",
      confirmPassword: "different",
    }),
    /name between 2 and 100/i,
  );

  let signupInput;
  await signUpCustomer(
    {
      async signUp(input) {
        signupInput = input;
        return { data: { user: {}, session: null }, error: null };
      },
    },
    {
      email: "ada@example.com",
      password: "a-secure-password",
      fullName: "Ada Example",
      emailRedirectTo: "https://ers.example/auth/callback?next=/customer",
    },
  );
  assert.deepEqual(signupInput.options.data, { full_name: "Ada Example" });
  assert.equal("role" in signupInput.options.data, false);
  assert.equal(getSignupOutcome(null, true, true), "authenticated");
  assert.equal(getSignupOutcome(null, true, false), "verification-required");
  assert.equal(getSignupOutcome(null, false, false), "verification-required");
});

test("duplicate registration and email verification use enumeration-safe outcomes", () => {
  assert.equal(
    getSignupOutcome({ message: "User already registered" }, false, false),
    "verification-required",
  );
  assert.equal(getSignupOutcome({ message: "Unexpected provider error" }, false, false), "error");
});

test("customer login validates input and uses generic credential errors", async () => {
  assert.equal(
    validateCustomerLogin({ email: "customer@example.com", password: "eightchars" }),
    null,
  );
  assert.match(
    validateCustomerLogin({ email: "invalid", password: "short" }),
    /valid email/i,
  );
  assert.equal(getLoginErrorMessage("Invalid login credentials"), "Email or password is incorrect.");
  assert.equal(getLoginErrorMessage("Email not confirmed"), "Verify your email before signing in.");

  let credentials;
  await signInCustomer(
    {
      async signInWithPassword(input) {
        credentials = input;
        return { data: { user: {}, session: {} }, error: null };
      },
    },
    "customer@example.com",
    "eightchars",
  );
  assert.deepEqual(credentials, {
    email: "customer@example.com",
    password: "eightchars",
  });
});

test("password recovery and reset validate inputs and use Supabase auth methods", async () => {
  assert.equal(validatePasswordRecovery("person@example.com"), null);
  assert.match(validatePasswordRecovery("invalid"), /valid email/i);
  assert.equal(
    validatePasswordReset({ password: "new-password", confirmPassword: "new-password" }),
    null,
  );
  assert.match(
    validatePasswordReset({ password: "new-password", confirmPassword: "different" }),
    /do not match/i,
  );

  const calls = [];
  const auth = {
    async resetPasswordForEmail(...args) {
      calls.push(["recovery", ...args]);
      return { data: {}, error: null };
    },
    async updateUser(...args) {
      calls.push(["update", ...args]);
      return { data: {}, error: null };
    },
    async signOut(...args) {
      calls.push(["signout", ...args]);
      return { error: null };
    },
  };

  await requestCustomerPasswordReset(
    auth,
    "person@example.com",
    "https://ers.example/auth/callback?next=/reset-password",
  );
  await updateCustomerPassword(auth, "new-password");
  await signOutCustomer(auth);
  assert.deepEqual(calls, [
    [
      "recovery",
      "person@example.com",
      { redirectTo: "https://ers.example/auth/callback?next=/reset-password" },
    ],
    ["update", { password: "new-password" }],
    ["signout"],
  ]);
});

test("auth callback only redirects to approved local customer paths", () => {
  assert.equal(getSafeCustomerRedirectPath("/customer"), "/customer");
  assert.equal(getSafeCustomerRedirectPath("/reset-password"), "/reset-password");
  assert.equal(getSafeCustomerRedirectPath("https://attacker.example"), "/customer");
  assert.equal(getSafeCustomerRedirectPath("//attacker.example"), "/customer");
});

test("profile provisioning uses the authenticated ID and never trusts metadata roles", async () => {
  const user = {
    id: "authenticated-user-id",
    email: "person@example.com",
    user_metadata: { full_name: "Person Example", role: "runner" },
  };
  const client = createProfileClient({ user, profile: null });
  const result = await ensureCustomerProfile(client, user);

  assert.equal(result.id, user.id);
  assert.equal(client.lookups[0].value, user.id);
  assert.deepEqual(client.inserts, [
    {
      id: user.id,
      full_name: "Person Example",
      role: "client",
    },
  ]);
});

test("customer profile updates are scoped to the authenticated user ID", async () => {
  const user = {
    id: "authenticated-user-id",
    email: "person@example.com",
    user_metadata: {},
  };
  const client = createProfileClient({
    user,
    profile: {
      id: user.id,
      email: user.email,
      full_name: "Old Name",
      role: "client",
    },
  });
  const { data, error } = await updateCustomerProfileName(
    client,
    user,
    "New Name",
  );

  assert.equal(error, null);
  assert.equal(data.id, user.id);
  assert.deepEqual(client.updates, [{ full_name: "New Name" }]);
  assert.equal(client.lookups.at(-1).value, user.id);
});

test("unauthenticated users and non-customer roles are denied customer access", async () => {
  const unauthenticated = createProfileClient({ user: null, profile: null });
  assert.deepEqual(await requireCustomerUser(unauthenticated), {
    user: null,
    profile: null,
  });
  assert.equal(unauthenticated.lookups.length, 0);

  const runner = createProfileClient({
    user: { id: "runner-user-id", email: "runner@example.com", user_metadata: {} },
    profile: {
      id: "runner-user-id",
      email: "runner@example.com",
      full_name: null,
      role: "runner",
    },
  });
  assert.equal((await requireCustomerUser(runner)).user, null);
  assert.equal(isEmailVerified({ email_confirmed_at: "2026-01-01T00:00:00Z" }), true);
  assert.equal(isEmailVerified({ email_confirmed_at: null }), false);
  assert.equal(isCustomerRole("client"), true);
  assert.equal(isCustomerRole("runner"), false);
  assert.equal(isCustomerRole("admin"), false);
});

test("customer route proxy redirects unauthenticated users and admits customer roles only", async (t) => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://unit-test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "unit-test-anon-key";

  t.after(() => {
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
  });

  const unauthenticated = await proxy(
    new NextRequest("https://ers.example/customer"),
  );
  assert.equal(unauthenticated.status, 307);
  assert.equal(new URL(unauthenticated.headers.get("location")).pathname, "/login");
  assert.equal(
    new URL(unauthenticated.headers.get("location")).searchParams.get("next"),
    "/customer",
  );

  const user = {
    id: "customer-user-id",
    email: "customer@example.com",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    email_confirmed_at: "2026-01-01T00:00:00Z",
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };
  const sessionCookie = `base64-${Buffer.from(
    JSON.stringify({
      access_token: "unit-test-access-token",
      refresh_token: "unit-test-refresh-token",
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user,
    }),
  ).toString("base64url")}`;

  const runWithRole = async (role) => {
    t.mock.method(globalThis, "fetch", async (input) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.pathname === "/auth/v1/user") return Response.json(user);
      if (url.pathname === "/rest/v1/profiles") {
        return Response.json({ id: user.id, role });
      }
      assert.fail(`Unexpected auth request: ${url.pathname}`);
    });

    const request = new NextRequest("https://ers.example/customer");
    request.cookies.set("sb-unit-test-auth-token", sessionCookie);
    const response = await proxy(request);
    t.mock.restoreAll();
    return response;
  };

  const customerResponse = await runWithRole("client");
  assert.equal(customerResponse.status, 200);
  assert.equal(customerResponse.headers.get("x-middleware-next"), "1");

  const runnerResponse = await runWithRole("runner");
  assert.equal(runnerResponse.status, 307);
  assert.equal(
    new URL(runnerResponse.headers.get("location")).searchParams.get("error"),
    "role",
  );
});

test("customer profile migration prevents role escalation and scopes self access", async () => {
  const migration = await readFile(
    new URL("../supabase/migrations/20261122111500_customer_identity_web.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /values\s*\([\s\S]*?'client'\s*\)/i);
  assert.doesNotMatch(migration, /raw_user_meta_data\s*->>\s*'role'/i);
  assert.match(migration, /id\s*=\s*\(select auth\.uid\(\)\)/i);
  assert.match(migration, /grant update \(full_name\)/i);
  assert.match(migration, /grant insert \(id, full_name, role\)/i);
  assert.doesNotMatch(migration, /grant insert \([^)]*email/i);
  assert.match(migration, /foreign key \(id\) references auth\.users\(id\)[\s\S]*not valid/i);
});
