import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const DB_URL =
  process.env.ERS_TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const IDS = {
  client: '00000000-0000-0000-0000-000000000211',

  runner: '00000000-0000-0000-0000-000000000111',
  runnerA: '00000000-0000-0000-0000-000000000112',
  runnerB: '00000000-0000-0000-0000-000000000113',
  unverifiedRunner: '00000000-0000-0000-0000-000000000114',
  unavailableRunner: '00000000-0000-0000-0000-000000000115',

  errand: '00000000-0000-0000-0000-000000000311',
  raceErrand: '00000000-0000-0000-0000-000000000312',
  activeErrand: '00000000-0000-0000-0000-000000000313',
  unavailableErrand: '00000000-0000-0000-0000-000000000314',
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

async function createRunner({
  id,
  email,
  name,
  verified = true,
  available = true,
}) {
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
      '${name}',
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
      ${verified}
    );

    INSERT INTO public.runners (
      id,
      name,
      email,
      is_available
    )
    VALUES (
      '${id}',
      '${name}',
      '${email}',
      ${available}
    );
  `);
}

async function createClient() {
  await createAuthUser(
    IDS.client,
    'sprint6-test-client@example.com'
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
      'sprint6-test-client@example.com',
      'Sprint 6 Test Client',
      'client',
      true
    );
  `);
}

async function createErrand(
  id,
  status = 'created',
  assignedRunnerId = null
) {
  const assignedValue = assignedRunnerId
    ? `'${assignedRunnerId}'::uuid`
    : 'NULL';

  await psql(`
    INSERT INTO public.errands (
      id,
      title,
      description,
      payout_amount,
      status,
      client_id,
      assigned_runner_id,
      assigned_at
    )
    VALUES (
      '${id}',
      'Automated Sprint 6 Test Errand',
      'Disposable integration-test errand',
      5000,
      '${status}',
      '${IDS.client}',
      ${assignedValue},
      ${assignedRunnerId ? 'now()' : 'NULL'}
    );
  `);
}

async function acceptErrand(runnerId, errandId) {
  return psql(`
    SELECT id, status, assigned_runner_id, assigned_at
    FROM public.accept_errand_atomic(
      '${runnerId}'::uuid,
      '${errandId}'::uuid
    );
  `);
}

async function cleanup() {
  await psql(`
    DELETE FROM public.errands
    WHERE id IN (
      '${IDS.errand}',
      '${IDS.raceErrand}',
      '${IDS.activeErrand}',
      '${IDS.unavailableErrand}'
    );

    DELETE FROM public.runners
    WHERE id IN (
      '${IDS.runner}',
      '${IDS.runnerA}',
      '${IDS.runnerB}',
      '${IDS.unverifiedRunner}',
      '${IDS.unavailableRunner}'
    );

    DELETE FROM public.profiles
    WHERE id IN (
      '${IDS.runner}',
      '${IDS.runnerA}',
      '${IDS.runnerB}',
      '${IDS.unverifiedRunner}',
      '${IDS.unavailableRunner}'
    );

    DELETE FROM public.users
    WHERE id IN (
      '${IDS.client}',
      '${IDS.runner}',
      '${IDS.runnerA}',
      '${IDS.runnerB}',
      '${IDS.unverifiedRunner}',
      '${IDS.unavailableRunner}'
    );

    DELETE FROM auth.users
    WHERE id IN (
      '${IDS.client}',
      '${IDS.runner}',
      '${IDS.runnerA}',
      '${IDS.runnerB}',
      '${IDS.unverifiedRunner}',
      '${IDS.unavailableRunner}'
    );
  `);
}

test('verified available runner accepts a created errand', async () => {
  await cleanup();

  await createClient();

  await createRunner({
    id: IDS.runner,
    email: 'sprint6-test-runner@example.com',
    name: 'Sprint 6 Test Runner',
  });

  await createErrand(IDS.errand);

  const result = await acceptErrand(
    IDS.runner,
    IDS.errand
  );

  const [id, status, assignedRunnerId, assignedAt] =
    result.split('|');

  assert.equal(id, IDS.errand);
  assert.equal(status, 'accepted');
  assert.equal(assignedRunnerId, IDS.runner);
  assert.ok(assignedAt);
});

