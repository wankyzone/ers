import express from 'express';
import axios from 'axios';
import crypto from 'crypto';
import supabase from '../supabase.js';

const router = express.Router();

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

router.get('/banks', async (_req, res) => {
  return res.json([]);
});

/* ─────────────────────────────
   RESOLVE ACCOUNT
───────────────────────────── */
router.post('/resolve-account', async (req, res) => {
  const { account_number, bank_code } = req.body;

  if (!account_number || !bank_code) {
    return res.status(400).json({ message: 'Missing fields' });
  }

  try {
    const response = await axios.get(
      `https://api.paystack.co/bank/resolve`,
      {
        params: { account_number, bank_code },
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
        },
      }
    );

    return res.json(response.data);
  } catch (err) {
    console.error('Resolve Error:', err.response?.data || err.message);

    return res.status(500).json({
      message: 'Failed to resolve account',
    });
  }
});

router.post('/resolve', async (req, res) => {
  req.url = '/resolve-account';
  return router.handle(req, res);
});

router.post('/recipient', async (req, res) => {
  return res.json({
    success: true,
    message: 'Placeholder recipient created',
    recipient_code: 'placeholder-recipient',
    data: {
      recipient_code: 'placeholder-recipient',
      ...req.body,
    },
  });
});

router.post('/initialize', async (req, res) => {
  const { email, amount, user_id } = req.body;

  if (!email || !amount || Number(amount) <= 0) {
    return res.status(400).json({ message: 'Invalid input' });
  }

  try {
    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email,
        amount: Number(amount) * 100,
        metadata: { user_id },
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return res.json(response.data);
  } catch (err) {
    console.error('Paystack initialize error:', err.response?.data || err.message);
    return res.status(500).json({ message: 'Payment init failed' });
  }
});

/* ─────────────────────────────
   WEBHOOK (🔥 CRITICAL)
───────────────────────────── */
router.post('/webhook', async (req, res) => {
  console.log('🔥 PAYSTACK WEBHOOK HIT');

  try {
    /* ===== VERIFY SIGNATURE ===== */
    const hash = crypto
      .createHmac('sha512', PAYSTACK_SECRET)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      console.log('❌ Invalid signature');
      return res.status(401).json({
        success: false,
        message: 'Invalid signature',
      });
    }

    const event = req.body;

    console.log('EVENT:', event.event);

    /* ============================
       PAYMENT SUCCESS
    ============================ */
    if (event.event === 'charge.success') {
      const reference = event.data.reference;
      const amount = Number(event.data.amount) / 100;
      const user_id = event.data.metadata?.user_id;

      console.log('💰 PAYMENT:', amount, user_id);

      if (!user_id) return res.json({ success: true });

      // get wallet
      let { data: wallet } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user_id)
        .single();

      if (!wallet) {
        const { data: newWallet } = await supabase
          .from('wallets')
          .insert([{ user_id, balance: 0, available_balance: 0 }])
          .select()
          .single();

        wallet = newWallet;
      }

      // update wallet
      await supabase
        .from('wallets')
        .update({
          balance: Number(wallet.balance || 0) + amount,
          available_balance: Number(wallet.available_balance || 0) + amount,
        })
        .eq('user_id', user_id);

      // save transaction
      await supabase.from('transactions').insert([
        {
          user_id,
          amount,
          type: 'deposit',
          status: 'completed',
          reference,
        },
      ]);
    }

    /* ============================
       TRANSFER SUCCESS
    ============================ */
    if (event.event === 'transfer.success') {
      await supabase
        .from('transactions')
        .update({ status: 'completed' })
        .eq('reference', event.data.reference);
    }

    /* ============================
       TRANSFER FAILED
    ============================ */
    if (event.event === 'transfer.failed') {
      const reference = event.data.reference;

      const { data: tx } = await supabase
        .from('transactions')
        .select('*')
        .eq('reference', reference)
        .single();

      if (tx) {
        const { data: wallet } = await supabase
          .from('wallets')
          .select('*')
          .eq('user_id', tx.user_id)
          .single();

        await supabase
          .from('wallets')
          .update({
            available_balance:
              Number(wallet.available_balance || 0) + Number(tx.amount),
          })
          .eq('user_id', tx.user_id);
      }
    }

    return res.json({ success: true });
  } catch (err) {
    console.log('❌ WEBHOOK ERROR:', err);
    return res.status(500).json({
      success: false,
      message: 'Webhook failed',
    });
  }
});

export default router;
