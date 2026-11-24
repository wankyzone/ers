import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

process.env.SUPABASE_URL = 'http://127.0.0.1:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'unit-test-service-role-key';
process.env.SUPABASE_PUBLIC_KEY = 'unit-test-public-key';
process.env.PAYSTACK_SECRET_KEY = 'unit-test-paystack-secret';

const RUNNER_ID = '00000000-0000-0000-0000-000000000101';
const CLIENT_ID = '00000000-0000-0000-0000-000000000102';
const OTHER_RUNNER_ID = '00000000-0000-0000-0000-000000000103';
const UNVERIFIED_CLIENT_ID = '00000000-0000-0000-0000-000000000104';
const UNSUPPORTED_ROLE_ID = '00000000-0000-0000-0000-000000000105';
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const REFERENCE = 'ERS-TRANSFER-UNIT-TEST-001';

const [{ createApiServer }, { default: supabase }, axiosModule] =
  await Promise.all([
    import('../app.js'),
    import('../supabase.js'),
    import('axios'),
  ]);
const axios = axiosModule.default;

let api;
let server;
let baseUrl;
let state;

function resetState() {
  state = {
    profiles: {
      [RUNNER_ID]: {
        id: RUNNER_ID,
        email: 'runner@example.test',
        role: 'runner',
        verified: true,
        full_name: 'Test Runner',
        kyc_verified: true,
        pin_set: false,
        risk_score: 0,
      },
      [CLIENT_ID]: {
        id: CLIENT_ID,
        email: 'client@example.test',
        role: 'client',
        verified: true,
        full_name: 'Test Client',
        kyc_verified: false,
        pin_set: false,
        risk_score: 0,
      },
      [UNVERIFIED_CLIENT_ID]: {
        id: UNVERIFIED_CLIENT_ID,
        email: 'unverified@example.test',
        role: 'client',
        verified: true,
        full_name: 'Unverified Test Client',
        kyc_verified: false,
        pin_set: false,
        risk_score: 0,
      },
      [UNSUPPORTED_ROLE_ID]: {
        id: UNSUPPORTED_ROLE_ID,
        email: 'unsupported@example.test',
        role: 'customer_support',
        verified: true,
        full_name: 'Unsupported Role',
        kyc_verified: false,
        pin_set: false,
        risk_score: 0,
      },
    },
    users: {
      [RUNNER_ID]: { withdrawal_pin: null, pin_set: false },
      [CLIENT_ID]: { withdrawal_pin: null, pin_set: false },
    },
    walletRows: {
      [RUNNER_ID]: {
        user_id: RUNNER_ID,
        balance: 100,
        available_balance: 100,
        escrow_balance: 0,
        private_note: 'not-for-api',
      },
    },
    errandRows: [
      {
        id: 'client-errand',
        client_id: CLIENT_ID,
        assigned_runner_id: RUNNER_ID,
        created_at: '2026-01-02T00:00:00.000Z',
      },
      {
        id: 'foreign-errand',
        client_id: UNVERIFIED_CLIENT_ID,
        assigned_runner_id: OTHER_RUNNER_ID,
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ],
    kyc: {
      id: 'kyc-runner',
      user_id: RUNNER_ID,
      status: 'pending',
      nin_document_url: null,
      proof_of_address_url: null,
      selfie_url: null,
    },
    runnerRecord: {
      id: RUNNER_ID,
      is_available: true,
    },
    transaction: {
      id: 'withdrawal-1',
      reference: REFERENCE,
      user_id: RUNNER_ID,
      amount: 50,
      type: 'withdraw',
      status: 'pending',
      payment_provider: 'paystack',
    },
    walletAvailableBalance: 100,
    walletUserFilter: null,
    pinUserFilter: null,
    kycUserFilter: null,
    walletSelectedColumns: null,
    errandClientFilter: null,
    errandRunnerFilter: null,
    uploads: [],
    rpcCalls: [],
    fromCalls: [],
    transferRequests: 0,
    paystackRequests: [],
    recipientRecords: [],
  };
}

function queryBuilder(table) {
  const filters = {};
  let action = 'select';
  let values;
  let selectedColumns;
  let errandVisibilityFilter = null;

  function execute() {
    state.fromCalls.push({ table, action, filters: { ...filters } });
    const userId = filters.user_id ?? filters.id;

    if (table === 'profiles') {
      return {
        data: state.profiles[filters.id] ?? null,
        error: state.profiles[filters.id] ? null : { code: 'PGRST116' },
      };
    }

    if (table === 'wallets') {
      state.walletUserFilter = filters.user_id;
      state.walletSelectedColumns = selectedColumns;
      const row = state.walletRows[filters.user_id] ?? null;
      if (!row) {
        return { data: null, error: { code: 'PGRST116' } };
      }

      const fields = selectedColumns?.split(',').map((field) => field.trim());
      const data = fields
        ? Object.fromEntries(fields.map((field) => [field, row[field]]))
        : row;
      return { data, error: null };
    }

    if (table === 'errands') {
      state.errandClientFilter = filters.client_id ?? null;
      state.errandRunnerFilter = errandVisibilityFilter;
      const data = state.errandClientFilter
        ? state.errandRows.filter(
            (errand) => errand.client_id === state.errandClientFilter
          )
        : state.errandRows;
      return { data, error: null };
    }

    if (table === 'users') {
      state.pinUserFilter = filters.id;
      const user = state.users[filters.id];

      if (action === 'update') {
        if (!user || user.withdrawal_pin !== null) {
          return { data: null, error: null };
        }

        state.users[filters.id] = { ...user, ...values };
        return { data: { id: filters.id }, error: null };
      }

      return {
        data: user ?? null,
        error: user ? null : { code: 'PGRST116' },
      };
    }

    if (table === 'kyc_profiles') {
      if (action === 'select') {
        state.kycUserFilter = filters.user_id;
      }

      if (action === 'update') {
        state.kyc = { ...state.kyc, ...values };
        return { data: state.kyc, error: null };
      }

      const row =
        state.kyc.user_id === filters.user_id &&
        (!filters.status || state.kyc.status === filters.status)
          ? state.kyc
          : null;
      return {
        data: row,
        error: row ? null : { code: 'PGRST116' },
      };
    }

    if (table === 'runners') {
      const row = state.runnerRecord?.id === filters.id
        ? state.runnerRecord
        : null;
      return {
        data: row,
        error: row ? null : { code: 'PGRST116' },
      };
    }

    throw new Error(`Unexpected mocked table: ${table}`);
  }

  const builder = {
    select(columns) {
      selectedColumns = columns;
      return builder;
    },
    update(updateValues) {
      action = 'update';
      values = updateValues;
      return builder;
    },
    eq(column, value) {
      filters[column] = value;
      return builder;
    },
    is(column, value) {
      filters[column] = value;
      return builder;
    },
    or(filter) {
      errandVisibilityFilter = filter;
      return builder;
    },
    order() {
      return builder;
    },
    single: execute,
    maybeSingle: execute,
    then(resolve, reject) {
      return Promise.resolve(execute()).then(resolve, reject);
    },
  };

  return builder;
}

function installSupabaseMocks() {
  mock.method(supabase.auth, 'getUser', async (token) => {
    const userByToken = {
      'runner-token': {
        id: RUNNER_ID,
        email: 'runner@example.test',
        email_confirmed_at: '2026-01-01T00:00:00.000Z',
      },
      'client-token': {
        id: CLIENT_ID,
        email: 'client@example.test',
        email_confirmed_at: '2026-01-01T00:00:00.000Z',
      },
      'unverified-client-token': {
        id: UNVERIFIED_CLIENT_ID,
        email: 'unverified@example.test',
        email_confirmed_at: null,
      },
      'unverified-runner-token': {
        id: RUNNER_ID,
        email: 'runner@example.test',
        email_confirmed_at: null,
      },
      'unsupported-role-token': {
        id: UNSUPPORTED_ROLE_ID,
        email: 'unsupported@example.test',
        email_confirmed_at: '2026-01-01T00:00:00.000Z',
      },
      'other-runner-token': {
        id: OTHER_RUNNER_ID,
        email: 'other-runner@example.test',
        email_confirmed_at: '2026-01-01T00:00:00.000Z',
      },
    };
    const user = userByToken[token];

    return user
      ? { data: { user }, error: null }
      : { data: { user: null }, error: new Error('Invalid test token') };
  });

  mock.method(supabase, 'from', (table) => queryBuilder(table));

  mock.method(supabase, 'rpc', async (name, args) => {
    state.rpcCalls.push({ name, args });

    if (name === 'accept_errand_atomic') {
      return {
        data: { id: args.p_errand_id, assigned_runner_id: args.p_runner_id },
        error: null,
      };
    }

    if (name !== 'reconcile_paystack_transfer_atomic') {
      return { data: null, error: new Error('Unexpected mocked RPC') };
    }

    const transaction = state.transaction;
    if (
      args.p_reference !== transaction.reference ||
      args.p_amount_minor !== transaction.amount * 100
    ) {
      return { data: null, error: new Error('Transfer mismatch') };
    }

    const terminalStatus =
      args.p_event === 'transfer.success' ? 'completed' : 'failed';

    if (transaction.status === terminalStatus) {
      return { data: { ...transaction }, error: null };
    }

    if (transaction.status !== 'pending') {
      return { data: null, error: new Error('Withdrawal is not pending') };
    }

    if (args.p_event === 'transfer.failed') {
      state.walletAvailableBalance += transaction.amount;
    }
    transaction.status = terminalStatus;

    return { data: { ...transaction }, error: null };
  });

  mock.method(supabase.storage, 'from', () => ({
    upload: async (path) => {
      state.uploads.push(path);
      return { error: null };
    },
  }));

  mock.method(axios, 'post', async (url) => {
    state.paystackRequests.push(url);
    if (String(url).endsWith('/transfer')) state.transferRequests += 1;
    throw new Error('Paystack must not be called by disabled financial endpoints');
  });
}

async function request(path, options = {}) {
  return fetch(`${baseUrl}${path}`, options);
}

function bearer(token, additionalHeaders = {}) {
  return {
    Authorization: `Bearer ${token}`,
    ...additionalHeaders,
  };
}

function signedWebhookBody(event) {
  const body = JSON.stringify(event);
  const signature = crypto
    .createHmac('sha512', PAYSTACK_SECRET)
    .update(body)
    .digest('hex');

  return {
    body,
    headers: {
      'Content-Type': 'application/json',
      'x-paystack-signature': signature,
    },
  };
}

async function postTransferEvent(event, path = '/api/paystack/webhook') {
  const signed = signedWebhookBody(event);
  return request(path, {
    method: 'POST',
    headers: signed.headers,
    body: signed.body,
  });
}

test.before(async () => {
  api = createApiServer();
  server = await new Promise((resolve, reject) => {
    const listener = api.server.listen(0, '127.0.0.1', () => resolve(listener));
    listener.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.beforeEach(() => {
  resetState();
  installSupabaseMocks();
});

test.afterEach(() => {
  mock.restoreAll();
});

test.after(async () => {
  await new Promise((resolve) => api.io.close(resolve));
});

test('wallet endpoints require a bearer token and derive ownership from it', async () => {
  const unauthorized = await request('/api/wallet', {
    headers: { 'x-user-id': RUNNER_ID },
  });
  assert.equal(unauthorized.status, 401);

  const invalidToken = await request('/api/wallet', {
    headers: bearer('invalid-token', { 'x-user-id': RUNNER_ID }),
  });
  assert.equal(invalidToken.status, 401);

  const response = await request('/api/wallet', {
    headers: bearer('runner-token', { 'x-user-id': CLIENT_ID }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    balance: 100,
    available_balance: 100,
    escrow_balance: 0,
  });
  assert.equal(state.walletUserFilter, RUNNER_ID);
  assert.equal(
    state.walletSelectedColumns,
    'balance, available_balance, escrow_balance'
  );
});

test('customer transaction routes reject another account despite forged identity headers', async () => {
  const response = await request(`/api/errands/transactions/${RUNNER_ID}`, {
    headers: bearer('client-token', { 'x-user-id': RUNNER_ID }),
  });

  assert.equal(response.status, 403);
  assert.ok(state.fromCalls.every(({ table }) => table === 'profiles'));
});

test('unverified customer is rejected across customer-facing REST operations', async () => {
  const jsonHeaders = {
    ...bearer('unverified-client-token', {
      'Content-Type': 'application/json',
      'x-user-id': CLIENT_ID,
      'x-role': 'admin',
    }),
  };
  const cases = [
    { path: '/wallet' },
    { path: '/api/wallet' },
    { path: '/api/errands' },
    {
      path: '/api/errands',
      method: 'POST',
      body: { title: 'Test errand', price: 10, client_id: CLIENT_ID },
    },
    { path: `/api/errands/transactions/${UNVERIFIED_CLIENT_ID}` },
    { path: `/api/errands/analytics/${UNVERIFIED_CLIENT_ID}` },
    {
      path: '/api/errands/00000000-0000-0000-0000-000000000106/dispute',
      method: 'POST',
      body: {},
    },
    { path: '/api/errands/wallet' },
    {
      path: '/api/errands/00000000-0000-0000-0000-000000000106/confirm',
      method: 'POST',
      body: {},
    },
    {
      path: '/api/errands/verify-otp',
      method: 'POST',
      body: { otp: '123456' },
    },
    {
      path: '/api/kyc/verify',
      method: 'POST',
      body: {},
    },
    {
      path: '/api/pin/set',
      method: 'POST',
      body: { pin: '1234' },
    },
    {
      path: '/api/pin/create',
      method: 'POST',
      body: { pin: '1234' },
    },
    {
      path: '/api/pin/verify',
      method: 'POST',
      body: { pin: '1234' },
    },
    {
      path: '/api/paystack/initialize',
      method: 'POST',
      body: { amount: 10 },
    },
    { path: '/api/paystack/verify/test-reference' },
  ];

  for (const testCase of cases) {
    const response = await request(testCase.path, {
      method: testCase.method ?? 'GET',
      headers: jsonHeaders,
      ...(testCase.body ? { body: JSON.stringify(testCase.body) } : {}),
    });

    assert.equal(response.status, 403, `${testCase.method ?? 'GET'} ${testCase.path}`);
  }

  assert.ok(state.fromCalls.length > 0);
  assert.ok(state.fromCalls.every(({ table }) => table === 'profiles'));
  assert.equal(state.rpcCalls.length, 0);
  assert.equal(state.paystackRequests.length, 0);
});

test('verified customers only receive their own errands and unsupported roles fail closed', async () => {
  const customerResponse = await request('/api/errands', {
    headers: bearer('client-token', { 'x-role': 'runner' }),
  });

  assert.equal(customerResponse.status, 200);
  assert.deepEqual(
    (await customerResponse.json()).map(({ id }) => id),
    ['client-errand']
  );
  assert.equal(state.errandClientFilter, CLIENT_ID);
  assert.equal(state.errandRunnerFilter, null);

  state.fromCalls = [];
  state.errandClientFilter = null;
  const unsupportedResponse = await request('/api/errands', {
    headers: bearer('unsupported-role-token'),
  });

  assert.equal(unsupportedResponse.status, 403);
  assert.equal(state.fromCalls.some(({ table }) => table === 'errands'), false);
});

test('unverified runners are denied customer account access', async () => {
  const response = await request('/wallet', {
    headers: bearer('unverified-runner-token'),
  });

  assert.equal(response.status, 403);
  assert.equal(state.walletUserFilter, null);
});

test('runner capability requires approved KYC and an active runner record', async () => {
  const errandId = '00000000-0000-0000-0000-000000000106';
  const pendingCustomerWallet = await request('/wallet', {
    headers: bearer('runner-token'),
  });
  assert.equal(pendingCustomerWallet.status, 200);

  const pending = await request(`/api/errands/${errandId}/accept`, {
    method: 'POST',
    headers: bearer('runner-token'),
  });
  assert.equal(pending.status, 403);
  assert.equal(state.rpcCalls.length, 0);

  state.kyc.status = 'rejected';
  const rejectedCustomerWallet = await request('/wallet', {
    headers: bearer('runner-token'),
  });
  assert.equal(rejectedCustomerWallet.status, 200);

  const rejected = await request(`/api/errands/${errandId}/accept`, {
    method: 'POST',
    headers: bearer('runner-token'),
  });
  assert.equal(rejected.status, 403);
  assert.equal(state.rpcCalls.length, 0);

  state.kyc.status = 'approved';
  state.runnerRecord.is_available = false;
  const suspended = await request(`/api/errands/${errandId}/accept`, {
    method: 'POST',
    headers: bearer('runner-token'),
  });
  assert.equal(suspended.status, 403);
  assert.equal(state.rpcCalls.length, 0);

  state.runnerRecord.is_available = true;
  const active = await request(`/api/errands/${errandId}/accept`, {
    method: 'POST',
    headers: bearer('runner-token'),
  });
  assert.equal(active.status, 200);
  assert.deepEqual(state.rpcCalls, [
    { name: 'accept_errand_atomic', args: { p_runner_id: RUNNER_ID, p_errand_id: errandId } },
  ]);
});

test('suspended runner keeps customer errands but not runner marketplace access', async () => {
  state.kyc.status = 'approved';
  state.runnerRecord.is_available = false;
  state.errandRows.push({
    id: 'runner-owned-customer-errand',
    client_id: RUNNER_ID,
    assigned_runner_id: null,
    created_at: '2026-01-03T00:00:00.000Z',
  });

  const response = await request('/api/errands', {
    headers: bearer('runner-token'),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(
    (await response.json()).map(({ id }) => id),
    ['runner-owned-customer-errand']
  );
  assert.equal(state.errandClientFilter, RUNNER_ID);
  assert.equal(state.errandRunnerFilter, null);
});

test('PIN set and verify require authentication and use only the verified account ID', async () => {
  const denied = await request('/api/pin/set', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': RUNNER_ID,
    },
    body: JSON.stringify({ pin: '0123' }),
  });
  assert.equal(denied.status, 401);

  const created = await request('/api/pin/set', {
    method: 'POST',
    headers: bearer('runner-token', {
      'Content-Type': 'application/json',
      'x-user-id': CLIENT_ID,
    }),
    body: JSON.stringify({ pin: '0123' }),
  });
  assert.equal(created.status, 200);
  assert.notEqual(state.users[RUNNER_ID].withdrawal_pin, '0123');
  assert.equal(state.users[CLIENT_ID].withdrawal_pin, null);
  assert.equal(state.pinUserFilter, RUNNER_ID);

  const duplicateSet = await request('/api/pin/set', {
    method: 'POST',
    headers: bearer('runner-token', {
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({ pin: '9876' }),
  });
  assert.equal(duplicateSet.status, 409);

  const verified = await request('/api/pin/verify', {
    method: 'POST',
    headers: bearer('runner-token', {
      'Content-Type': 'application/json',
      'x-user-id': CLIENT_ID,
    }),
    body: JSON.stringify({ pin: '0123' }),
  });
  assert.equal(verified.status, 200);
  assert.equal(state.pinUserFilter, RUNNER_ID);

  const invalidPin = await request('/api/pin/verify', {
    method: 'POST',
    headers: bearer('runner-token', {
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({ pin: '12ab' }),
  });
  assert.equal(invalidPin.status, 400);
});

test('KYC upload enforces runner role and ignores forged identity headers', async () => {
  const denied = await request('/api/storage/upload', {
    method: 'POST',
    headers: bearer('client-token', { 'x-user-id': RUNNER_ID }),
    body: new FormData(),
  });
  assert.equal(denied.status, 403);
  assert.equal(state.uploads.length, 0);

  const form = new FormData();
  form.append(
    'nin',
    new Blob([Buffer.from('%PDF-1.7\nunit test document')], {
      type: 'application/pdf',
    }),
    'identity.pdf'
  );

  const uploaded = await request('/api/storage/upload', {
    method: 'POST',
    headers: bearer('runner-token', { 'x-user-id': CLIENT_ID }),
    body: form,
  });
  assert.equal(uploaded.status, 200);
  assert.equal(state.kycUserFilter, RUNNER_ID);
  assert.equal(state.uploads.length, 1);
  assert.match(state.uploads[0], new RegExp(`^${RUNNER_ID}/`));

  const invalidForm = new FormData();
  invalidForm.append(
    'nin',
    new Blob(['not a PDF'], { type: 'application/pdf' }),
    'spoofed.pdf'
  );
  const invalidFile = await request('/api/storage/upload', {
    method: 'POST',
    headers: bearer('runner-token'),
    body: invalidForm,
  });
  assert.equal(invalidFile.status, 400);
  assert.equal(state.uploads.length, 1);
});

test('all withdrawal entry points fail closed without contacting Paystack', async () => {
  const paths = [
    '/errands/paystack/withdraw',
    '/api/errands/paystack/withdraw',
    '/withdraw',
    '/api/withdraw',
  ];

  const responses = await Promise.all(
    paths.map((path) =>
      request(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 50,
          recipient_code: 'untrusted-recipient',
          'x-runner-id': RUNNER_ID,
        }),
      })
    )
  );

  for (const [index, response] of responses.entries()) {
    const path = paths[index];
    assert.equal(response.status, 503, path);
    assert.deepEqual(await response.json(), {
      success: false,
      message: 'Withdrawals are temporarily unavailable.',
    });
  }

  assert.equal(state.transferRequests, 0);
  assert.equal(state.fromCalls.length, 0);
  assert.equal(state.rpcCalls.length, 0);
});

test('withdrawal and recipient creation aliases are disabled without financial side effects', async () => {
  const paths = [
    '/errands/withdraw',
    '/api/errands/withdraw',
    '/errands/paystack/create-recipient',
    '/api/errands/paystack/create-recipient',
  ];
  const initialWalletRows = structuredClone(state.walletRows);
  const initialTransaction = structuredClone(state.transaction);

  for (const path of paths) {
    const response = await request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 50,
        pin: '1234',
        recipient_code: 'untrusted-recipient',
        account_number: '0000000000',
        bank_code: '000',
        name: 'Test Recipient',
      }),
    });

    assert.equal(response.status, 503, path);
    const body = await response.json();
    assert.equal(body.success, false, path);
    assert.match(body.message, /temporarily unavailable/i, path);
    assert.deepEqual(state.walletRows, initialWalletRows, path);
    assert.equal(state.walletAvailableBalance, 100, path);
    assert.deepEqual(state.transaction, initialTransaction, path);
    assert.deepEqual(state.recipientRecords, [], path);
    assert.deepEqual(state.paystackRequests, [], path);
    assert.deepEqual(state.fromCalls, [], path);
    assert.deepEqual(state.rpcCalls, [], path);
  }
});

test('signed failed-transfer webhook replay refunds once through the atomic RPC', async () => {
  const event = {
    event: 'transfer.failed',
    data: { reference: REFERENCE, amount: 5000 },
  };

  const [first, replay] = await Promise.all([
    postTransferEvent(event),
    postTransferEvent(event, '/paystack/webhook'),
  ]);
  assert.equal(first.status, 200);
  assert.equal(replay.status, 200);

  assert.equal(state.walletAvailableBalance, 150);
  assert.equal(state.transaction.status, 'failed');
  assert.equal(state.rpcCalls.length, 2);
  assert.ok(
    state.rpcCalls.every(
      ({ name, args }) =>
        name === 'reconcile_paystack_transfer_atomic' &&
        args.p_reference === REFERENCE &&
        args.p_event === 'transfer.failed' &&
        args.p_amount_minor === 5000
    )
  );
  assert.equal(state.fromCalls.length, 0);
});

test('invalid Paystack signatures and transfer amount mismatches do not mutate balances', async () => {
  const body = JSON.stringify({
    event: 'transfer.failed',
    data: { reference: REFERENCE, amount: 5000 },
  });
  const invalidSignature = await request('/paystack/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-paystack-signature': 'invalid',
    },
    body,
  });
  assert.equal(invalidSignature.status, 401);
  assert.equal(state.rpcCalls.length, 0);

  const mismatched = await postTransferEvent({
    event: 'transfer.failed',
    data: { reference: REFERENCE, amount: 4999 },
  });
  assert.equal(mismatched.status, 500);
  assert.equal(state.walletAvailableBalance, 100);
  assert.equal(state.transaction.status, 'pending');
});

test('duplicate successful transfer events remain terminal without wallet refunds', async () => {
  const event = {
    event: 'transfer.success',
    data: { reference: REFERENCE, amount: 5000 },
  };

  assert.equal((await postTransferEvent(event)).status, 200);
  assert.equal((await postTransferEvent(event)).status, 200);
  assert.equal(state.transaction.status, 'completed');
  assert.equal(state.walletAvailableBalance, 100);
});
