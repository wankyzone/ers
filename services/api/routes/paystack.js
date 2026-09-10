import express from 'express';
import axios from 'axios';
import crypto from 'crypto';
import supabase from '../supabase.js';
import { authenticate } from '../modules/protect/authenticate.js';

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

router.post('/initialize', authenticate, async (req, res) => {
  const { amount } = req.body;

  if (!PAYSTACK_SECRET) {
    return res.status(500).json({
      success: false,
      message: 'Paystack is not configured',
    });
  }

  const numericAmount = Number(amount);

  if (
    !Number.isFinite(numericAmount) ||
    numericAmount <= 0 ||
    Math.round(numericAmount * 100) !== numericAmount * 100
  ) {
    return res.status(400).json({
      success: false,
      message: 'Invalid payment amount',
    });
  }

  const userId = req.user.id;
  const email = req.user.email;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Authenticated user email is required',
    });
  }

  /*
   * Generate the reference on the server.
   *
   * The client must never choose the Paystack reference because the
   * reference becomes the ownership key for the payment transaction.
   */
  const reference = `ERS-${crypto.randomUUID()}`;

  try {
    /*
     * 1. Create the pending ledger entry BEFORE initializing Paystack.
     */
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        amount: numericAmount,
        type: 'deposit',
        status: 'pending',
        reference,
        payment_provider: 'paystack',
        idempotency_key: `paystack:${reference}`,
      })
      .select('*')
      .single();

    if (transactionError || !transaction) {
      console.error(
        'Paystack transaction creation error:',
        transactionError
      );

      return res.status(500).json({
        success: false,
        message: 'Unable to create payment transaction',
      });
    }

    /*
     * 2. Initialize the exact transaction with Paystack.
     */
    try {
      const response = await axios.post(
        'https://api.paystack.co/transaction/initialize',
        {
          email,
          amount: Math.round(numericAmount * 100),
          reference,
          metadata: {
            transaction_id: transaction.id,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return res.json(response.data);
    } catch (paystackError) {
      console.error(
        'Paystack initialize error:',
        paystackError.response?.data || paystackError.message
      );

      /*
       * Paystack initialization failed.
       * The wallet has NOT been touched.
       * Mark the pending payment as failed so it cannot later be
       * accidentally completed.
       */
      await supabase
        .from('transactions')
        .update({ status: 'failed' })
        .eq('id', transaction.id)
        .eq('status', 'pending');

      return res.status(500).json({
        success: false,
        message: 'Payment initialization failed',
      });
    }
  } catch (error) {
    console.error('Paystack initialization server error:', error);

    return res.status(500).json({
      success: false,
      message: 'Payment initialization failed',
    });
  }
});

