import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const DB_URL =
  process.env.ERS_TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const USER_ID = '00000000-0000-0000-0000-000000000991';

async function psql(sql) {
  const { stdout } = await execFileAsync(
    'psql',
    [DB_URL, '--no-psqlrc', '--tuples-only', '--no-align', '-c', sql],
    { maxBuffer: 10 * 1024 * 1024 }
  );
  return stdout.trim();
}

async function cleanup() {
  await psql(`
    DELETE FROM public.kyc_profiles WHERE user_id = '${USER_ID}';
    DELETE FROM public.profiles WHERE id = '${USER_ID}';
    DELETE FROM auth.users WHERE id = '${USER_ID}';
  `);
}

test('signup metadata cannot create an administrator profile', async () => {
  await cleanup();

  await psql(`
    INSERT INTO auth.users (
      id, aud, role, email, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data
    ) VALUES (
      '${USER_ID}', 'authenticated', 'authenticated',
      'role-hardening@example.com', now(), now(),
      '{}', '{"role":"admin"}'::jsonb
    );
  `);

  const role = await psql(`
    SELECT role FROM public.profiles WHERE id = '${USER_ID}';
  `);

  assert.equal(role, 'client');

  await cleanup();
});

test('runner role is granted only through trusted KYC approval', async () => {
  await cleanup();

  await psql(`
    INSERT INTO auth.users (
      id, aud, role, email, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data
    ) VALUES (
      '${USER_ID}', 'authenticated', 'authenticated',
      'runner-promotion@example.com', now(), now(),
      '{}', '{"role":"admin"}'::jsonb
    );

    INSERT INTO public.kyc_profiles (
      user_id, full_name, phone, bvn, bank_code, account_number, account_name, status
    ) VALUES (
      '${USER_ID}', 'Test Runner', '08000000000', '12345678901',
      '044', '0123456789', 'TEST RUNNER', 'pending'
    );

    SELECT set_config('request.jwt.claim.role', 'service_role', true);

    SELECT *
    FROM public.approve_runner_kyc_atomic(
      (SELECT id FROM public.kyc_profiles WHERE user_id = '${USER_ID}')
    );
  `);

  const result = await psql(`
    SELECT p.role || '|' || p.verified || '|' || k.status
    FROM public.profiles p
    JOIN public.kyc_profiles k ON k.user_id = p.id
    WHERE p.id = '${USER_ID}';
  `);

  assert.equal(result, 'runner|true|approved');

  await cleanup();
});

test('financial and identity tables have RLS enabled and client grants are least-privilege', async () => {
  const rlsEnabled = await psql(`
    SELECT count(*) || '|' || CASE WHEN bool_and(c.relrowsecurity) THEN 'true' ELSE 'false' END
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = ANY (ARRAY[
        'profiles', 'wallets', 'transactions', 'payments', 'errands',
        'errand_events', 'errand_logs', 'users', 'kyc_profiles',
        'otp_codes', 'user_devices', 'jobs', 'job_logs',
        'system_logs', 'orchestrator_retry_log', 'runners', 'audit_logs',
        'platform_commission_entries',
        'platform_commission_reconciliation_exceptions',
        'financial_journal_entries', 'financial_journal_lines'
      ]);
  `);

  assert.equal(rlsEnabled, '21|true');

  const privileges = await psql(`
    SELECT
      has_table_privilege('anon', 'public.wallets', 'SELECT'),
      has_table_privilege('authenticated', 'public.wallets', 'SELECT'),
      has_table_privilege('authenticated', 'public.wallets', 'UPDATE'),
      has_table_privilege('authenticated', 'public.profiles', 'INSERT'),
      has_table_privilege('authenticated', 'public.profiles', 'UPDATE'),
      has_table_privilege('authenticated', 'public.transactions', 'SELECT'),
      has_table_privilege('anon', 'public.platform_commission_entries', 'SELECT'),
      has_table_privilege('authenticated', 'public.platform_commission_entries', 'SELECT'),
      has_table_privilege('anon', 'public.financial_journal_entries', 'SELECT'),
      has_table_privilege('authenticated', 'public.financial_journal_lines', 'SELECT');
  `);

  assert.equal(
    privileges,
    'f|t|f|f|f|f|f|f|f|f',
    'client roles may read only their RLS-scoped wallet/profile/errand surfaces; they cannot write financial state'
  );
});

test('exactly one hardened signup trigger is bound to the auth profile function', async () => {
  const count = await psql(`
    SELECT count(*)
    FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'auth.users'::regclass
      AND tgfoid = 'public.handle_new_user()'::regprocedure
      AND NOT tgisinternal;
  `);

  assert.equal(count, '1');
});

test('profile, wallet, and errand policies contain only the intended access rules', async () => {
  const policies = await psql(`
    SELECT
      (SELECT string_agg(policyname, ',') FROM pg_catalog.pg_policies
       WHERE schemaname = 'public' AND tablename = 'profiles'),
      (SELECT string_agg(policyname, ',') FROM pg_catalog.pg_policies
       WHERE schemaname = 'public' AND tablename = 'wallets'),
      (SELECT string_agg(policyname, ',') FROM pg_catalog.pg_policies
       WHERE schemaname = 'public' AND tablename = 'errands');
  `);

  assert.equal(
    policies,
    'profiles_select_self|wallets_select_self|errands_select_participant_or_available'
  );
});

test('privileged financial RPCs are not executable by anon or authenticated', async () => {
  const grants = await psql(`
    SELECT
      has_function_privilege('anon', 'public.release_escrow_atomic(uuid,uuid)', 'EXECUTE'),
      has_function_privilege('authenticated', 'public.release_escrow_atomic(uuid,uuid)', 'EXECUTE'),
      has_function_privilege('service_role', 'public.release_escrow_atomic(uuid,uuid)', 'EXECUTE'),
      has_function_privilege('anon', 'public.approve_runner_kyc_atomic(uuid)', 'EXECUTE'),
      has_function_privilege('authenticated', 'public.approve_runner_kyc_atomic(uuid)', 'EXECUTE'),
      has_function_privilege('service_role', 'public.approve_runner_kyc_atomic(uuid)', 'EXECUTE'),
      has_function_privilege('anon', 'public.create_errand_atomic(uuid,text,text,numeric,text)', 'EXECUTE'),
      has_function_privilege('authenticated', 'public.create_errand_atomic(uuid,text,text,numeric,text)', 'EXECUTE'),
      has_function_privilege('service_role', 'public.create_errand_atomic(uuid,text,text,numeric,text)', 'EXECUTE'),
      has_function_privilege('authenticated', 'public.credit_paystack_wallet_atomic(uuid,text,numeric)', 'EXECUTE');
  `);

  assert.equal(grants, 'f|f|t|f|f|t|f|f|t|f');
});

after(async () => {
  await cleanup();
});
