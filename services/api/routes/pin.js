import express from 'express';
import { authenticate, authorize } from '../modules/protect/index.js';

const router = express.Router();

// PIN operations remain unavailable until step-up authentication,
// durable attempt counters, cooldowns, and recovery controls are implemented.
const pinUnavailable = (_req, res) => res.status(501).json({
  success: false,
  code: 'WITHDRAWAL_PIN_NOT_AVAILABLE',
  message: 'Withdrawal PIN setup and verification are temporarily unavailable while payout security is being completed.',
});

router.post('/set', authenticate, authorize('runner'), pinUnavailable);
router.post('/create', authenticate, authorize('runner'), pinUnavailable);
router.post('/verify', authenticate, authorize('runner'), pinUnavailable);

export default router;
