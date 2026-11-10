import express from 'express';
import { authenticate } from '../modules/protect/index.js';
import supabase from '../supabase.js';

const router = express.Router();

// Never expose a shared transaction feed. Scope every read to the
// authenticated account; privileged admin reporting uses separate routes.
router.get('/', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, amount, type, status, reference, created_at, errand_id')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Transaction history lookup failed:', error);
      return res.status(500).json({ success: false, message: 'Unable to load transaction history' });
    }

    return res.json(data ?? []);
  } catch (error) {
    console.error('Transaction history error:', error);
    return res.status(500).json({ success: false, message: 'Unable to load transaction history' });
  }
});

export default router;
