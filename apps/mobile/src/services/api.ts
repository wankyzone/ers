/**
 * LOCATION: src/services/api.ts
 *
 * ═══════════════════════════════════════════════════════════════════
 * ROOT CAUSE ANALYSIS — every missing export, traced to the backend
 * ═══════════════════════════════════════════════════════════════════
 *
 * ── getTransactions / Transaction ───────────────────────────────────
 * BACKEND EXISTS: GET /transactions/:userId  (errands.js line ~380)
 * Route reads userId from URL param, NOT from x-user-id header.
 * Previous implementation called GET /api/transactions with no userId
 * in the path → 404 every time.
 * FIX: GET /api/transactions/${userId} — userId injected by caller
 * since apiFetch has no way to know it from module-level currentUser
 * in the URL (only in headers). getTransactions() now accepts userId.
 *
 * Transaction type was wrong: backend inserts type values of
 * 'escrow_lock', 'deposit', 'withdraw', 'release', 'withdrawal' —
 * the previous union was missing most of these.
 *
 * ── getUserBanks / setDefaultBank / deleteBank / BankAccount ────────
 * BACKEND DOES NOT EXIST in errands.js.
 * No GET /api/bank-accounts, PATCH /api/bank-accounts/:id/default,
 * DELETE /api/bank-accounts/:id route exists anywhere in the provided
 * backend code. These are used by SavedBanksScreen and KycScreen.
 * STRATEGY: implement frontend wrappers targeting the most likely REST
 * paths (/api/bank-accounts). They will 404 until the backend adds the
 * routes. This is correct: the TypeScript error is a frontend concern;
 * the 404 is a backend concern. Do NOT remove the screens or the calls.
 *
 * ── withdrawWithPin ──────────────────────────────────────────────────
 * BACKEND EXISTS: POST /withdraw  (errands.js line ~290)
 * Route reads: x-user-id header, body { amount, pin }
 * Route performs: cooldown check, PIN validation, KYC check, limit
 * check, fraud detection, bank check, balance check, Paystack transfer.
 * PROBLEM: The route computes requireOtp but NEVER sends it in the
 * response. It always returns { success: true, message: 'Withdrawal
 * processing' } regardless. This is a backend bug.
 * FIX (frontend): treat the response as { requireOtp?: boolean,
 * message?: string, success?: boolean }. The field will be undefined
 * until the backend sends it, so res.requireOtp will be falsy and the
 * normal success path runs. No screen changes needed for this.
 * The route path is /withdraw not /wallet/withdraw — fixed here.
 *
 * ── getClientErrands → GET /api/errands ─────────────────────────────
 * BACKEND EXISTS: GET / (role-filtered)
 * Previous: GET /api/errands/client → 404 (no such path)
 * Backend GET / filters by x-role='client' → returns that user's errands.
 * FIX: GET /api/errands with x-role: 'client' in headers (apiFetch
 * already injects x-role from currentUser.role, so no extra header needed)
 *
 * ── getOpenErrands → GET /api/errands ───────────────────────────────
 * BACKEND EXISTS: GET / (role-filtered)
 * Previous: GET /api/errands/open → 404 (no such path)
 * Backend GET / filters by x-role='runner' → returns open + assigned errands.
 * FIX: GET /api/errands with x-role: 'runner'
 * Both getClientErrands and getOpenErrands hit the same route.
 * The role header (already set by setApiUser) determines what is returned.
 *
 * ── createErrand ────────────────────────────────────────────────────
 * BACKEND EXISTS: POST / (errands.js line ~10)
 * Backend reads: x-client-id header (NOT x-user-id)
 * Previous apiFetch injected x-user-id but NOT x-client-id.
 * FIX: createErrand explicitly sets x-client-id header.
 *
 * ── Errand type ─────────────────────────────────────────────────────
 * Backend schema (from errands.js INSERT):
 *   title, description, client_id, price, payout_amount, status,
 *   escrow_status, escrow_locked_at, assigned_runner_id,
 *   accepted_at, completed_at, confirmed_at
 * Previous type had `budget` (doesn't exist), missing all status fields,
 * missing all timestamps, missing client_id, assigned_runner_id.
 * RunnerScreen's resolveAmount() checked errand.budget || errand.price.
 * Since backend only has `price`, budget will always be undefined.
 * Keeping budget as optional so resolveAmount() still compiles; it just
 * always falls through to `price` at runtime.
 *
 * ── addBankAccount ───────────────────────────────────────────────────
 * Backend has POST /paystack/create-recipient which creates a Paystack
 * transfer recipient (not a saved bank account). The KycScreen calls
 * addBankAccount to persist the bank after KYC. Since no /api/bank-accounts
 * POST route exists, this will 404. Keeping the export so the screen
 * compiles; needs backend route.
 */

