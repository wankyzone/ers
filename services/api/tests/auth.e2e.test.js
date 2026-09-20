import '../env.js';

import test from 'node:test';
import assert from 'node:assert/strict';

import { createApiServer } from '../app.js';
import {
  adminSupabase,
  createAuthUser,
  signInUser,
  deleteAuthUser,
} from './helpers/supabaseAuth.js';

const clientEmail = `e2e-client-${Date.now()}@ers.test`;
const runnerEmail = `e2e-runner-${Date.now()}@ers.test`;

const clientPassword = 'E2E-Test-Password-123!';
const runnerPassword = 'E2E-Test-Password-123!';

const errandPrice = 5000;
const idempotencyKey = `e2e-create-${Date.now()}`;

let clientUser;
let runnerUser;
let server;
let createdErrandId;

test('E2E marketplace: client creates errand and runner accepts it', async () => {
  /*
   * ============================================================
   * 1. CREATE CLIENT AUTH + APPLICATION FIXTURE
   * ============================================================
   */

  clientUser = await createAuthUser({
    email: clientEmail,
    password: clientPassword,
    role: 'client',
  });

  const clientId = clientUser.id;

  const { error: clientUserError } = await adminSupabase
    .from('users')
    .insert({
      id: clientId,
      email: clientEmail,
      full_name: 'E2E Test Client',
      role: 'client',
      kyc_verified: true,
    });

  assert.ifError(clientUserError);

  const { error: clientProfileError } = await adminSupabase
    .from('profiles')
    .insert({
      id: clientId,
      email: clientEmail,
      role: 'client',
      verified: true,
    });

  assert.ifError(clientProfileError);

  const { error: walletError } = await adminSupabase
    .from('wallets')
    .insert({
      user_id: clientId,
      balance: errandPrice,
      available_balance: errandPrice,
      escrow_balance: 0,
      pending_balance: 0,
    });

  assert.ifError(walletError);

  /*
   * ============================================================
   * 2. CREATE RUNNER AUTH + APPLICATION FIXTURE
   * ============================================================
   */

  runnerUser = await createAuthUser({
    email: runnerEmail,
    password: runnerPassword,
    role: 'runner',
  });

  const runnerId = runnerUser.id;

  const { error: runnerUserError } = await adminSupabase
    .from('users')
    .insert({
      id: runnerId,
      email: runnerEmail,
      full_name: 'E2E Test Runner',
      role: 'runner',
      kyc_verified: true,
    });

  assert.ifError(runnerUserError);

  const { error: runnerProfileError } = await adminSupabase
    .from('profiles')
    .insert({
      id: runnerId,
      email: runnerEmail,
      role: 'runner',
      verified: true,
    });

  assert.ifError(runnerProfileError);

  const { error: runnerRecordError } = await adminSupabase
    .from('runners')
    .insert({
      id: runnerId,
      name: 'E2E Test Runner',
      email: runnerEmail,
      is_available: true,
      total_earnings: 0,
    });

  assert.ifError(runnerRecordError);

  /*
   * ============================================================
   * 3. SIGN IN THROUGH REAL SUPABASE AUTH
   * ============================================================
   */

  const clientAuth = await signInUser({
    email: clientEmail,
    password: clientPassword,
  });

  const runnerAuth = await signInUser({
    email: runnerEmail,
    password: runnerPassword,
  });

  assert.ok(clientAuth.accessToken);
  assert.ok(runnerAuth.accessToken);

  /*
   * ============================================================
   * 4. START REAL API SERVER
   * ============================================================
   */

  const created = createApiServer();

  server = await new Promise((resolve, reject) => {
    const instance = created.server.listen(0, () => resolve(instance));
    instance.once('error', reject);
  });

  const { port } = server.address();

  const baseUrl = `http://127.0.0.1:${port}`;

  /*
   * ============================================================
   * 5. CLIENT CREATES ERRAND
   * ============================================================
   */

  const createResponse = await fetch(`${baseUrl}/errands`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${clientAuth.accessToken}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      title: 'E2E Marketplace Errand',
      description: 'Created by Sprint 6 E2E test',
      price: errandPrice,
    }),
  });

  assert.equal(createResponse.status, 200);

  const errand = await createResponse.json();

  assert.ok(errand.id);
  assert.equal(errand.client_id, clientId);
  assert.equal(errand.title, 'E2E Marketplace Errand');
  assert.equal(errand.description, 'Created by Sprint 6 E2E test');
  assert.equal(Number(errand.price), errandPrice);
  assert.equal(Number(errand.payout_amount), 4000);
  assert.equal(errand.status, 'created');
  assert.equal(errand.escrow_status, 'locked');

  createdErrandId = errand.id;

  const { data: clientWalletAfterCreate, error: clientWalletAfterCreateError } =
    await adminSupabase
      .from('wallets')
      .select('id, user_id, balance, available_balance, escrow_balance')
      .eq('user_id', clientId)
      .single();

  assert.ifError(clientWalletAfterCreateError);


  /*
   * ============================================================
   * 6. RUNNER ACCEPTS THROUGH REAL HTTP API
   * ============================================================
   */

  const acceptResponse = await fetch(
    `${baseUrl}/errands/${createdErrandId}/accept`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${runnerAuth.accessToken}`,
      },
    }
  );

  assert.equal(acceptResponse.status, 200);

  const acceptedErrand = await acceptResponse.json();

  assert.equal(acceptedErrand.id, createdErrandId);
  assert.equal(acceptedErrand.client_id, clientId);
  assert.equal(acceptedErrand.assigned_runner_id, runnerId);
  assert.equal(acceptedErrand.status, 'accepted');
  assert.ok(acceptedErrand.assigned_at);

  const { data: clientWalletAfterAccept, error: clientWalletAfterAcceptError } =
    await adminSupabase
      .from('wallets')
      .select('balance, available_balance, escrow_balance')
      .eq('user_id', clientId)
      .single();

  assert.ifError(clientWalletAfterAcceptError);

  /*
   * ============================================================
   * 7. RUNNER COMPLETES ERRAND THROUGH REAL HTTP API
   * ============================================================
   */

  const completeResponse = await fetch(
    `${baseUrl}/errands/${createdErrandId}/complete`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${runnerAuth.accessToken}`,
      },
    }
  );

  assert.equal(completeResponse.status, 200);

  const completedErrand = await completeResponse.json();

  assert.equal(completedErrand.id, createdErrandId);
  assert.equal(completedErrand.status, 'completed');
  assert.equal(completedErrand.escrow_status, 'awaiting_confirmation');
  assert.ok(completedErrand.completed_at);

  const { data: clientWalletAfterComplete, error: clientWalletAfterCompleteError } =
    await adminSupabase
      .from('wallets')
      .select('balance, available_balance, escrow_balance')
      .eq('user_id', clientId)
      .single();

  assert.ifError(clientWalletAfterCompleteError);

  const { data: persistedCompletedErrand, error: completedErrandReadError } =
    await adminSupabase
      .from('errands')
      .select('id, status, escrow_status, completed_at')
      .eq('id', createdErrandId)
      .single();

  assert.ifError(completedErrandReadError);

  assert.equal(persistedCompletedErrand.id, createdErrandId);
  assert.equal(persistedCompletedErrand.status, 'completed');
  assert.equal(persistedCompletedErrand.escrow_status, 'awaiting_confirmation');
  assert.ok(persistedCompletedErrand.completed_at);

  /*
   * ============================================================
   * 8. CLIENT CONFIRMS AND RELEASES ESCROW THROUGH REAL HTTP API
   * ============================================================
   */

  const confirmResponse = await fetch(
    `${baseUrl}/errands/${createdErrandId}/confirm`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${clientAuth.accessToken}`,
      },
    }
  );

  assert.equal(confirmResponse.status, 200);

  const confirmedErrand = await confirmResponse.json();

  assert.equal(confirmedErrand.id, createdErrandId);
  assert.equal(confirmedErrand.status, 'confirmed');
  assert.equal(confirmedErrand.escrow_status, 'released');
  assert.ok(confirmedErrand.confirmed_at);

  const { data: clientWalletAfterConfirm, error: clientWalletAfterConfirmError } =
    await adminSupabase
      .from('wallets')
      .select('balance, available_balance, escrow_balance')
      .eq('user_id', clientId)
      .single();

  assert.ifError(clientWalletAfterConfirmError);

  const { data: clientWalletAfterRelease, error: clientWalletAfterReleaseError } =
    await adminSupabase
      .from('wallets')
      .select('balance, available_balance, escrow_balance')
      .eq('user_id', clientId)
      .single();

  assert.ifError(clientWalletAfterReleaseError);
  assert.equal(Number(clientWalletAfterRelease.balance), 0);
  assert.equal(Number(clientWalletAfterRelease.available_balance), 0);
  assert.equal(Number(clientWalletAfterRelease.escrow_balance), 0);

  const { data: runnerWalletAfterRelease, error: runnerWalletAfterReleaseError } =
    await adminSupabase
      .from('wallets')
      .select('balance, available_balance, escrow_balance')
      .eq('user_id', runnerId)
      .single();

  assert.ifError(runnerWalletAfterReleaseError);
  assert.equal(Number(runnerWalletAfterRelease.available_balance), Number(errand.payout_amount));
  assert.equal(Number(runnerWalletAfterRelease.balance), Number(errand.payout_amount));
  assert.equal(Number(runnerWalletAfterRelease.escrow_balance), 0);

  const { data: releaseTransactions, error: releaseTransactionsError } =
    await adminSupabase
      .from('transactions')
      .select('amount, status, type, client_id, runner_id, idempotency_key')
      .eq('errand_id', createdErrandId)
      .eq('type', 'release');

  assert.ifError(releaseTransactionsError);
  assert.equal(releaseTransactions.length, 1);
  assert.equal(Number(releaseTransactions[0].amount), Number(errand.price));
  assert.equal(releaseTransactions[0].status, 'completed');
  assert.equal(releaseTransactions[0].type, 'release');
  assert.equal(releaseTransactions[0].client_id, clientId);
  assert.equal(releaseTransactions[0].runner_id, runnerId);
  assert.equal(releaseTransactions[0].idempotency_key, `escrow-release:${createdErrandId}`);

  const secondConfirmResponse = await fetch(
    `${baseUrl}/errands/${createdErrandId}/confirm`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${clientAuth.accessToken}`,
      },
    }
  );

  assert.equal(secondConfirmResponse.status, 200);

  const secondConfirmedErrand = await secondConfirmResponse.json();

  assert.equal(secondConfirmedErrand.id, createdErrandId);
  assert.equal(secondConfirmedErrand.status, 'confirmed');
  assert.equal(secondConfirmedErrand.escrow_status, 'released');
  assert.ok(secondConfirmedErrand.confirmed_at);

  const { data: secondClientWallet, error: secondClientWalletError } =
    await adminSupabase
      .from('wallets')
      .select('balance, available_balance, escrow_balance')
      .eq('user_id', clientId)
      .single();

  assert.ifError(secondClientWalletError);
  assert.equal(Number(secondClientWallet.balance), 0);
  assert.equal(Number(secondClientWallet.available_balance), 0);
  assert.equal(Number(secondClientWallet.escrow_balance), 0);

  const { data: secondRunnerWallet, error: secondRunnerWalletError } =
    await adminSupabase
      .from('wallets')
      .select('balance, available_balance, escrow_balance')
      .eq('user_id', runnerId)
      .single();

  assert.ifError(secondRunnerWalletError);
  assert.equal(Number(secondRunnerWallet.available_balance), Number(errand.payout_amount));
  assert.equal(Number(secondRunnerWallet.balance), Number(errand.payout_amount));
  assert.equal(Number(secondRunnerWallet.escrow_balance), 0);

  const { data: secondReleaseTransactions, error: secondReleaseTransactionsError } =
    await adminSupabase
      .from('transactions')
      .select('id, amount, status, type, client_id, runner_id, idempotency_key')
      .eq('errand_id', createdErrandId)
      .eq('type', 'release');

  assert.ifError(secondReleaseTransactionsError);
  assert.equal(secondReleaseTransactions.length, 1);
  assert.equal(Number(secondReleaseTransactions[0].amount), Number(errand.price));
  assert.equal(secondReleaseTransactions[0].status, 'completed');
  assert.equal(secondReleaseTransactions[0].type, 'release');
  assert.equal(secondReleaseTransactions[0].client_id, clientId);
  assert.equal(secondReleaseTransactions[0].runner_id, runnerId);
  assert.equal(secondReleaseTransactions[0].idempotency_key, `escrow-release:${createdErrandId}`);

  /*
   * ============================================================
   * 9. VERIFY DATABASE STATE FOR FINAL ACCEPTED/COMPLETED/CONFIRMED
   * ============================================================
   */

  const { data: persistedErrand, error: errandReadError } =
    await adminSupabase
      .from('errands')
      .select('id, client_id, assigned_runner_id, status, escrow_status, assigned_at, completed_at, confirmed_at')
      .eq('id', createdErrandId)
      .single();

  assert.ifError(errandReadError);

  assert.equal(persistedErrand.id, createdErrandId);
  assert.equal(persistedErrand.client_id, clientId);
  assert.equal(persistedErrand.assigned_runner_id, runnerId);
  assert.equal(persistedErrand.status, 'confirmed');
  assert.equal(persistedErrand.escrow_status, 'released');
  assert.ok(persistedErrand.assigned_at);
  assert.ok(persistedErrand.completed_at);
  assert.ok(persistedErrand.confirmed_at);
});

test.after(async () => {
  /*
   * ============================================================
   * CLEANUP
   * ============================================================
   */

  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  if (createdErrandId) {
    await adminSupabase
      .from('transactions')
      .delete()
      .eq('errand_id', createdErrandId);

    await adminSupabase
      .from('errands')
      .delete()
      .eq('id', createdErrandId);
  }

  if (runnerUser) {
    await adminSupabase
      .from('runners')
      .delete()
      .eq('id', runnerUser.id);

    await adminSupabase
      .from('profiles')
      .delete()
      .eq('id', runnerUser.id);

    await adminSupabase
      .from('users')
      .delete()
      .eq('id', runnerUser.id);

    await deleteAuthUser(runnerUser.id);
  }

  if (clientUser) {
    await adminSupabase
      .from('wallets')
      .delete()
      .eq('user_id', clientUser.id);

    await adminSupabase
      .from('profiles')
      .delete()
      .eq('id', clientUser.id);

    await adminSupabase
      .from('users')
      .delete()
      .eq('id', clientUser.id);

    await deleteAuthUser(clientUser.id);
  }
});
