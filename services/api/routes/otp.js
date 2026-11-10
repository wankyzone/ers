import express from 'express';
import { authenticate } from '../modules/protect/index.js';

const router = express.Router();

// OTP verification is deliberately fail-closed until a real challenge store,
// expiry policy, attempt limit, and delivery provider are implemented.
router.post('/verify', authenticate, (_req, res) => {
  return res.status(501).json({
    success: false,
    code: 'OTP_VERIFICATION_NOT_AVAILABLE',
    message: 'OTP verification is not available yet.',
  });
});

export default router;
