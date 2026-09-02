import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const DB_URL =
  process.env.ERS_TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const IDS = {
  client: '00000000-0000-0000-0000-000000000221',
  errand: '00000000-0000-0000-0000-000000000321',
  retryErrand: '00000000-0000-0000-0000-000000000322',
  conflictErrand: '00000000-0000-0000-0000-000000000323',
  insufficientErrand: '00000000-0000-0000-0000-000000000324',
};

const KEYS = {
  success: 'sprint6-create-success-001',
  retry: 'sprint6-create-retry-001',
  conflict: 'sprint6-create-conflict-001',
  insufficient: 'sprint6-create-insufficient-001',
};

async function psql(sql) {
  const { stdout } = await execFileAsync(
    'psql',
    [DB_URL, '--no-psqlrc', '--tuples-only', '--no-align', '-c', sql],
    { maxBuffer: 10 * 1024 * 1024 }
  );

  return stdout.trim();
}

async function psqlExpectFailure(sql) {
  try {
    await execFileAsync(
      'psql',
      [DB_URL, '--no-psqlrc', '--tuples-only', '--no-align', '-c', sql],
      { maxBuffer: 10 * 1024 * 1024 }
    );
  } catch (error) {
    return `${error.stderr ?? ''}${error.stdout ?? ''}`.trim();
  }

  throw new Error('Expected PostgreSQL command to fail, but it succeeded');
}

async function createAuthUser(id, email) {
  await psql(`
    INSERT INTO auth.users (
      id,
      aud,
      role,
      email,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data
    )
    VALUES (
      '${id}',
      'authenticated',
      'authenticated',
      '${email}',
      now(),
      now(),
      '{}',
      '{}'
    );
  `);
}

async function createClient() {
  await createAuthUser(
    IDS.client,
    'sprint6-create-client@example.com'
  );

  await psql(`
    INSERT INTO public.users (
      id,
      email,
      full_name,
      role,
      kyc_verified
    )
    VALUES (
      '${IDS.client}',
      'sprint6-create-client@example.com',
      'Sprint 6 Create Test Client',
      'client',
      true
    );

    INSERT INTO public.wallets (
      user_id,
      balance,
      escrow_balance
    )
    VALUES (
      '${IDS.client}',
      100000,
      0
    );
  `);
}

async function setWalletBalance(balance) {
  await psql(`
    UPDATE public.wallets
    SET balance = ${balance},
        escrow_balance = 0
    WHERE user_id = '${IDS.client}';
  `);
}

async function createErrandAtomic({
  title,
  description,
  pickup,
  delivery,
  price,
  idempotencyKey,
}) {
  return psql(`
    SELECT
      id,
      title,
      description,
      pickup_location,
      delivery_location,
      client_id,
      price,
      payout_amount,
      status,
      escrow_status,
      escrow_locked_at
    FROM public.create_errand_atomic(
      '${IDS.client}'::uuid,
      '${title.replaceAll("'", "''")}',
      '${description.replaceAll("'", "''")}',
      '${pickup.replaceAll("'", "''")}',
      '${delivery.replaceAll("'", "''")}',
      ${price},
      '${idempotencyKey.replaceAll("'", "''")}'
    );
  `);
}

async function cleanup() {
  await psql(`
    DELETE FROM public.transactions
    WHERE user_id = '${IDS.client}';

    DELETE FROM public.errands
    WHERE client_id = '${IDS.client}';

    DELETE FROM public.wallets
    WHERE user_id = '${IDS.client}';

    DELETE FROM public.users
    WHERE id = '${IDS.client}';

    DELETE FROM auth.users
    WHERE id = '${IDS.client}';
  `);
}

test('successful creation persists locations and locks escrow', async () => {
  await cleanup();
  await createClient();

  const result = await createErrandAtomic({
    title: 'Pickup documents',
    description: 'Collect documents and deliver them',
    pickup: 'Lekki Phase 1',
    delivery: 'Victoria Island',
    price: 10000,
    idempotencyKey: KEYS.success,
  });

  const [
    id,
    title,
    description,
    pickup,
    delivery,
    clientId,
    price,
    payout,
    status,
    escrowStatus,
    escrowLockedAt,
  ] = result.split('|');

  assert.match(id, /^[0-9a-f-]{36}$/);
  assert.equal(title, 'Pickup documents');
  assert.equal(description, 'Collect documents and deliver them');
  assert.equal(pickup, 'Lekki Phase 1');
  assert.equal(delivery, 'Victoria Island');
  assert.equal(clientId, IDS.client);
  assert.equal(price, '10000');
  assert.equal(payout, '8000');
  assert.equal(status, 'created');
  assert.equal(escrowStatus, 'locked');
  assert.ok(escrowLockedAt);

  const wallet = await psql(`
    SELECT balance, escrow_balance
    FROM public.wallets
    WHERE user_id = '${IDS.client}';
  `);

  assert.equal(wallet, '90000|10000');
});

