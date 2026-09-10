import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const DB_URL =
  process.env.ERS_TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const IDS = {
  user: '00000000-0000-0000-0000-000000000411',
};

const REFERENCE = 'ERS-PAYSTACK-TEST-001';
const AMOUNT = 5000;

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
    WHERE reference = '${REFERENCE}'
       OR user_id = '${IDS.user}';

    DELETE FROM public.wallets
    WHERE user_id = '${IDS.user}';

    DELETE FROM public.profiles
    WHERE id = '${IDS.user}';

    DELETE FROM public.users
    WHERE id = '${IDS.user}';

    DELETE FROM auth.users
    WHERE id = '${IDS.user}';
  `);
}

async function createUser() {
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
      '${IDS.user}',
      'authenticated',
      'authenticated',
      'paystack-test@example.com',
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
    VALUES (
      '${IDS.user}',
      'paystack-test@example.com',
      'Paystack Test User',
      'client',
      true
    );

    INSERT INTO public.profiles (
      id,
      email,
      role,
      verified
    )
    VALUES (
      '${IDS.user}',
      'paystack-test@example.com',
      'client',
      true
    );
  `);
}

async function createPendingPayment() {
  await psql(`
    INSERT INTO public.wallets (
      user_id,
      balance,
      pending_balance,
      available_balance,
      escrow_balance
    )
    VALUES (
      '${IDS.user}',
      0,
      0,
      0,
      0
    );

    INSERT INTO public.transactions (
      user_id,
      amount,
      status,
      type,
      idempotency_key,
      reference,
      payment_provider
    )
    VALUES (
      '${IDS.user}',
      ${AMOUNT},
      'pending',
      'deposit',
      'paystack:${REFERENCE}',
      '${REFERENCE}',
      'paystack'
    );
  `);
}

async function creditPayment() {
  return psql(`
    SELECT
      id,
      user_id,
      amount,
      status,
      type,
      reference,
      payment_provider
    FROM public.credit_paystack_wallet_atomic(
      '${IDS.user}',
      '${REFERENCE}',
      ${AMOUNT}
    );
  `);
}

async function getWallet() {
  return psql(`
    SELECT
      balance,
      available_balance
    FROM public.wallets
    WHERE user_id = '${IDS.user}';
  `);
}

async function getReferenceCount() {
  return psql(`
    SELECT count(*)
    FROM public.transactions
    WHERE reference = '${REFERENCE}';
  `);
}

test('successful Paystack funding credits wallet exactly once', async () => {
  await cleanup();
  await createUser();
  await createPendingPayment();

  const firstCredit = await creditPayment();

  assert.match(firstCredit, /completed/);
  assert.match(firstCredit, new RegExp(REFERENCE));
  assert.match(firstCredit, /paystack/);

  assert.equal(await getWallet(), '5000|5000');

  const secondCredit = await creditPayment();

  assert.match(secondCredit, /completed/);
  assert.match(secondCredit, new RegExp(REFERENCE));

  assert.equal(
    await getWallet(),
    '5000|5000',
    'duplicate verification must not double-credit the wallet'
  );

  assert.equal(
    await getReferenceCount(),
    '1',
    'one provider reference must map to exactly one ledger transaction'
  );

  await cleanup();
});


test('Paystack funding rejects reference owned by another user', async () => {
  const attackerId = '00000000-0000-0000-0000-000000000412';

  await cleanup();

  await psql(`
    INSERT INTO auth.users (
      id, aud, role, email, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data
    )
    VALUES (
      '${attackerId}',
      'authenticated',
      'authenticated',
      'paystack-attacker@example.com',
      now(),
      now(),
      '{}',
      '{}'
    );

    INSERT INTO public.users (
      id, email, full_name, role, kyc_verified
    )
    VALUES (
      '${attackerId}',
      'paystack-attacker@example.com',
      'Paystack Attacker',
      'client',
      true
    );

    INSERT INTO public.wallets (
      user_id,
      balance,
      pending_balance,
      available_balance,
      escrow_balance
    )
    VALUES (
      '${attackerId}',
      0,
      0,
      0,
      0
    );
  `);

  await createUser();
  await createPendingPayment();

  const output = await psql(`
    SELECT balance, available_balance
    FROM public.wallets
    WHERE user_id = '${IDS.user}';
  `);

  assert.equal(output, '0|0');

  await assert.rejects(
    async () => {
      await execFileAsync(
        'psql',
        [
          DB_URL,
          '--no-psqlrc',
          '--tuples-only',
          '--no-align',
          '-c',
          `
            SELECT *
            FROM public.credit_paystack_wallet_atomic(
              '${attackerId}',
              '${REFERENCE}',
              ${AMOUNT}
            );
          `,
        ],
        { maxBuffer: 10 * 1024 * 1024 }
      );
    },
    /Payment reference belongs to another user/
  );

  assert.equal(
    await getWallet(),
    '0|0',
    'invalid ownership must not mutate the wallet'
  );

  await psql(`
    DELETE FROM public.wallets
    WHERE user_id = '${attackerId}';

    DELETE FROM public.users
    WHERE id = '${attackerId}';

    DELETE FROM auth.users
    WHERE id = '${attackerId}';
  `);

  await cleanup();
});

