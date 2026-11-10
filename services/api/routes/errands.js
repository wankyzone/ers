import express from 'express';
import supabase from '../supabase.js';
import axios from 'axios';
import crypto from 'crypto';
import { authenticate, authorize } from '../modules/protect/index.js';
import { getRunnerErrandVisibilityFilter } from '../utils/errandVisibility.js';

const router = express.Router();

/* ================= CREATE ERRAND ================= */
router.post('/', authenticate, authorize('client'), async (req, res) => {
  try {
    const clientId = req.user.id;
    const { title, description, price } = req.body;

    /* ===== VALIDATION ===== */

    if (!title || price === undefined || price === null) {
      return res.status(400).json({ error: 'Invalid input' });
    }

    const amount = Number(price);

    if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) {
      return res.status(400).json({ error: 'Invalid input' });
    }

    /* ===== IDEMPOTENCY ===== */

    const idempotencyKey = req.get('Idempotency-Key');

    if (!idempotencyKey || !idempotencyKey.trim()) {
      return res.status(400).json({
        error: 'Idempotency-Key header is required'
      });
    }

    /* ===== ATOMIC ERRAND CREATION ===== */

    const { data: errand, error } = await supabase.rpc(
      'create_errand_atomic',
      {
        p_client_id: clientId,
        p_title: title,
        p_description: description ?? null,
        p_price: amount,
        p_idempotency_key: idempotencyKey.trim()
      }
    );

    if (error) {
      console.log('ATOMIC ERRAND ERROR:', error);

      if (error.message?.includes('Insufficient balance')) {
        return res.status(400).json({
          error: 'Insufficient balance'
        });
      }

      if (error.message?.includes('Idempotency key already used')) {
        return res.status(409).json({
          error: 'Idempotency key already used with different request data'
        });
      }

      if (error.message?.includes('required') ||
          error.message?.includes('Invalid price')) {
        return res.status(400).json({
          error: error.message
        });
      }

      return res.status(500).json({
        error: 'Failed to create errand'
      });
    }

    if (!errand) {
      return res.status(500).json({
        error: 'Errand creation returned no data'
      });
    }

    console.log('✅ ERRAND CREATED ATOMICALLY:', errand.id);

    return res.json(errand);

  } catch (err) {
    console.log('❌ CREATE ERRAND ERROR:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/* ================= ACCEPT ================= */
router.post('/:id/accept', authenticate, authorize('runner'), async (req, res) => {
  try {
    const runnerId = req.user.id;
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Errand ID is required' });
    }

    const { data, error } = await supabase.rpc('accept_errand_atomic', {
      p_runner_id: runnerId,
      p_errand_id: id,
    });

    if (error) {
      console.log('❌ ACCEPT ERROR:', error);

      const message = error.message || 'Failed to accept errand';

      if (
        message.includes('not found') ||
        message.includes('no longer available')
      ) {
        return res.status(404).json({ error: message });
      }

      if (
        message.includes('already has an active errand') ||
        message.includes('already available') ||
        message.includes('unavailable') ||
        message.includes('not verified')
      ) {
        return res.status(409).json({ error: message });
      }

      if (
        message.includes('Only runner accounts') ||
        message.includes('Runner profile')
      ) {
        return res.status(403).json({ error: message });
      }

      return res.status(500).json({ error: 'Failed to accept errand' });
    }

    if (!data) {
      return res.status(409).json({
        error: 'Failed to accept errand',
      });
    }

    console.log('✅ ERRAND ACCEPTED:', id, 'by', runnerId);

    return res.json(data);
  } catch (err) {
    console.log('❌ ACCEPT ERROR:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/* ================= COMPLETE ================= */
router.post('/:id/complete', authenticate, authorize('runner'), async (req, res) => {
  try {
    const runnerId = req.user.id;
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Errand ID is required' });
    }

    const { data, error } = await supabase.rpc('complete_errand_atomic', {
      p_runner_id: runnerId,
      p_errand_id: id,
    });

    if (error) {
      console.log('❌ COMPLETE ERROR:', error);

      const message = error.message || 'Failed to complete errand';

      if (message.includes('not found')) {
        return res.status(404).json({ error: message });
      }

      if (message.includes('not assigned')) {
        return res.status(403).json({ error: message });
      }

      if (
        message.includes('current state') ||
        message.includes('escrow is not in the expected state') ||
        message.includes('completion failed')
      ) {
        return res.status(409).json({ error: message });
      }

      return res.status(500).json({ error: 'Failed to complete errand' });
    }

    if (!data) {
      return res.status(409).json({
        error: 'Failed to complete errand',
      });
    }

    console.log('✅ ERRAND COMPLETED ATOMICALLY:', id, 'by', runnerId);

    return res.json(data);
  } catch (err) {
    console.log('❌ COMPLETE ERROR:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/* ================= CONFIRM (ESCROW RELEASE) ================= */
router.post('/:id/confirm', authenticate, authorize('client'), async (req, res) => {
  try {
    const clientId = req.user.id;
    const { id: errandId } = req.params;

    const { data, error } = await supabase.rpc('release_escrow_atomic', {
      p_client_id: clientId,
      p_errand_id: errandId,
    });

    if (error) {
      console.error('ATOMIC ESCROW RELEASE ERROR:', error);

      if (error.message?.includes('not found')) {
        return res.status(404).json({ error: 'Errand not found' });
      }

      if (error.message?.includes('Unauthorized')) {
        return res.status(403).json({
          error: 'Unauthorized: not your errand'
        });
      }

      if (
        error.message?.includes('Cannot release escrow') ||
        error.message?.includes('assigned runner') ||
        error.message?.includes('Insufficient escrow') ||
        error.message?.includes('Invalid escrow') ||
        error.message?.includes('Invalid runner payout')
      ) {
        return res.status(400).json({ error: error.message });
      }

      return res.status(500).json({
        error: 'Failed to release escrow'
      });
    }

    if (!data) {
      return res.status(500).json({
        error: 'Escrow release returned no data'
      });
    }

    console.log(
      '✅ ESCROW RELEASED ATOMICALLY:',
      errandId,
      'by client',
      clientId
    );

    return res.json(data);
  } catch (err) {
    console.error('ATOMIC ESCROW RELEASE SERVER ERROR:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});


/* ================= WITHDRAW ================= */
router.post('/paystack/withdraw', authenticate, authorize('runner'), (_req, res) => {
  return res.status(501).json({
    success: false,
    code: 'WITHDRAWALS_NOT_AVAILABLE',
    message: 'Withdrawals are temporarily unavailable while payout security is being completed.',
  });
});


/* ================= GET ALL ERRANDS ================= */
router.get('/', authenticate, async (req, res) => {
  try {
    const user_id = req.user.id;
    const role = req.user.role;

    if (!role) {
      return res.status(403).json({ error: 'User role is unavailable' });
    }

    let query = supabase.from('errands').select('*');

    if (role === 'client') {
      // Client sees ONLY their errands
      query = query.eq('client_id', user_id);
    }

    if (role === 'runner') {
      // Runner marketplace visibility:
      // - unassigned errands in the 'created' state
      // - their own active errands in the 'accepted' state
      // - historical/completed/confirmed errands are excluded
      query = query.or(
        getRunnerErrandVisibilityFilter(user_id)
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

/* Paystack wallet funding is handled by routes/paystack.js. */

router.post('/paystack/create-recipient', authenticate, authorize('runner'), (_req, res) => {
  return res.status(501).json({
    success: false,
    code: 'PAYOUT_SETUP_NOT_AVAILABLE',
    message: 'Bank payout setup is temporarily unavailable while payout security is being completed.',
  });
});

router.get('/transactions/:userId', authenticate, async (req, res) => {
  const { userId } = req.params;

  if (userId !== req.user.id) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) return res.status(400).json({ error });

  res.json(data);
});

router.get('/analytics/:userId', authenticate, async (req, res) => {
  const { userId } = req.params;

  if (userId !== req.user.id) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

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

router.post('/:id/dispute', authenticate, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const { data: errand, error: fetchError } = await supabase
    .from('errands')
    .select('id, client_id, assigned_runner_id, escrow_status')
    .eq('id', id)
    .single();

  if (fetchError || !errand) {
    return res.status(404).json({ error: 'Errand not found' });
  }

  const isClient = errand.client_id === userId;
  const isAssignedRunner = errand.assigned_runner_id === userId;

  if (!isClient && !isAssignedRunner) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  if (errand.escrow_status === 'released') {
    return res.status(400).json({ error: 'Cannot dispute a released errand' });
  }

  const { data: updatedErrand, error: updateError } = await supabase
    .from('errands')
    .update({ escrow_status: 'under_review' })
    .eq('id', id)
    // Optimistic state check prevents a stale dispute request from
    // overwriting a concurrent successful escrow release.
    .eq('escrow_status', errand.escrow_status)
    .neq('escrow_status', 'released')
    .select('id')
    .maybeSingle();

  if (updateError) {
    console.error('DISPUTE UPDATE ERROR:', updateError);
    return res.status(500).json({ error: 'Failed to open dispute' });
  }

  if (!updatedErrand) {
    return res.status(409).json({
      error: 'Errand escrow state changed. Refresh before opening a dispute.',
    });
  }

  return res.json({ message: 'Dispute opened' });
});

router.get('/wallet', authenticate, async (req, res) => {
  try {
    const user_id = req.user.id;

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

router.post('/withdraw', authenticate, authorize('runner'), (_req, res) => {
  return res.status(501).json({
    success: false,
    code: 'WITHDRAWALS_NOT_AVAILABLE',
    message: 'Withdrawals are temporarily unavailable while payout security is being completed.',
  });
});

router.post('/verify-otp', authenticate, authorize('runner'), (_req, res) => {
  return res.status(501).json({
    success: false,
    code: 'OTP_VERIFICATION_NOT_AVAILABLE',
    message: 'Withdrawal OTP verification is not available yet.',
  });
});

export default router;