// ─── Config ──────────────────────────────────────────────────────────────────

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

type ApiResponse = {
  message?: string;
  error?: string;
  status?: boolean;
  success?: boolean;
  data?: any;
  balance?: number;
  available_balance?: number;
  accounts?: BankAccount[];
  [key: string]: any;
};

// Module-level user reference — set by AuthContext after login
let currentUser: {
  id: string;
  role: string;
  email?: string;
} | null = null;

export const setApiUser = (
  user: { id: string; role: string; email?: string } | null
) => {
  currentUser = user;
};

// ─── Types ───────────────────────────────────────────────────────────────────

export type ApiError = {
  message: string;
};

/**
 * Errand — reconciled against the actual backend schema in errands.js.
 *
 * Backend INSERT fields (POST /):
 *   title, description, client_id, price, payout_amount, status,
 *   escrow_status, escrow_locked_at, assigned_runner_id
 *
 * Backend UPDATE fields (various routes):
 *   status: 'created' | 'accepted' | 'completed' | 'confirmed'
 *   escrow_status: 'locked' | 'awaiting_confirmation' | 'released' | 'under_review'
 *   assigned_runner_id, accepted_at, completed_at, confirmed_at
 *
 * `budget` does not exist in the backend schema. It is kept as optional
 * here solely because RunnerScreen.resolveAmount() references it and the
 * field is harmless when undefined. At runtime it will always be undefined
 * and resolveAmount() will fall through to `price`.
 */
export type Errand = {
  id: string;
  title: string;
  description?: string;
  client_id?: string;
  assigned_runner_id?: string;
  price?: number;
  payout_amount?: number;
  budget?: number;           // not in backend schema — always undefined at runtime
  status?: 'created' | 'accepted' | 'completed' | 'confirmed' | string;
  escrow_status?: 'locked' | 'awaiting_confirmation' | 'released' | 'under_review' | string;
  pickup_location?: string;
  delivery_location?: string;
  escrow_locked_at?: string;
  accepted_at?: string;
  completed_at?: string;
  confirmed_at?: string;
  created_at?: string;
};

/**
 * Transaction — reconciled against backend transactions table inserts.
 *
 * Types inserted by backend:
 *   'escrow_lock'  — when errand is created (funds locked)
 *   'release'      — when errand is confirmed (escrow released to runner)
 *   'withdraw'     — Paystack withdrawal (older route)
 *   'withdrawal'   — PIN withdrawal (newer route)
 *   'deposit'      — wallet funding (via Paystack verify)
 *
 * WithdrawHistoryScreen filters by type === 'release'
 * WalletDashboard computes income from type === 'release' | 'refund'
 *                          expense from type === 'payment'
 */
export type Transaction = {
  id: string;
  user_id?: string;
  client_id?: string;
  runner_id?: string;
  type:
    | 'escrow_lock'
    | 'release'
    | 'withdraw'
    | 'withdrawal'
    | 'deposit'
    | 'payment'
    | 'refund'
    | string;
  amount: number;
  status: 'pending' | 'completed' | 'failed' | string;
  reference?: string;
  errand_id?: string;
  description?: string;
  created_at: string;
};

/**
 * BankAccount — no backend route exists yet for bank account management.
 * Shape matches what SavedBanksScreen and WalletScreen expect.
 * Fields mirror what a POST /api/bank-accounts would store.
 */
export type BankAccount = {
  id: string;
  bank_name: string;
  bank_code: string;
  account_number: string;
  account_name: string;
  is_default: boolean;
  recipient_code?: string;  // Paystack recipient code for transfers
};

// ─── Core Fetch ──────────────────────────────────────────────────────────────

/**
 * apiFetch — centralized fetch with auth headers and JSON parsing.
 *
 * Returns { data, res } so callers control error handling:
 *   const { data, res } = await apiFetch('/api/wallet')
 *   if (!res.ok) throw new Error(data?.message)
 *
 * Auth headers injected automatically from currentUser (set via setApiUser):
 *   x-user-id, x-role, x-runner-id
 *
 * Callers can override any header by passing options.headers.
 */
export async function apiFetch(
  path: string,
  options: RequestInit & { headers?: Record<string, string> } = {}
): Promise<{ data: unknown; res: Response }> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(currentUser?.id
        ? {
            'x-user-id': currentUser.id,
            'x-role': currentUser.role,
            'x-runner-id': currentUser.id,
          }
        : {}),
      ...(options.headers ?? {}),
    },
  });

  const text = await res.text();
  let data: ApiResponse | ApiResponse[] | string;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return { data, res };
}