test('Paystack funding rejects provider amount mismatch without crediting wallet', async () => {
  await cleanup();
  await createUser();
  await createPendingPayment();

  await assert.rejects(
    async () => {
      await execFileAsync(
        'psql',
        [
          DB_URL,
          '--no-psqlrc',
          '--tuples-only',
          '--no-align',
          '-c',
          `
            SELECT *
            FROM public.credit_paystack_wallet_atomic(
              '${IDS.user}',
              '${REFERENCE}',
              5001
            );
          `,
        ],
        { maxBuffer: 10 * 1024 * 1024 }
      );
    },
    /Payment reference amount mismatch/
  );

  assert.equal(
    await getWallet(),
    '0|0',
    'amount mismatch must not mutate the wallet'
  );

  const transaction = await psql(`
    SELECT amount, status
    FROM public.transactions
    WHERE reference = '${REFERENCE}';
  `);

  assert.equal(transaction, '5000|pending');

  await cleanup();
});


test('failed Paystack payment leaves wallet and ledger unchanged', async () => {
  await cleanup();
  await createUser();
  await createPendingPayment();

  await psql(`
    UPDATE public.transactions
    SET status = 'failed'
    WHERE reference = '${REFERENCE}';
  `);

  assert.equal(
    await getWallet(),
    '0|0',
    'failed payment must not credit the wallet'
  );

  const transaction = await psql(`
    SELECT amount, status
    FROM public.transactions
    WHERE reference = '${REFERENCE}';
  `);

  assert.equal(transaction, '5000|failed');

  await cleanup();
});


test('signed Paystack charge.success webhook credits wallet exactly once', async () => {
  const SECRET = 'paystack-test-secret';

  process.env.SUPABASE_URL = 'http://127.0.0.1:54321';
  process.env.SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  process.env.PAYSTACK_SECRET_KEY = SECRET;

  const { default: express } = await import('express');
  const crypto = await import('node:crypto');
  const { default: paystackRouter } =
    await import('../routes/paystack.js');
  const { default: http } = await import('node:http');

  await cleanup();
  await createUser();
  await createPendingPayment();

  const app = express();

  app.use(
    '/paystack/webhook',
    express.raw({ type: 'application/json' })
  );

  app.use(express.json());
  app.use('/paystack', paystackRouter);

  const server = http.createServer(app);

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  const port = address.port;

  const payload = JSON.stringify({
    event: 'charge.success',
    data: {
      reference: REFERENCE,
      amount: AMOUNT * 100,
      status: 'success',
    },
  });

  const signature = crypto
    .createHmac('sha512', SECRET)
    .update(payload)
    .digest('hex');

  async function sendWebhook() {
    const response = await fetch(
      `http://127.0.0.1:${port}/paystack/webhook`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-paystack-signature': signature,
        },
        body: payload,
      }
    );

    return {
      status: response.status,
      body: await response.json(),
    };
  }

  try {
    const first = await sendWebhook();

    assert.equal(first.status, 200);
    assert.equal(first.body.success, true);
    assert.equal(await getWallet(), '5000|5000');

    const second = await sendWebhook();

    assert.equal(second.status, 200);
    assert.equal(second.body.success, true);
    assert.equal(await getWallet(), '5000|5000');

    assert.equal(await getReferenceCount(), '1');

    const transaction = await psql(`
      SELECT amount, status, payment_provider
      FROM public.transactions
      WHERE reference = '${REFERENCE}';
    `);

    assert.equal(transaction, '5000|completed|paystack');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await cleanup();
  }
});

after(async () => {
  await cleanup();
});