test('concurrent acceptance assigns the errand to exactly one runner', async () => {
  await cleanup();

  await createClient();

  await createRunner({
    id: IDS.runnerA,
    email: 'sprint6-test-runner-a@example.com',
    name: 'Sprint 6 Test Runner A',
  });

  await createRunner({
    id: IDS.runnerB,
    email: 'sprint6-test-runner-b@example.com',
    name: 'Sprint 6 Test Runner B',
  });

  await createErrand(IDS.raceErrand);

  const attempts = await Promise.allSettled([
    acceptErrand(IDS.runnerA, IDS.raceErrand),
    acceptErrand(IDS.runnerB, IDS.raceErrand),
  ]);

  const successes = attempts.filter(
    (attempt) => attempt.status === 'fulfilled'
  );

  const failures = attempts.filter(
    (attempt) => attempt.status === 'rejected'
  );

  assert.equal(successes.length, 1);
  assert.equal(failures.length, 1);

  const finalState = await psql(`
    SELECT status, assigned_runner_id, assigned_at
    FROM public.errands
    WHERE id = '${IDS.raceErrand}';
  `);

  const [status, assignedRunnerId, assignedAt] =
    finalState.split('|');

  assert.equal(status, 'accepted');
  assert.ok(
    [IDS.runnerA, IDS.runnerB].includes(assignedRunnerId)
  );
  assert.ok(assignedAt);
});

test('unverified runner cannot accept an errand', async () => {
  await cleanup();

  await createClient();

  await createRunner({
    id: IDS.unverifiedRunner,
    email: 'sprint6-test-unverified@example.com',
    name: 'Sprint 6 Unverified Runner',
    verified: false,
  });

  await createErrand(IDS.errand);

  const output = await psqlExpectFailure(`
    SELECT *
    FROM public.accept_errand_atomic(
      '${IDS.unverifiedRunner}'::uuid,
      '${IDS.errand}'::uuid
    );
  `);

  assert.match(output, /Runner is not verified/);
});

test('unavailable runner cannot accept an errand', async () => {
  await cleanup();

  await createClient();

  await createRunner({
    id: IDS.unavailableRunner,
    email: 'sprint6-test-unavailable@example.com',
    name: 'Sprint 6 Unavailable Runner',
    available: false,
  });

  await createErrand(IDS.errand);

  const output = await psqlExpectFailure(`
    SELECT *
    FROM public.accept_errand_atomic(
      '${IDS.unavailableRunner}'::uuid,
      '${IDS.errand}'::uuid
    );
  `);

  assert.match(output, /Runner is unavailable/);
});

test('runner with an active errand cannot accept another errand', async () => {
  await cleanup();

  await createClient();

  await createRunner({
    id: IDS.runner,
    email: 'sprint6-test-runner@example.com',
    name: 'Sprint 6 Test Runner',
  });

  await createErrand(
    IDS.activeErrand,
    'accepted',
    IDS.runner
  );

  await createErrand(IDS.errand);

  const output = await psqlExpectFailure(`
    SELECT *
    FROM public.accept_errand_atomic(
      '${IDS.runner}'::uuid,
      '${IDS.errand}'::uuid
    );
  `);

  assert.match(
    output,
    /Runner already has an active errand/
  );
});

test('already unavailable errand cannot be accepted', async () => {
  await cleanup();

  await createClient();

  await createRunner({
    id: IDS.runnerA,
    email: 'sprint6-test-runner-a@example.com',
    name: 'Sprint 6 Test Runner A',
  });

  await createRunner({
    id: IDS.runnerB,
    email: 'sprint6-test-runner-b@example.com',
    name: 'Sprint 6 Test Runner B',
  });

  await createErrand(
    IDS.unavailableErrand,
    'accepted',
    IDS.runnerA
  );

  const output = await psqlExpectFailure(`
    SELECT *
    FROM public.accept_errand_atomic(
      '${IDS.runnerB}'::uuid,
      '${IDS.unavailableErrand}'::uuid
    );
  `);

  assert.match(
    output,
    /Errand is no longer available/
  );
});

test('nonexistent errand is rejected', async () => {
  await cleanup();

  await createClient();

  await createRunner({
    id: IDS.runnerB,
    email: 'sprint6-test-runner-b@example.com',
    name: 'Sprint 6 Test Runner B',
  });

  const output = await psqlExpectFailure(`
    SELECT *
    FROM public.accept_errand_atomic(
      '${IDS.runnerB}'::uuid,
      '00000000-0000-0000-0000-000000009999'::uuid
    );
  `);

  assert.match(output, /Errand not found/);
});

after(async () => {
  await cleanup();
});