/* ─────────────────────────────
   VERIFY PAYMENT
───────────────────────────── */
router.get('/verify/:reference', authenticate, async (req, res) => {
  const reference = String(req.params.reference || '').trim();

  if (!reference) {
    return res.status(400).json({
      success: false,
      message: 'Payment reference is required',
    });
  }

  if (!PAYSTACK_SECRET) {
    console.error('PAYSTACK_SECRET_KEY is not configured');

    return res.status(500).json({
      success: false,
      message: 'Payment verification is unavailable',
    });
  }

  try {
    /*
     * 1. Find the payment transaction belonging to the authenticated user.
     *
     * The database ledger is the source of truth for ownership.
     */
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .select('*')
      .eq('reference', reference)
      .eq('user_id', req.user.id)
      .eq('payment_provider', 'paystack')
      .eq('type', 'deposit')
      .single();

    if (transactionError) {
      console.error('Paystack transaction lookup error:', transactionError);

      return res.status(500).json({
        success: false,
        message: 'Unable to retrieve payment transaction',
      });
    }

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Payment transaction not found',
      });
    }

    /*
     * 2. Verify the reference directly with Paystack.
     */
    let response;

    try {
      response = await axios.get(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET}`,
          },
        }
      );
    } catch (paystackError) {
      console.error(
        'Paystack verification error:',
        paystackError.response?.data || paystackError.message
      );

      return res.status(502).json({
        success: false,
        message: 'Unable to verify payment with Paystack',
      });
    }

    const payment = response.data?.data;

    /*
     * 3. Validate Paystack's response.
     */
    if (!payment || payment.status !== 'success') {
      return res.status(400).json({
        success: false,
        message: 'Payment has not been completed',
        status: payment?.status ?? null,
      });
    }

    if (payment.reference !== reference) {
      console.error('Paystack reference mismatch', {
        requested: reference,
        received: payment.reference,
      });

      return res.status(400).json({
        success: false,
        message: 'Payment reference mismatch',
      });
    }

    /*
     * 4. Validate the amount against our own pending ledger entry.
     *
     * Paystack returns the amount in kobo.
     * ERS stores the transaction amount in naira.
     */
    const providerAmount = Number(payment.amount);
    const expectedAmount = Math.round(Number(transaction.amount) * 100);

    if (
      !Number.isFinite(providerAmount) ||
      !Number.isFinite(expectedAmount) ||
      providerAmount !== expectedAmount
    ) {
      console.error('Paystack verification amount mismatch', {
        reference,
        expectedAmount,
        providerAmount,
      });

      return res.status(400).json({
        success: false,
        message: 'Payment amount mismatch',
      });
    }

    /*
     * 5. Atomically credit the wallet.
     *
     * This is the SAME financial mutation used by the webhook.
     * The RPC validates ownership/reference/amount and is idempotent.
     */
    const { data: completedTransaction, error: creditError } =
      await supabase.rpc('credit_paystack_wallet_atomic', {
        p_user_id: transaction.user_id,
        p_reference: reference,
        p_amount: Number(transaction.amount),
      });

    if (creditError || !completedTransaction) {
      console.error(
        'Paystack wallet credit error:',
        creditError
      );

      return res.status(500).json({
        success: false,
        message: 'Unable to complete payment',
      });
    }

    return res.json({
      success: true,
      message: 'Payment verified and processed',
      data: completedTransaction,
    });
  } catch (error) {
    console.error('Paystack verification server error:', error);

    return res.status(500).json({
      success: false,
      message: 'Payment verification failed',
    });
  }
});

/* ─────────────────────────────
   WEBHOOK (🔥 CRITICAL)
───────────────────────────── */
router.post('/webhook', async (req, res) => {
  console.log('Paystack webhook received');

  try {
    /* ============================================================
       1. VERIFY PAYSTACK SIGNATURE
    ============================================================ */

    const signature = req.headers['x-paystack-signature'];

    if (!signature || !PAYSTACK_SECRET) {
      return res.status(401).json({
        success: false,
        message: 'Invalid signature',
      });
    }

    const payload = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(JSON.stringify(req.body));

    const hash = crypto
      .createHmac('sha512', PAYSTACK_SECRET)
      .update(payload)
      .digest('hex');

    const expected = Buffer.from(hash, 'utf8');
    const received = Buffer.from(String(signature), 'utf8');

    if (
      expected.length !== received.length ||
      !crypto.timingSafeEqual(expected, received)
    ) {
      console.error('Invalid Paystack signature');

      return res.status(401).json({
        success: false,
        message: 'Invalid signature',
      });
    }

    /* ============================================================
       2. PARSE EVENT
    ============================================================ */

    const event = Buffer.isBuffer(req.body)
      ? JSON.parse(req.body.toString('utf8'))
      : req.body;

    console.log('Paystack event:', event.event);

    /* ============================================================
       3. PAYMENT SUCCESS
    ============================================================ */

    if (event.event === 'charge.success') {
      const reference = event.data?.reference;
      const providerAmount = Number(event.data?.amount);

      if (!reference || !Number.isFinite(providerAmount)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid payment payload',
        });
      }

      /*
       * The ledger is the source of truth for ownership and expected
       * amount. Never trust metadata.user_id for wallet crediting.
       */
      const { data: transaction, error: transactionError } = await supabase
        .from('transactions')
        .select('*')
        .eq('reference', reference)
        .eq('payment_provider', 'paystack')
        .eq('type', 'deposit')
        .single();

      if (transactionError) {
        console.error('Paystack transaction lookup error:', transactionError);

        return res.status(500).json({
          success: false,
          message: 'Unable to retrieve payment transaction',
        });
      }

      if (!transaction) {
        return res.status(404).json({
          success: false,
          message: 'Payment transaction not found',
        });
      }

      const expectedAmount = Math.round(Number(transaction.amount) * 100);

      if (
        !Number.isFinite(expectedAmount) ||
        providerAmount !== expectedAmount
      ) {
        console.error('Paystack amount mismatch', {
          reference,
          expectedAmount,
          providerAmount,
        });

        return res.status(400).json({
          success: false,
          message: 'Payment amount mismatch',
        });
      }

      /*
       * Atomic wallet credit.
       *
       * The RPC locks the wallet + transaction, validates ownership,
       * validates amount/provider/type, credits the wallet exactly once,
       * and marks the ledger transaction completed.
       */
      const { data: completedTransaction, error: creditError } =
        await supabase.rpc('credit_paystack_wallet_atomic', {
          p_user_id: transaction.user_id,
          p_reference: reference,
          p_amount: Number(transaction.amount),
        });

      if (creditError || !completedTransaction) {
        console.error(
          'Paystack wallet credit error:',
          creditError
        );

        return res.status(500).json({
          success: false,
          message: 'Unable to complete payment',
        });
      }

      return res.json({
        success: true,
        message: 'Payment processed',
        data: completedTransaction,
      });
    }

    /* ============================================================
       4. TRANSFER SUCCESS
    ============================================================ */

    if (event.event === 'transfer.success') {
      await supabase
        .from('transactions')
        .update({ status: 'completed' })
        .eq('reference', event.data?.reference);

      return res.json({
        success: true,
        message: 'Transfer processed',
      });
    }

    /* ============================================================
       5. TRANSFER FAILED
    ============================================================ */

    if (event.event === 'transfer.failed') {
      const reference = event.data?.reference;

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

        if (wallet) {
          await supabase
            .from('wallets')
            .update({
              available_balance:
                Number(wallet.available_balance || 0) + Number(tx.amount || 0),
            })
            .eq('user_id', tx.user_id);
        }

        await supabase
          .from('transactions')
          .update({ status: 'failed' })
          .eq('id', tx.id);
      }

      return res.json({
        success: true,
        message: 'Transfer failure processed',
      });
    }

    /* ============================================================
       6. ACKNOWLEDGE OTHER PAYSTACK EVENTS
    ============================================================ */

    return res.json({
      success: true,
      message: 'Event acknowledged',
    });
  } catch (error) {
    console.error('Paystack webhook error:', error);

    return res.status(500).json({
      success: false,
      message: 'Webhook processing failed',
    });
  }
});

export default router;