// ─── Errands — Client ────────────────────────────────────────────────────────

/**
 * getClientErrands
 *
 * Backend route: GET /  (errands.js ~line 220)
 * Filters by x-role='client' → returns only that client's errands.
 *
 * Previous path /api/errands/client did not exist → 404.
 * Fixed: hit GET /api/errands with role already set in apiFetch headers.
 */
export const getClientErrands = async (): Promise<Errand[]> => {
  const { data, res } = await apiFetch('/api/errands');
  if (!res.ok) throw new Error(data?.message ?? 'Failed to load errands');
  return Array.isArray(data) ? data : [];
};

/**
 * createErrand
 *
 * Backend route: POST /  (errands.js ~line 10)
 * CRITICAL: backend reads x-client-id header, NOT x-user-id.
 * apiFetch injects x-user-id automatically. This function explicitly
 * adds x-client-id so the backend finds the client identity.
 *
 * Body: { title, description, price }
 * Note: backend uses `price`, not `budget`. The CreateErrandScreen
 * should send `price` in the body, not `budget`.
 */
export const createErrand = async (payload: {
  title: string;
  description: string;
  pickup_location?: string;
  delivery_location?: string;
  price: number;           // backend field — not `budget`
}): Promise<Errand> => {
  const { data, res } = await apiFetch('/api/errands', {
    method: 'POST',
    // Backend reads x-client-id — must be explicit because apiFetch
    // only injects x-user-id, x-role, x-runner-id
    headers: {
      'x-client-id': currentUser?.id ?? '',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? 'Failed to create errand');
  return data;
};

/**
 * confirmErrand
 *
 * Backend route: POST /:id/confirm  (errands.js ~line 130)
 * Reads: x-user-id header (injected by apiFetch automatically)
 * Releases escrow to runner and logs a 'release' transaction.
 */
export const confirmErrand = async (id: string): Promise<{ success: boolean }> => {
  const { data, res } = await apiFetch(`/api/errands/${id}/confirm`, {
    method: 'POST',
  });

  if (!res.ok) {
    throw new Error(data?.message ?? data?.error ?? 'Failed to confirm errand');
  }

  return data;
};

// ─── Errands — Runner ────────────────────────────────────────────────────────

/**
 * getOpenErrands
 *
 * Backend route: GET /  (errands.js ~line 220)
 * Filters by x-role='runner' → returns unassigned + assigned-to-me errands.
 *
 * Previous path /api/errands/open did not exist → 404.
 * Fixed: same GET /api/errands route, role header determines the filter.
 */
export const getOpenErrands = async (): Promise<Errand[]> => {
  const { data, res } = await apiFetch('/api/errands');
  if (!res.ok) throw new Error(data?.message ?? 'Failed to load errands');
  return Array.isArray(data) ? data : [];
};

/**
 * acceptErrand
 *
 * Backend route: POST /:id/accept  (errands.js ~line 60)
 * Reads: x-runner-id header (injected by apiFetch automatically)
 * Updates errand status to 'accepted', sets assigned_runner_id.
 */
export const acceptErrand = async (id: string): Promise<Errand> => {
  const { data, res } = await apiFetch(`/api/errands/${id}/accept`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? 'Failed to accept errand');
  return data;
};

/**
 * completeErrand
 *
 * Backend route: POST /:id/complete  (errands.js ~line 95)
 * Reads: x-runner-id header
 * Updates errand status to 'completed', escrow_status to 'awaiting_confirmation'.
 */
export const completeErrand = async (id: string): Promise<Errand> => {
  const { data, res } = await apiFetch(`/api/errands/${id}/complete`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? 'Failed to complete errand');
  return data;
};

// ─── Transactions ─────────────────────────────────────────────────────────────

/**
 * getTransactions
 *
 * Backend route: GET /transactions/:userId  (errands.js ~line 380)
 * CRITICAL: route reads userId from URL param, NOT from any header.
 * Previous implementation called GET /api/transactions (no userId) → 404.
 * Fixed: URL includes userId directly.
 *
 * Requires userId to be passed by the caller (read from useAuth().user.id).
 */
export const getTransactions = async (userId: string): Promise<Transaction[]> => {
  const { data, res } = await apiFetch(`/api/transactions/${userId}`);
  if (!res.ok) throw new Error(data?.message ?? 'Failed to load transactions');
  return Array.isArray(data) ? data : [];
};

// ─── Wallet ───────────────────────────────────────────────────────────────────

/**
 * getWallet
 *
 * Backend route: GET /wallet  (errands.js ~line 410)
 * Reads: x-user-id header (injected by apiFetch)
 * Returns: { balance, available_balance, escrow_balance, ... }
 */
export const getWallet = async (): Promise<{ balance: number; available_balance: number }> => {
  const { data, res } = await apiFetch('/api/wallet');
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? 'Failed to load wallet');
  return {
    balance: Number(data?.balance) || 0,
    available_balance: Number(data?.available_balance) || 0,
  };
};

// ─── Withdrawals ──────────────────────────────────────────────────────────────

/**
 * withdrawWithPin
 *
 * Backend route: POST /withdraw  (errands.js ~line 290)
 * Reads: x-user-id header (injected by apiFetch), body { amount, pin }
 *
 * IMPORTANT — backend bug: the route computes `requireOtp` but the final
 * res.json({ success: true, message: 'Withdrawal processing' }) never
 * includes it. At runtime requireOtp will always be undefined (falsy),
 * so the OTP branch in WithdrawScreen will never trigger until the backend
 * is fixed to return { requireOtp: true } when appropriate.
 *
 * The return type is kept as { requireOtp?: boolean; message?: string }
 * so when the backend fix ships, the frontend handles it automatically.
 *
 * Previous path: /api/wallet/withdraw → 404 (no such path)
 * Fixed path: /api/withdraw
 */
export const withdrawWithPin = async (
  amount: number,
  pin: string
): Promise<{ requireOtp?: boolean; message?: string; success?: boolean }> => {
  const { data, res } = await apiFetch('/api/withdraw', {
    method: 'POST',
    body: JSON.stringify({ amount, pin }),
  });
  if (!res.ok) throw new Error(data?.message ?? 'Withdrawal failed');
  return data;
};

// ─── Bank Accounts ────────────────────────────────────────────────────────────
//
// NO backend routes exist for bank account management in errands.js.
// These wrappers target the most likely REST paths. They will return 404
// until the backend implements the routes. Kept here so screens compile.
//
// When backend routes are added, no frontend changes will be needed.

/**
 * getUserBanks — NO BACKEND ROUTE EXISTS YET
 * Expected: GET /api/bank-accounts
 */
export const getUserBanks = async (): Promise<BankAccount[]> => {
  const { data, res } = await apiFetch('/api/bank-accounts');
  if (!res.ok) {
    // Return empty array rather than throwing so WalletScreen degrades
    // gracefully (shows "No default bank set") instead of crashing.
    console.warn('[api] getUserBanks: backend route not implemented yet');
    return [];
  }
  return Array.isArray(data) ? data : (data?.accounts ?? []);
};

/**
 * setDefaultBank — NO BACKEND ROUTE EXISTS YET
 * Expected: PATCH /api/bank-accounts/:id/default
 */
export const setDefaultBank = async (id: string): Promise<void> => {
  const { data, res } = await apiFetch(`/api/bank-accounts/${id}/default`, {
    method: 'PATCH',
  });
  if (!res.ok) throw new Error(data?.message ?? 'Failed to set default bank');
};

/**
 * deleteBank — NO BACKEND ROUTE EXISTS YET
 * Expected: DELETE /api/bank-accounts/:id
 */
export const deleteBank = async (id: string): Promise<void> => {
  const { data, res } = await apiFetch(`/api/bank-accounts/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(data?.message ?? 'Failed to delete bank');
};

/**
 * addBankAccount — NO BACKEND ROUTE EXISTS YET
 * Expected: POST /api/bank-accounts
 *
 * NOTE: The backend has POST /paystack/create-recipient which creates a
 * Paystack transfer recipient — that is a different concept (payment rail
 * setup) vs saving a bank for display. The frontend needs both eventually.
 * This wrapper targets the bank storage route; call createPaystackRecipient
 * separately for the payment rail.
 */
export const addBankAccount = async (payload: {
  bank_name: string;
  bank_code: string;
  account_number: string;
  account_name: string;
}): Promise<BankAccount> => {
  const { data, res } = await apiFetch('/api/bank-accounts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(data?.message ?? 'Failed to add bank account');
  return data;
};

/**
 * createPaystackRecipient — creates a Paystack transfer recipient.
 *
 * Backend route: POST /paystack/create-recipient  (errands.js ~line 395)
 * Required before initiating a Paystack transfer for withdrawal.
 * Call this during KYC or bank setup to get the recipient_code,
 * then store it alongside the bank account record.
 */
export const createPaystackRecipient = async (payload: {
  account_number: string;
  bank_code: string;
  name: string;
}): Promise<{ recipient_code: string; [key: string]: unknown }> => {
  const { data, res } = await apiFetch('/api/paystack/create-recipient', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(data?.message ?? 'Failed to create recipient');
  return data?.data ?? data;
};