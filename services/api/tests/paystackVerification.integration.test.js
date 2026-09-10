import test, { after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const DB_URL =
  process.env.ERS_TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const IDS = {
  user: '00000000-0000-0000-0000-000000000421',
};

const REFERENCE = 'ERS-PAYSTACK-VERIFY-001';
const AMOUNT = 5000;
const PAYSTACK_SECRET = 'paystack-test-secret';

process.env.SUPABASE_URL = 'http://127.0.0.1:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
process.env.PAYSTACK_SECRET_KEY = PAYSTACK_SECRET;

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
      'paystack-verify@example.com',
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
      'paystack-verify@example.com',
      'Paystack Verify Test User',
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
      'paystack-verify@example.com',
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

async function getWallet() {
  return psql(`
    SELECT
      balance,
      available_balance
    FROM public.wallets
    WHERE user_id = '${IDS.user}';
  `);
}

async function getTransaction() {
  return psql(`
    SELECT
      amount,
      status,
      reference,
      payment_provider
    FROM public.transactions
    WHERE reference = '${REFERENCE}';
  `);
}

async function startServer(paystackRouter) {
  const { default: express } = await import('express');
  const { default: http } = await import('node:http');

  const app = express();
  app.use(express.json());
  app.use('/paystack', paystackRouter);

  const server = http.createServer(app);

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();

  return {
    server,
    url: `http://127.0.0.1:${address.port}`,
  };
}

async function sendVerification(url) {
  const response = await fetch(
    `${url}/paystack/verify/${encodeURIComponent(REFERENCE)}`,
    {
      method: 'GET',
      headers: {
        Authorization: 'Bearer test-access-token',
      },
    }
  );

  return {
    status: response.status,
    body: await response.json(),
  };
}

test('successful Paystack verification returns completed transaction and credits wallet exactly once', async () => {
  mock.module('../modules/protect/authenticate.js', {
    namedExports: {
      authenticate(req, res, next) {
        req.user = {
          id: IDS.user,
          email: 'paystack-verify@example.com',
        };
        next();
      },
    },
  });

  mock.module('axios', {
    defaultExport: {
      get: async () => ({
        data: {
          status: true,
          message: 'Verification successful',
          data: {
            reference: REFERENCE,
            amount: AMOUNT * 100,
            status: 'success',
          },
        },
      }),
    },
  });

  const { default: paystackRouter } =
    await import('../routes/paystack.js');

  await cleanup();
  await createUser();
  await createPendingPayment();

  const { server, url } = await startServer(paystackRouter);

  try {
    const first = await sendVerification(url);

    assert.equal(first.status, 200);
    assert.equal(first.body.success, true);

    assert.equal(
      await getWallet(),
      '5000|5000',
      'successful verification must credit the wallet'
    );

    assert.equal(
      await getTransaction(),
      `${AMOUNT}|completed|${REFERENCE}|paystack`
    );

    const second = await sendVerification(url);

    assert.equal(second.status, 200);
    assert.equal(second.body.success, true);
    assert.equal(second.body.data.status, 'completed');

    assert.equal(
      await getWallet(),
      '5000|5000',
      'repeated verification must not double-credit the wallet'
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await cleanup();
    mock.restoreAll();
  }
});

test('Paystack verification rejects provider reference mismatch without mutating wallet', async () => {
  mock.module('../modules/protect/authenticate.js', {
    namedExports: {
      authenticate(req, res, next) {
        req.user = {
          id: IDS.user,
          email: 'paystack-verify@example.com',
        };
        next();
      },
    },
  });

  mock.module('axios', {
    defaultExport: {
      get: async () => ({
        data: {
          status: true,
          message: 'Verification successful',
          data: {
            reference: 'ERS-PAYSTACK-DIFFERENT-999',
            amount: AMOUNT * 100,
            status: 'success',
          },
        },
      }),
    },
  });

  const { default: paystackRouter } =
    await import(`../routes/paystack.js?reference=${Date.now()}`);

  await cleanup();
  await createUser();
  await createPendingPayment();

  const { server, url } = await startServer(paystackRouter);

  try {
    const response = await sendVerification(url);

    assert.equal(response.status, 400);
    assert.equal(response.body.success, false);
    assert.equal(response.body.message, 'Payment reference mismatch');

    assert.equal(
      await getWallet(),
      '0|0',
      'reference mismatch must not credit the wallet'
    );

    assert.equal(
      await getTransaction(),
      `${AMOUNT}|pending|${REFERENCE}|paystack`,
      'reference mismatch must leave the pending transaction unchanged'
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await cleanup();
    mock.restoreAll();
  }
});

test('failed Paystack verification does not mutate wallet or complete transaction', async () => {
  mock.module('../modules/protect/authenticate.js', {
    namedExports: {
      authenticate(req, res, next) {
        req.user = {
          id: IDS.user,
          email: 'paystack-verify@example.com',
        };
        next();
      },
    },
  });

  mock.module('axios', {
    defaultExport: {
      get: async () => ({
        data: {
          status: true,
          message: 'Verification successful',
          data: {
            reference: REFERENCE,
            amount: AMOUNT * 100,
            status: 'failed',
          },
        },
      }),
    },
  });

  const { default: paystackRouter } =
    await import(`../routes/paystack.js?failed=${Date.now()}`);

  await cleanup();
  await createUser();
  await createPendingPayment();

  const { server, url } = await startServer(paystackRouter);

  try {
    const response = await sendVerification(url);

    assert.equal(response.status, 400);
    assert.equal(response.body.success, false);

    assert.equal(
      await getWallet(),
      '0|0',
      'failed verification must not credit the wallet'
    );

    assert.equal(
      await getTransaction(),
      `${AMOUNT}|pending|${REFERENCE}|paystack`,
      'failed verification must leave the pending transaction unchanged'
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await cleanup();
    mock.restoreAll();
  }
});

test('Paystack verification rejects provider amount mismatch without mutating wallet', async () => {
  mock.module('../modules/protect/authenticate.js', {
    namedExports: {
      authenticate(req, res, next) {
        req.user = {
          id: IDS.user,
          email: 'paystack-verify@example.com',
        };
        next();
      },
    },
  });

  mock.module('axios', {
    defaultExport: {
      get: async () => ({
        data: {
          status: true,
          message: 'Verification successful',
          data: {
            reference: REFERENCE,
            amount: (AMOUNT + 1) * 100,
            status: 'success',
          },
        },
      }),
    },
  });

  const { default: paystackRouter } =
    await import(`../routes/paystack.js?amount=${Date.now()}`);

  await cleanup();
  await createUser();
  await createPendingPayment();

  const { server, url } = await startServer(paystackRouter);

  try {
    const response = await sendVerification(url);

    assert.equal(response.status, 400);
    assert.equal(response.body.success, false);

    assert.equal(
      await getWallet(),
      '0|0',
      'amount mismatch must not credit the wallet'
    );

    assert.equal(
      await getTransaction(),
      `${AMOUNT}|pending|${REFERENCE}|paystack`
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await cleanup();
    mock.restoreAll();
  }
});

after(async () => {
  await cleanup();
});
