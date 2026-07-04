import express from 'express';
import bcrypt from 'bcryptjs';
import supabase from '../supabase.js';

const router = express.Router();

// ─── SET PIN ─────────────────────────────────────

router.post('/set', async (req, res) => {
  const userId = req.headers['x-user-id'];
  const { pin } = req.body;

  if (!userId || !pin || pin.length !== 4) {
    return res.status(400).json({ message: 'Invalid PIN' });
  }

  try {
    const hashed = await bcrypt.hash(pin, 10);

    const { error } = await supabase
      .from('users')
      .update({
        withdrawal_pin: hashed,
        pin_set: true,
      })
      .eq('id', userId);

    if (error) {
      throw error;
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('SET PIN ERROR:', err.message);
    return res.status(500).json({ message: 'Failed to set PIN' });
  }
});

router.post('/create', async (req, res) => {
  req.url = '/set';
  return router.handle(req, res);
});

// ─── VERIFY PIN ─────────────────────────────────

router.post('/verify', async (req, res) => {
  const userId = req.headers['x-user-id'];
  const { pin } = req.body;

  if (!userId || !pin) {
    return res.status(400).json({ message: 'Missing fields' });
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('withdrawal_pin')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const valid = await bcrypt.compare(pin, user.withdrawal_pin);

    if (!valid) {
      return res.status(401).json({ message: 'Incorrect PIN' });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('VERIFY PIN ERROR:', err.message);
    return res.status(500).json({ message: 'PIN verification failed' });
  }
});

export default router;
