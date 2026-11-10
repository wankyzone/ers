import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const DB_URL =
  process.env.ERS_TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const USER_ID = '00000000-0000-0000-0000-000000000981';
const REFERENCE = 'ERS-WITHDRAWAL-SETTLEMENT-TEST-001';
const AMOUNT = 1200;

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
    DELETE FROM public.transactions WHERE reference = '${REFERENCE}' OR user_id = '${USER_ID}';
    DELETE FROM public.wallets WHERE user_id = '${USER_ID}';
    DELETE FROM public.profiles WHERE id = '${USER_ID}';
    DELETE FROM public.users WHERE id = '${USER_ID}';
    DELETE FROM auth.users WHERE id = '${USER_ID}';
  `);
}

async function seed(status = 'pending') {
  await cleanup();
  await psql(`
    INSERT INTO auth.users (
      id, aud, role, email, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data
    ) VALUES (
      '${USER_ID}', 'authenticated', 'authenticated',
      'withdrawal-settlement@example.com', now(), now(), '{}', '{}'
    );

    INSERT INTO public.users (id, email, full_name, role, kyc_verified)
    VALUES ('${USER_ID}', 'withdrawal-settlement@example.com', 'Withdrawal Test', 'runner', true);

    SELECT set_config('request.jwt.claim.role', 'service_role', true);


    INSERT INTO public.profiles (id, email, role, verified)
    VALUES ('${USER_ID}', 'withdrawal-settlement@example.com', 'runner', true)
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      role = EXCLUDED.role,
      verified = EXCLUDED.verified;

    INSERT INTO public.wallets (user_id, balance, available_balance, escrow_balance)
    VALUES ('${USER_ID}', 5000, 3800, 0);

    INSERT INTO public.transactions (
      user_id, amount, type, status, reference, payment_provider
    ) VALUES (
      '${USER_ID}', ${AMOUNT}, 'withdraw', '${status}', '${REFERENCE}', 'paystack'
    );
  `);
}

async function settle(outcome) {
  return psql(`
    SELECT status
    FROM public.settle_paystack_withdrawal_atomic('${REFERENCE}', '${outcome}', ${AMOUNT * 100});
  `);
}

async function walletAvailable() {
  return psql(`
    SELECT available_balance FROM public.wallets WHERE user_id = '${USER_ID}';
  `);
}

test('failed transfer refunds available balance exactly once', async () => {
  await seed();

  assert.equal(await settle('failed'), 'failed');
  assert.equal(await walletAvailable(), '5000');

  // Duplicate provider delivery is idempotent and must not refund twice.
  assert.equal(await settle('failed'), 'failed');
  assert.equal(await walletAvailable(), '5000');

  await cleanup();
});

test('successful transfer marks the ledger completed without refunding', async () => {
  await seed();

  assert.equal(await settle('completed'), 'completed');
  assert.equal(await walletAvailable(), '3800');

  // Duplicate success event remains idempotent.
  assert.equal(await settle('completed'), 'completed');
  assert.equal(await walletAvailable(), '3800');

  await cleanup();
});

test('unknown transfer reference cannot mutate any wallet', async () => {
  await seed();

  await assert.rejects(
    () => psql(`
      SELECT *
      FROM public.settle_paystack_withdrawal_atomic('ERS-UNKNOWN-REFERENCE', 'failed', ${AMOUNT * 100});
    `),
    /Withdrawal transaction not found/
  );

  assert.equal(await walletAvailable(), '3800');
  await cleanup();
});


test('transfer amount mismatch cannot settle or refund a withdrawal', async () => {
  await seed();

  await assert.rejects(
    () => psql(`
      SELECT *
      FROM public.settle_paystack_withdrawal_atomic('${REFERENCE}', 'failed', ${(AMOUNT + 1) * 100});
    `),
    /Transfer amount mismatch/
  );

  assert.equal(await walletAvailable(), '3800');
  const status = await psql(`
    SELECT status FROM public.transactions WHERE reference = '${REFERENCE}';
  `);
  assert.equal(status, 'pending');

  await cleanup();
});


after(async () => {
  await cleanup();
});
