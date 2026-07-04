import express from 'express';
import supabase from '../supabase.js';
import axios from 'axios';
import crypto from 'crypto';

const router = express.Router();

/* ================= CREATE ERRAND ================= */
router.post('/', async (req, res) => {
  try {
    const clientId = req.headers['x-client-id'];
    const { title, description, price } = req.body;

    /* ===== VALIDATION ===== */
    if (!clientId) {
      return res.status(400).json({ error: "Missing client ID" });
    }

    if (!title || !price || Number(price) <= 0) {
      return res.status(400).json({ error: "Invalid input" });
    }

    const amount = Number(price);
    const payout_amount = Math.floor(amount * 0.8);

    /* ===== GET OR CREATE WALLET ===== */
    let { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', clientId)
      .single();

    if (walletError || !wallet) {
      const { data: newWallet, error: createWalletError } = await supabase
        .from('wallets')
        .insert([{
          user_id: clientId,
          balance: 0,
          escrow_balance: 0
        }])
        .select()
        .single();

      if (createWalletError) {
        console.log("WALLET CREATE ERROR:", createWalletError);
        return res.status(500).json({ error: "Wallet creation failed" });
      }

      wallet = newWallet;
    }

    /* ===== BALANCE CHECK ===== */
    if ((wallet.balance || 0) < amount) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    /* ===== MOVE MONEY TO ESCROW ===== */
    const { error: updateError } = await supabase
      .from('wallets')
      .update({
        balance: wallet.balance - amount,
        escrow_balance: Number(wallet.escrow_balance || 0) + amount
      })
      .eq('user_id', clientId);

    if (updateError) {
      console.log("ESCROW UPDATE ERROR:", updateError);
      return res.status(500).json({ error: "Failed to lock funds" });
    }

    /* ===== CREATE ERRAND ===== */
    const { data: errand, error: errandError } = await supabase
      .from('errands')
      .insert([{
        title,
        description,
        client_id: clientId,
        price: amount,
        payout_amount,
        status: 'created',
        escrow_status: 'locked',
        escrow_locked_at: new Date()
      }])
      .select()
      .single();

    if (errandError) {
      console.log("ERRAND CREATE ERROR:", errandError);
      return res.status(500).json({ error: "Errand creation failed" });
    }

    /* ===== TRANSACTION LOG ===== */
    await supabase.from('transactions').insert([{
      user_id: clientId,
      amount,
      type: 'escrow_lock',
      status: 'completed'
    }]);

    console.log("✅ ERRAND CREATED:", errand.id);

    res.json(errand);

  } catch (err) {
    console.log("❌ CREATE ERRAND ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ================= ACCEPT ================= */
router.post('/:id/accept', async (req, res) => {
  try {
    const runnerId = req.headers['x-runner-id'];
    const { id } = req.params;

    /* ===== VALIDATION ===== */
    if (!runnerId) {
      return res.status(400).json({ error: "Missing x-runner-id" });
    }

    /* ===== FETCH ERRAND ===== */
    const { data: errand, error: fetchError } = await supabase
      .from('errands')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !errand) {
      return res.status(404).json({ error: "Errand not found" });
    }

    /* ===== STATE CHECK ===== */
    if (errand.status !== 'created') {
      return res.status(400).json({ error: "Errand already taken" });
    }

    /* ===== ACCEPT ERRAND ===== */
    const { data: updated, error: updateError } = await supabase
      .from('errands')
      .update({
        status: 'accepted',
        assigned_runner_id: runnerId,
        accepted_at: new Date()
      })
      .eq('id', id)
      .eq('status', 'created') // 🔒 race condition guard
      .select()
      .single();

    if (updateError || !updated) {
      return res.status(409).json({ error: "Failed to accept (already taken)" });
    }

    console.log("✅ ERRAND ACCEPTED:", id, "by", runnerId);

    res.json(updated);

  } catch (err) {
    console.log("❌ ACCEPT ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ================= COMPLETE ================= */
router.post('/:id/complete', async (req, res) => {
  try {
    const runnerId = req.headers['x-runner-id'];
    const { id } = req.params;

    /* ===== VALIDATION ===== */
    if (!runnerId) {
      return res.status(400).json({ error: "Missing x-runner-id" });
    }

    /* ===== FETCH ERRAND ===== */
    const { data: errand, error: fetchError } = await supabase
      .from('errands')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !errand) {
      return res.status(404).json({ error: "Errand not found" });
    }

    /* ===== OWNERSHIP CHECK ===== */
    if (errand.assigned_runner_id !== runnerId) {
      return res.status(403).json({ error: "Not your job" });
    }

    /* ===== STATE CHECK ===== */
    if (errand.status !== 'accepted') {
      return res.status(400).json({ error: "Invalid state (must be accepted)" });
    }

    /* ===== COMPLETE ERRAND ===== */
    const { data: updated, error: updateError } = await supabase
      .from('errands')
      .update({
        status: 'completed',
        escrow_status: 'awaiting_confirmation',
        completed_at: new Date()
      })
      .eq('id', id)
      .eq('assigned_runner_id', runnerId)
      .eq('status', 'accepted') // 🔒 race guard
      .select()
      .single();

    if (updateError || !updated) {
      return res.status(409).json({ error: "Failed to complete (state changed)" });
    }

    console.log("✅ ERRAND COMPLETED:", id, "by", runnerId);

    res.json(updated);

  } catch (err) {
    console.log("❌ COMPLETE ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ================= CONFIRM (ESCROW RELEASE) ================= */
/* ================= CONFIRM (ESCROW RELEASE) ================= */
// Fixed: removed requireAuth middleware, reads identity from headers
// consistent with every other route in this file.
router.post('/:id/confirm', async (req, res) => {
  try {
    const clientId = req.headers['x-user-id'];
    const { id }   = req.params;

    // ── Validation ─────────────────────────────────────────────────────────
    if (!clientId) {
      return res.status(400).json({ error: 'Missing x-user-id header' });
    }

    // ── Fetch errand ───────────────────────────────────────────────────────
    const { data: errand, error: fetchError } = await supabase
      .from('errands')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !errand) {
      return res.status(404).json({ error: 'Errand not found' });
    }

    // ── Ownership check ────────────────────────────────────────────────────
    if (errand.client_id !== clientId) {
      return res.status(403).json({ error: 'Unauthorized: not your errand' });
    }

    // ── State check ────────────────────────────────────────────────────────
    // Original code checked for 'accepted' but complete route sets 'completed'
    // + escrow_status 'awaiting_confirmation'. Correct gate is 'completed'.
    if (errand.status !== 'completed' || errand.escrow_status !== 'awaiting_confirmation') {
      return res.status(400).json({
        error: `Cannot confirm: status=${errand.status}, escrow=${errand.escrow_status}`,
      });
    }

    // ── Confirm errand ─────────────────────────────────────────────────────
    const { data: updated, error: updateError } = await supabase
      .from('errands')
      .update({
        status:        'confirmed',
        escrow_status: 'released',
        confirmed_at:  new Date(),
      })
      .eq('id', id)
      .eq('status', 'completed')          // race-condition guard (same pattern as accept)
      .eq('client_id', clientId)          // double-lock: only owner can confirm
      .select()
      .single();

    if (updateError || !updated) {
      return res.status(409).json({ error: 'Confirm failed (state may have changed)' });
    }

    // ── Release escrow from client wallet ──────────────────────────────────
    const amount = errand.budget ?? errand.price;

    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('escrow_balance')
      .eq('user_id', clientId)
      .single();

    if (!walletError && wallet) {
      await supabase
        .from('wallets')
        .update({
          escrow_balance: Math.max(0, Number(wallet.escrow_balance || 0) - amount),
        })
        .eq('user_id', clientId);
    }

    // ── Credit runner wallet ───────────────────────────────────────────────
    const runnerId = errand.assigned_runner_id;

    if (runnerId) {
      // Get or create runner wallet
      let { data: runnerWallet } = await supabase
        .from('wallets')
        .select('available_balance, balance')
        .eq('user_id', runnerId)
        .single();

      if (!runnerWallet) {
        const { data: newWallet } = await supabase
          .from('wallets')
          .insert([{ user_id: runnerId, balance: 0, available_balance: 0 }])
          .select()
          .single();
        runnerWallet = newWallet;
      }

      const payout = errand.payout_amount ?? Math.floor(amount * 0.8);

      await supabase
        .from('wallets')
        .update({
          available_balance: Number(runnerWallet.available_balance || 0) + payout,
          balance:           Number(runnerWallet.balance || 0) + payout,
        })
        .eq('user_id', runnerId);
    }

    // ── Transaction log ────────────────────────────────────────────────────
    await supabase.from('transactions').insert([{
      type:      'release',
      amount,
      status:    'completed',
      errand_id: id,
      client_id: clientId,
      runner_id: runnerId ?? null,
    }]);

    console.log('✅ ERRAND CONFIRMED:', id, 'by client', clientId);

    return res.json(updated);

  } catch (err) {
    console.log('❌ CONFIRM ERROR:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});


/* ================= WITHDRAW ================= */
router.post('/paystack/withdraw', async (req, res) => {
  const user_id = req.headers['x-runner-id'];
  const { amount, recipient_code } = req.body;

  const { data: wallet } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', user_id)
    .single();

  if (wallet.available_balance < amount) {
    return res.status(400).json({ error: 'Insufficient balance' });
  }

  try {
    const response = await axios.post(
      'https://api.paystack.co/transfer',
      {
        source: 'balance',
        amount: amount * 100,
        recipient: recipient_code
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        }
      }
    );

    await supabase
  .from('wallets')
  .update({
    available_balance: wallet.available_balance - amount
  })
  .eq('user_id', user_id);

    await supabase.from('transactions').insert([{
      user_id,
      amount,
      type: 'withdraw',
      status: 'pending',
      reference: response.data.data.reference
    }]);

    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: 'Withdraw failed' });
  }
});


/* ================= GET ALL ERRANDS ================= */
router.get('/', async (req, res) => {
  try {
    const user_id = req.headers['x-user-id'];
    const role = req.headers['x-role']; // 'client' | 'runner'

    if (!user_id || !role) {
      return res.status(400).json({ error: 'Missing headers: x-user-id, x-role' });
    }

    let query = supabase.from('errands').select('*');

    if (role === 'client') {
      // Client sees ONLY their errands
      query = query.eq('client_id', user_id);
    }

    if (role === 'runner') {
      // Runner sees:
      // - unassigned errands
      // - errands assigned to them
      query = query.or(
        `assigned_runner_id.is.null,assigned_runner_id.eq.${user_id}`
      );
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.log('ERRANDS FETCH ERROR:', error);
      return res.status(500).json({ error: 'Failed to fetch errands' });
    }

    res.json(data || []);
  } catch (err) {
    console.log('SERVER ERROR:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ================= PAYSTACK INITIALIZE ================= */
router.post('/paystack/initialize', async (req, res) => {
  try {
    const { email, amount, user_id } = req.body;

    console.log("INIT BODY:", req.body);

    if (!email || !amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid input" });
    }

    let response;
    try {
      response = await axios.post(
        'https://api.paystack.co/transaction/initialize',
        {
          email,
          amount: amount * 100,
          metadata: { user_id }
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (err) {
      console.log("PAYSTACK INIT ERROR:", err.response?.data || err.message);
      return res.status(500).json({ error: "Payment init failed" });
    }

    // ✅ YOU FORGOT THIS
    res.json(response.data);

  } catch (err) {
    console.log("INIT SERVER ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ================= VERIFY PAYMENT ================= */
router.get('/paystack/verify/:reference', async (req, res) => {
  try {
    const { reference } = req.params;

    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        }
      }
    );

    const data = response.data.data;

    if (data.status !== 'success') {
      return res.status(400).json({ error: "Payment not successful" });
    }

    const { data: tx } = await supabase
      .from('transactions')
      .select('*')
      .eq('reference', reference)
      .single();

    if (!tx) return res.status(404).json({ error: "Transaction not found" });

    if (tx.status === 'completed') {
      return res.json({ message: "Already processed" });
    }

    const { data: wallet } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', tx.user_id)
      .single();

    res.json({ message: "Payment verified" });

    await supabase
      .from('transactions')
      .update({ status: 'completed' })
      .eq('reference', reference);

    res.json({ message: "Wallet funded" });

  } catch (err) {
    res.status(500).json({ error: "Verification failed" });
  }
});

router.post('/paystack/create-recipient', async (req, res) => {
  const { account_number, bank_code, name } = req.body;

  try {
    const response = await axios.post(
      'https://api.paystack.co/transferrecipient',
      {
        type: 'nuban',
        name,
        account_number,
        bank_code,
        currency: 'NGN'
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        }
      }
    );

    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: 'Recipient failed' });
  }
});

router.get('/transactions/:userId', async (req, res) => {
  const { userId } = req.params;

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) return res.status(400).json({ error });

  res.json(data);
});

router.get('/analytics/:userId', async (req, res) => {
  const { userId } = req.params;

  const { data } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId);

  const totalDeposits = data
    .filter(t => t.type === 'deposit' && t.status === 'completed')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalWithdrawals = data
    .filter(t => t.type === 'withdraw')
    .reduce((sum, t) => sum + t.amount, 0);

  res.json({
    totalDeposits,
    totalWithdrawals
  });
});

router.post('/:id/dispute', async (req, res) => {
  const { id } = req.params;

  await supabase
    .from('errands')
    .update({
      escrow_status: 'under_review'
    })
    .eq('id', id);

  res.json({ message: "Dispute opened" });
});

router.get('/wallet', async (req, res) => {
  try {
    const user_id = req.headers['x-user-id'];

    if (!user_id) {
      return res.status(400).json({ error: 'Missing user_id' });
    }

    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', user_id)
      .single();

    if (error) {
      console.log("SUPABASE ERROR:", error);
      return res.status(500).json({ error });
    }

    if (!data) {
      return res.json({
        balance: 0,
        available_balance: 0
      });
    }

    res.json(data);

  } catch (e) {
    console.log("WALLET ROUTE ERROR:", e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/withdraw', async (req, res) => {
  const userId = req.headers['x-user-id'];
  const { amount, pin } = req.body;

  const user = await db.user.find(userId);

  // ─── 1. COOLDOWN CHECK ─────────────────────────
  if (user.cooldown_until && new Date() < user.cooldown_until) {
    return res.status(403).json({
      message: 'Account temporarily locked. Try again later.',
    });
  }

  // ─── 2. PIN VALIDATION ─────────────────────────
  const validPin = compareHash(pin, user.pin_hash);

  if (!validPin) {
    const attempts = user.pin_attempts + 1;

    // lock user
    if (attempts >= LIMITS.MAX_ATTEMPTS) {
      await db.user.update(userId, {
        pin_attempts: 0,
        cooldown_until: new Date(Date.now() + LIMITS.COOLDOWN_MINUTES * 60000),
      });

      return res.status(403).json({
        message: 'Too many attempts. Account locked for 15 minutes.',
      });
    }

    await db.user.update(userId, {
      pin_attempts: attempts,
    });

    return res.status(401).json({ message: 'Invalid PIN' });
  }

  // reset attempts
  await db.user.update(userId, {
    pin_attempts: 0,
    cooldown_until: null,
  });

  // ─── 3. KYC CHECK ─────────────────────────────
  if (!user.kyc_verified) {
    return res.status(403).json({ message: 'Complete KYC first' });
  }

  // ─── 4. LIMIT CHECK ───────────────────────────
  if (amount > LIMITS.MAX_PER_TRANSACTION) {
    return res.status(400).json({
      message: 'Exceeds per transaction limit',
    });
  }

  if (user.daily_withdrawn + amount > LIMITS.DAILY_LIMIT) {
    return res.status(400).json({
      message: 'Daily withdrawal limit exceeded',
    });
  }

  // ─── 5. FRAUD DETECTION ───────────────────────
  const lastWithdraw = user.last_withdraw_at;

  if (lastWithdraw && Date.now() - new Date(lastWithdraw).getTime() < 10000) {
    return res.status(429).json({
      message: 'Too many rapid withdrawals',
    });
  }

  // ─── 6. DEFAULT BANK ─────────────────────────
  const bank = await db.banks.findDefault(userId);

  if (!bank) {
    return res.status(400).json({ message: 'No default bank account' });
  }

  // ─── 7. BALANCE CHECK ─────────────────────────
  if (user.balance < amount) {
    return res.status(400).json({ message: 'Insufficient balance' });
  }

  // ─── 8. PROCESS TRANSFER ─────────────────────
  const transfer = await paystack.transfer({
    amount,
    recipient: bank.recipient_code,
  });

  // ─── 9. UPDATE USER STATE ────────────────────
  await db.user.update(userId, {
    balance: user.balance - amount,
    daily_withdrawn: user.daily_withdrawn + amount,
    last_withdraw_at: new Date(),
  });

  // ─── 10. LOG TRANSACTION ─────────────────────
  await db.transactions.insert({
    user_id: userId,
    type: 'withdrawal',
    amount,
    status: 'pending',
  });

  const deviceId = req.headers['x-device-id'];

const device = await db.devices.find(userId, deviceId);

let requireOTP = false;

// 🚨 New device
if (!device) {
  requireOTP = true;
}

// 🚨 Large amount
if (amount > 50000) {
  requireOTP = true;
}

  return res.json({
    success: true,
    message: 'Withdrawal processing',
  });
});

router.post('/verify-otp', async (req, res) => {
  const userId = req.headers['x-user-id'];
  const { code } = req.body;

  const otp = await db.otp.findLatest(userId);

  if (!otp || otp.used || otp.code !== code) {
    return res.status(400).json({ message: 'Invalid OTP' });
  }

  if (new Date() > otp.expires_at) {
    return res.status(400).json({ message: 'OTP expired' });
  }

  await db.otp.update(otp.id, { used: true });

  return res.json({ success: true });
});

export default router;