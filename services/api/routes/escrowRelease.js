import express from 'express';
import supabase from '../supabase.js';
import { authenticate, authorize } from '../modules/protect/index.js';

const router = express.Router();

/* ================= ATOMIC ESCROW RELEASE ================= */
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
        return res.status(403).json({ error: 'Unauthorized: not your errand' });
      }

      if (error.message?.includes('Cannot release escrow') ||
          error.message?.includes('assigned runner') ||
          error.message?.includes('Insufficient escrow') ||
          error.message?.includes('Invalid escrow') ||
          error.message?.includes('Invalid runner payout')) {
        return res.status(400).json({ error: error.message });
      }

      return res.status(500).json({ error: 'Failed to release escrow' });
    }

    if (!data) {
      return res.status(500).json({ error: 'Escrow release returned no data' });
    }

    console.log('✅ ESCROW RELEASED ATOMICALLY:', errandId, 'by client', clientId);
    return res.json(data);
  } catch (err) {
    console.error('ATOMIC ESCROW RELEASE SERVER ERROR:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
