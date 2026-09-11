import '../env.js';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const { runEscrowAutoRelease } = await import('../jobs/escrow.js');

const execFileAsync = promisify(execFile);

const DB_URL =
  process.env.ERS_TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const IDS = {
  client: '00000000-0000-0000-0000-000000000721',
  runner: '00000000-0000-0000-0000-000000000722',
  eligibleErrand: '00000000-0000-0000-0000-000000000723',
  ineligibleErrand: '00000000-0000-0000-0000-000000000724',
  failureErrand: '00000000-0000-0000-0000-000000000725',
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
    WHERE errand_id IN (
      '${IDS.eligibleErrand}',
      '${IDS.ineligibleErrand}',
      '${IDS.failureErrand}'
    )
    OR user_id IN ('${IDS.client}', '${IDS.runner}');

    DELETE FROM public.errands
    WHERE id IN (
      '${IDS.eligibleErrand}',
      '${IDS.ineligibleErrand}',
      '${IDS.failureErrand}'
    );

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
        'auto-release-client@example.com',
        now(),
        now(),
        '{}',
        '{}'
      ),
      (
        '${IDS.runner}',
        'authenticated',
        'authenticated',
        'auto-release-runner@example.com',
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
        'auto-release-client@example.com',
        'Auto Release Client',
        'client',
        true
      ),
      (
        '${IDS.runner}',
        'auto-release-runner@example.com',
        'Auto Release Runner',
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
        'auto-release-client@example.com',
        'client',
        true
      ),
      (
        '${IDS.runner}',
        'auto-release-runner@example.com',
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
      'Auto Release Runner',
      'auto-release-runner@example.com',
      true
    );
  `);
}

async function createWallets() {
  await psql(`
    INSERT INTO public.wallets (
      user_id,
      balance,
      pending_balance,
      available_balance,
      escrow_balance
    )
    VALUES
      ('${IDS.client}', 0, 0, 0, ${ESCROW_AMOUNT}),
      ('${IDS.runner}', 0, 0, 0, 0);
  `);
}

async function createErrands() {
  await psql(`
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
    VALUES
      (
        '${IDS.eligibleErrand}',
        'Eligible Auto Release Errand',
        'Disposable eligible auto-release integration-test errand',
        ${RUNNER_PAYOUT},
        ${ESCROW_AMOUNT},
        'completed',
        'awaiting_confirmation',
        '${IDS.client}',
        '${IDS.runner}',
        now(),
        now() - interval '25 hours'
      ),
      (
        '${IDS.ineligibleErrand}',
        'Ineligible Auto Release Errand',
        'Disposable ineligible auto-release integration-test errand',
        ${RUNNER_PAYOUT},
        ${ESCROW_AMOUNT},
        'completed',
        'awaiting_confirmation',
        '${IDS.client}',
        '${IDS.runner}',
        now(),
        now() - interval '23 hours'
      ),
      (
        '${IDS.failureErrand}',
        'Failure Auto Release Errand',
        'Disposable failure auto-release integration-test errand',
        ${RUNNER_PAYOUT},
        ${ESCROW_AMOUNT},
        'completed',
        'awaiting_confirmation',
        '${IDS.client}',
        '${IDS.runner}',
        now(),
        now() - interval '23 hours'
      );
  `);
}

async function getErrandState(id) {
  return psql(`
    SELECT status, escrow_status
    FROM public.errands
    WHERE id = '${id}';
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

async function getReleaseTransactionCount(id) {
  return psql(`
    SELECT count(*)
    FROM public.transactions
    WHERE errand_id = '${id}'
      AND type = 'release';
  `);
}

test('auto-release releases eligible escrow and does not double-pay', async () => {
  await cleanup();
  await createUsers();
  await createWallets();
  await createErrands();

  await runEscrowAutoRelease();

  assert.equal(
    await getErrandState(IDS.eligibleErrand),
    'confirmed|released'
  );

  assert.equal(
    await getRunnerWallet(),
    '4000|4000|0',
    'eligible escrow must pay the runner exactly once'
  );

  assert.equal(
    await getClientWallet(),
    '0|0|0',
    'eligible escrow must be fully released'
  );

  assert.equal(
    await getReleaseTransactionCount(IDS.eligibleErrand),
    '1',
    'eligible auto-release must create exactly one release transaction'
  );

  await runEscrowAutoRelease();

  assert.equal(
    await getRunnerWallet(),
    '4000|4000|0',
    're-running auto-release must not double-pay the runner'
  );

  assert.equal(
    await getReleaseTransactionCount(IDS.eligibleErrand),
    '1',
    're-running auto-release must not create another release transaction'
  );
});

test('auto-release leaves an ineligible escrow untouched', async () => {
  await cleanup();
  await createUsers();
  await createWallets();
  await createErrands();

  await psql(`
    UPDATE public.errands
    SET completed_at = now()
    WHERE id IN (
      '${IDS.eligibleErrand}',
      '${IDS.failureErrand}',
      '${IDS.ineligibleErrand}'
    );
  `);

  await runEscrowAutoRelease();

  assert.equal(
    await getErrandState(IDS.ineligibleErrand),
    'completed|awaiting_confirmation'
  );

  assert.equal(
    await getReleaseTransactionCount(IDS.ineligibleErrand),
    '0',
    'ineligible escrow must not create a release transaction'
  );
});

test('auto-release safely handles a release failure and leaves escrow retryable', async () => {
  await cleanup();
  await createUsers();
  await createWallets();
  await createErrands();

  await psql(`
    UPDATE public.errands
    SET completed_at = now()
    WHERE id = '${IDS.eligibleErrand}';

    UPDATE public.errands
    SET assigned_runner_id = NULL
    WHERE id = '${IDS.failureErrand}';
  `);

  await runEscrowAutoRelease();

  assert.equal(
    await getErrandState(IDS.failureErrand),
    'completed|awaiting_confirmation'
  );

  assert.equal(
    await getReleaseTransactionCount(IDS.failureErrand),
    '0',
    'failed auto-release must not create a release transaction'
  );

  assert.equal(
    await getClientWallet(),
    '0|0|5000',
    'failed auto-release must not debit client escrow'
  );

  assert.equal(
    await getRunnerWallet(),
    '0|0|0',
    'failed auto-release must not credit the runner'
  );
});

after(async () => {
  await cleanup();
});
