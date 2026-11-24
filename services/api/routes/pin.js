import express from 'express';
import bcrypt from 'bcryptjs';
import supabase from '../supabase.js';
import {
  authenticate,
  authorizeCustomerOrRoles,
} from '../modules/protect/index.js';

const router = express.Router();

const isValidPin = (pin) =>
  typeof pin === 'string' && /^\d{4}$/.test(pin);

async function setPin(req, res) {
  const { pin } = req.body;

  if (!isValidPin(pin)) {
    return res.status(400).json({ message: 'Invalid PIN' });
  }

  try {
    const hashed = await bcrypt.hash(pin, 10);

    const { data, error } = await supabase
      .from('users')
      .update({
        withdrawal_pin: hashed,
        pin_set: true,
      })
      .eq('id', req.user.id)
      .is('withdrawal_pin', null)
      .select('id')
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(409).json({
        message: 'PIN is already set or unavailable.',
      });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('SET PIN ERROR:', err);
    return res.status(500).json({ message: 'Failed to set PIN' });
  }
}

router.post('/set', authenticate, authorizeCustomerOrRoles('runner'), setPin);
router.post('/create', authenticate, authorizeCustomerOrRoles('runner'), setPin);

router.post(
  '/verify',
  authenticate,
  authorizeCustomerOrRoles('runner'),
  async (req, res) => {
  const { pin } = req.body;

  if (!isValidPin(pin)) {
    return res.status(400).json({ message: 'Invalid PIN' });
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('withdrawal_pin')
      .eq('id', req.user.id)
      .single();

    if (error || !user) {
      return res.status(409).json({ message: 'PIN is not set.' });
    }

    if (!user.withdrawal_pin) {
      return res.status(409).json({ message: 'PIN is not set.' });
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
  }
);

export default router;
