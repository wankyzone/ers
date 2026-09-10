import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const DB_URL =
  process.env.ERS_TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const IDS = {
  client: '00000000-0000-0000-0000-000000000711',
  runner: '00000000-0000-0000-0000-000000000712',
  errand: '00000000-0000-0000-0000-000000000713',
};

const ESCROW_AMOUNT = 5000;
const RUNNER_PAYOUT = 4000;

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
    DELETE FROM public.transactions
    WHERE errand_id = '${IDS.errand}'
       OR user_id IN ('${IDS.client}', '${IDS.runner}');

    DELETE FROM public.errands
    WHERE id = '${IDS.errand}';

    DELETE FROM public.wallets
    WHERE user_id IN ('${IDS.client}', '${IDS.runner}');

    DELETE FROM public.runners
    WHERE id = '${IDS.runner}';

    DELETE FROM public.profiles
    WHERE id IN ('${IDS.client}', '${IDS.runner}');

    DELETE FROM public.users
    WHERE id IN ('${IDS.client}', '${IDS.runner}');

    DELETE FROM auth.users
    WHERE id IN ('${IDS.client}', '${IDS.runner}');
  `);
}

async function createUsers() {
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
    VALUES
      (
        '${IDS.client}',
        'authenticated',
        'authenticated',
        'escrow-release-client@example.com',
        now(),
        now(),
        '{}',
        '{}'
      ),
      (
        '${IDS.runner}',
        'authenticated',
        'authenticated',
        'escrow-release-runner@example.com',
        now(),
        now(),
        '{}',
        '{}'
      );

    INSERT INTO public.users (
      id,
      email,
      full_name,
      role,
      kyc_verified
    )
    VALUES
      (
        '${IDS.client}',
        'escrow-release-client@example.com',
        'Escrow Release Client',
        'client',
        true
      ),
      (
        '${IDS.runner}',
        'escrow-release-runner@example.com',
        'Escrow Release Runner',
        'runner',
        true
      );

    INSERT INTO public.profiles (
      id,
      email,
      role,
      verified
    )
    VALUES
      (
        '${IDS.client}',
        'escrow-release-client@example.com',
        'client',
        true
      ),
      (
        '${IDS.runner}',
        'escrow-release-runner@example.com',
        'runner',
        true
      );

    INSERT INTO public.runners (
      id,
      name,
      email,
      is_available
    )
    VALUES (
      '${IDS.runner}',
      'Escrow Release Runner',
      'escrow-release-runner@example.com',
      true
    );
  `);
}

async function createEscrowState() {
  await psql(`
    INSERT INTO public.wallets (
      user_id,
      balance,
      pending_balance,
      available_balance,
      escrow_balance
    )
    VALUES (
      '${IDS.client}',
      0,
      0,
      0,
      ${ESCROW_AMOUNT}
    );

    INSERT INTO public.wallets (
      user_id,
      balance,
      pending_balance,
      available_balance,
      escrow_balance
    )
    VALUES (
      '${IDS.runner}',
      0,
      0,
      0,
      0
    );

    INSERT INTO public.errands (
      id,
      title,
      description,
      payout_amount,
      price,
      status,
      escrow_status,
      client_id,
      assigned_runner_id,
      assigned_at,
      completed_at
    )
    VALUES (
      '${IDS.errand}',
      'Escrow Release Test Errand',
      'Disposable escrow release integration-test errand',
      ${RUNNER_PAYOUT},
      ${ESCROW_AMOUNT},
      'completed',
      'awaiting_confirmation',
      '${IDS.client}',
      '${IDS.runner}',
      now(),
      now()
    );
  `);
}

async function releaseEscrow() {
  return psql(`
    SELECT
      id,
      status,
      escrow_status,
      completed_at
    FROM public.release_escrow_atomic(
      '${IDS.client}'::uuid,
      '${IDS.errand}'::uuid
    );
  `);
}

async function getErrandState() {
  return psql(`
    SELECT status, escrow_status
    FROM public.errands
    WHERE id = '${IDS.errand}';
  `);
}

async function getClientWallet() {
  return psql(`
    SELECT balance, available_balance, escrow_balance
    FROM public.wallets
    WHERE user_id = '${IDS.client}';
  `);
}

async function getRunnerWallet() {
  return psql(`
    SELECT balance, available_balance, escrow_balance
    FROM public.wallets
    WHERE user_id = '${IDS.runner}';
  `);
}

async function getReleaseTransaction() {
  return psql(`
    SELECT
      amount,
      status,
      type,
      client_id,
      runner_id,
      idempotency_key
    FROM public.transactions
    WHERE errand_id = '${IDS.errand}'
      AND type = 'release';
  `);
}

test('escrow release confirms errand and moves funds exactly once', async () => {
  await cleanup();
  await createUsers();
  await createEscrowState();

  const firstRelease = await releaseEscrow();

  assert.match(firstRelease, new RegExp(IDS.errand));
  assert.match(firstRelease, /confirmed/);
  assert.match(firstRelease, /released/);

  assert.equal(
    await getErrandState(),
    'confirmed|released'
  );

  assert.equal(
    await getClientWallet(),
    '0|0|0',
    'client escrow must be fully released'
  );

  assert.equal(
    await getRunnerWallet(),
    '4000|4000|0',
    'runner must receive the configured payout'
  );

  const transaction = await getReleaseTransaction();

  assert.match(transaction, /5000/);
  assert.match(transaction, /completed/);
  assert.match(transaction, /release/);
  assert.match(transaction, new RegExp(IDS.client));
  assert.match(transaction, new RegExp(IDS.runner));
  assert.match(
    transaction,
    new RegExp(`escrow-release:${IDS.errand}`)
  );

  const secondRelease = await releaseEscrow();

  assert.match(secondRelease, new RegExp(IDS.errand));
  assert.match(secondRelease, /confirmed/);
  assert.match(secondRelease, /released/);

  assert.equal(
    await getClientWallet(),
    '0|0|0',
    'repeated confirmation must not debit escrow twice'
  );

  assert.equal(
    await getRunnerWallet(),
    '4000|4000|0',
    'repeated confirmation must not credit runner twice'
  );

  const transactions = await psql(`
    SELECT count(*)
    FROM public.transactions
    WHERE errand_id = '${IDS.errand}'
      AND type = 'release';
  `);

  assert.equal(
    transactions,
    '1',
    'repeated confirmation must not create another release transaction'
  );

  await cleanup();
});

after(async () => {
  await cleanup();
});
