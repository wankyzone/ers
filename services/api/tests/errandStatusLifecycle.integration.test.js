import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const DB_URL =
  process.env.ERS_TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const IDS = {
  client: '00000000-0000-0000-0000-000000000511',
  runner: '00000000-0000-0000-0000-000000000512',
  otherRunner: '00000000-0000-0000-0000-000000000513',

  validErrand: '00000000-0000-0000-0000-000000000611',
  createdErrand: '00000000-0000-0000-0000-000000000612',
  completedErrand: '00000000-0000-0000-0000-000000000613',
  confirmedErrand: '00000000-0000-0000-0000-000000000614',
  escrowMismatchErrand: '00000000-0000-0000-0000-000000000615',
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

    assert.fail('Expected PostgreSQL command to fail');
  } catch (error) {
    return `${error.stderr ?? ''}${error.stdout ?? ''}`.trim();
  }
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
    'sprint6-lifecycle-client@example.com'
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
      'sprint6-lifecycle-client@example.com',
      'Sprint 6 Lifecycle Client',
      'client',
      true
    );
  `);
}

async function createRunner(id, email) {
  await createAuthUser(id, email);

  await psql(`
    INSERT INTO public.users (
      id,
      email,
      full_name,
      role,
      kyc_verified
    )
    VALUES (
      '${id}',
      '${email}',
      'Sprint 6 Lifecycle Runner',
      'runner',
      true
    );

    INSERT INTO public.profiles (
      id,
      email,
      role,
      verified
    )
    VALUES (
      '${id}',
      '${email}',
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
      '${id}',
      'Sprint 6 Lifecycle Runner',
      '${email}',
      true
    );
  `);
}

async function createErrand(
  id,
  status,
  escrowStatus,
  assignedRunnerId = IDS.runner
) {
  await psql(`
    INSERT INTO public.errands (
      id,
      title,
      description,
      payout_amount,
      status,
      escrow_status,
      client_id,
      assigned_runner_id,
      assigned_at
    )
    VALUES (
      '${id}',
      'Sprint 6 Lifecycle Test Errand',
      'Disposable lifecycle integration-test errand',
      5000,
      '${status}',
      '${escrowStatus}',
      '${IDS.client}',
      ${assignedRunnerId ? `'${assignedRunnerId}'::uuid` : 'NULL'},
      ${assignedRunnerId ? 'now()' : 'NULL'}
    );
  `);
}

async function completeErrand(runnerId, errandId) {
  return psql(`
    SELECT id, status, escrow_status, completed_at
    FROM public.complete_errand_atomic(
      '${runnerId}'::uuid,
      '${errandId}'::uuid
    );
  `);
}

async function cleanup() {
  await psql(`
    DELETE FROM public.errands
    WHERE id IN (
      '${IDS.validErrand}',
      '${IDS.createdErrand}',
      '${IDS.completedErrand}',
      '${IDS.confirmedErrand}',
      '${IDS.escrowMismatchErrand}'
    );

    DELETE FROM public.runners
    WHERE id IN (
      '${IDS.runner}',
      '${IDS.otherRunner}'
    );

    DELETE FROM public.profiles
    WHERE id IN (
      '${IDS.runner}',
      '${IDS.otherRunner}'
    );

    DELETE FROM public.users
    WHERE id IN (
      '${IDS.client}',
      '${IDS.runner}',
      '${IDS.otherRunner}'
    );

    DELETE FROM auth.users
    WHERE id IN (
      '${IDS.client}',
      '${IDS.runner}',
      '${IDS.otherRunner}'
    );
  `);
}

test('accepted errand completes atomically', async () => {
  await cleanup();

  await createClient();
  await createRunner(
    IDS.runner,
    'sprint6-lifecycle-runner@example.com'
  );

  await createErrand(
    IDS.validErrand,
    'accepted',
    'locked'
  );

  const result = await completeErrand(
    IDS.runner,
    IDS.validErrand
  );

  const [id, status, escrowStatus, completedAt] =
    result.split('|');

  assert.equal(id, IDS.validErrand);
  assert.equal(status, 'completed');
  assert.equal(escrowStatus, 'awaiting_confirmation');
  assert.ok(completedAt);
});

test('wrong runner cannot complete an errand', async () => {
  await cleanup();

  await createClient();
  await createRunner(
    IDS.runner,
    'sprint6-lifecycle-runner@example.com'
  );
  await createRunner(
    IDS.otherRunner,
    'sprint6-lifecycle-other@example.com'
  );

  await createErrand(
    IDS.validErrand,
    'accepted',
    'locked'
  );

  const output = await psqlExpectFailure(`
    SELECT *
    FROM public.complete_errand_atomic(
      '${IDS.otherRunner}'::uuid,
      '${IDS.validErrand}'::uuid
    );
  `);

  assert.match(
    output,
    /Runner is not assigned to this errand/
  );
});

test('created errand cannot skip directly to completed', async () => {
  await cleanup();

  await createClient();
  await createRunner(
    IDS.runner,
    'sprint6-lifecycle-runner@example.com'
  );

  await createErrand(
    IDS.createdErrand,
    'created',
    'locked',
    IDS.runner
  );

  const output = await psqlExpectFailure(`
    SELECT *
    FROM public.complete_errand_atomic(
      '${IDS.runner}'::uuid,
      '${IDS.createdErrand}'::uuid
    );
  `);

  assert.match(
    output,
    /Errand cannot be completed from its current state/
  );
});

test('completed errand cannot be completed again', async () => {
  await cleanup();

  await createClient();
  await createRunner(
    IDS.runner,
    'sprint6-lifecycle-runner@example.com'
  );

  await createErrand(
    IDS.completedErrand,
    'completed',
    'awaiting_confirmation'
  );

  const output = await psqlExpectFailure(`
    SELECT *
    FROM public.complete_errand_atomic(
      '${IDS.runner}'::uuid,
      '${IDS.completedErrand}'::uuid
    );
  `);

  assert.match(
    output,
    /current state/
  );
});

test('confirmed errand is terminal and cannot be completed', async () => {
  await cleanup();

  await createClient();
  await createRunner(
    IDS.runner,
    'sprint6-lifecycle-runner@example.com'
  );

  await createErrand(
    IDS.confirmedErrand,
    'confirmed',
    'released'
  );

  const output = await psqlExpectFailure(`
    SELECT *
    FROM public.complete_errand_atomic(
      '${IDS.runner}'::uuid,
      '${IDS.confirmedErrand}'::uuid
    );
  `);

  assert.match(
    output,
    /current state/
  );
});

test('accepted errand with incorrect escrow state cannot complete', async () => {
  await cleanup();

  await createClient();
  await createRunner(
    IDS.runner,
    'sprint6-lifecycle-runner@example.com'
  );

  await createErrand(
    IDS.escrowMismatchErrand,
    'accepted',
    'awaiting_confirmation'
  );

  const output = await psqlExpectFailure(`
    SELECT *
    FROM public.complete_errand_atomic(
      '${IDS.runner}'::uuid,
      '${IDS.escrowMismatchErrand}'::uuid
    );
  `);

  assert.match(
    output,
    /escrow is not in the expected state/
  );
});

after(async () => {
  await cleanup();
});