test('idempotent retry returns the original errand without double charging', async () => {
  await cleanup();
  await createClient();

  const first = await createErrandAtomic({
    title: 'Buy groceries',
    description: 'Weekly groceries',
    pickup: 'Lekki Phase 1',
    delivery: 'Ajah',
    price: 12000,
    idempotencyKey: KEYS.retry,
  });

  const second = await createErrandAtomic({
    title: 'Buy groceries',
    description: 'Weekly groceries',
    pickup: 'Lekki Phase 1',
    delivery: 'Ajah',
    price: 12000,
    idempotencyKey: KEYS.retry,
  });

  const firstId = first.split('|')[0];
  const secondId = second.split('|')[0];

  assert.equal(firstId, secondId);

  const counts = await psql(`
    SELECT
      (SELECT COUNT(*) FROM public.errands WHERE client_id = '${IDS.client}') ||
      '|' ||
      (SELECT COUNT(*) FROM public.transactions
       WHERE user_id = '${IDS.client}'
         AND idempotency_key = '${KEYS.retry}') ||
      '|' ||
      (SELECT balance FROM public.wallets WHERE user_id = '${IDS.client}') ||
      '|' ||
      (SELECT escrow_balance FROM public.wallets WHERE user_id = '${IDS.client}');
  `);

  assert.equal(counts, '1|1|88000|12000');
});

test('reusing an idempotency key with different request data is rejected', async () => {
  await cleanup();
  await createClient();

  await createErrandAtomic({
    title: 'Original errand',
    description: 'Original request',
    pickup: 'Lekki Phase 1',
    delivery: 'Ikoyi',
    price: 15000,
    idempotencyKey: KEYS.conflict,
  });

  const output = await psqlExpectFailure(`
    SELECT *
    FROM public.create_errand_atomic(
      '${IDS.client}'::uuid,
      'Different errand',
      'Different request',
      'Ajah',
      'Yaba',
      20000,
      '${KEYS.conflict}'
    );
  `);

  assert.match(
    output,
    /Idempotency key already used with different request data/
  );

  const state = await psql(`
    SELECT
      (SELECT COUNT(*) FROM public.errands WHERE client_id = '${IDS.client}') ||
      '|' ||
      (SELECT balance FROM public.wallets WHERE user_id = '${IDS.client}') ||
      '|' ||
      (SELECT escrow_balance FROM public.wallets WHERE user_id = '${IDS.client}');
  `);

  assert.equal(state, '1|85000|15000');
});

test('insufficient balance rejects creation without changing wallet or creating ledger entry', async () => {
  await cleanup();
  await createClient();
  await setWalletBalance(5000);

  const output = await psqlExpectFailure(`
    SELECT *
    FROM public.create_errand_atomic(
      '${IDS.client}'::uuid,
      'Expensive errand',
      'Insufficient funds test',
      'Lekki Phase 1',
      'Ikeja',
      10000,
      '${KEYS.insufficient}'
    );
  `);

  assert.match(output, /Insufficient balance/);

  const state = await psql(`
    SELECT
      (SELECT COUNT(*) FROM public.errands WHERE client_id = '${IDS.client}') ||
      '|' ||
      (SELECT balance FROM public.wallets WHERE user_id = '${IDS.client}') ||
      '|' ||
      (SELECT escrow_balance FROM public.wallets WHERE user_id = '${IDS.client}') ||
      '|' ||
      (SELECT COUNT(*) FROM public.transactions
       WHERE user_id = '${IDS.client}'
         AND idempotency_key = '${KEYS.insufficient}');
  `);

  assert.equal(state, '0|5000|0|0');
});

test('missing pickup or delivery location is rejected', async () => {
  await cleanup();
  await createClient();

  const missingPickup = await psqlExpectFailure(`
    SELECT *
    FROM public.create_errand_atomic(
      '${IDS.client}'::uuid,
      'Missing pickup',
      'Location validation test',
      '',
      'Victoria Island',
      5000,
      'sprint6-create-missing-pickup-001'
    );
  `);

  assert.match(missingPickup, /Pickup location is required/);

  const missingDelivery = await psqlExpectFailure(`
    SELECT *
    FROM public.create_errand_atomic(
      '${IDS.client}'::uuid,
      'Missing delivery',
      'Location validation test',
      'Lekki Phase 1',
      '',
      5000,
      'sprint6-create-missing-delivery-001'
    );
  `);

  assert.match(missingDelivery, /Delivery location is required/);
});

after(async () => {
  await cleanup();
});
