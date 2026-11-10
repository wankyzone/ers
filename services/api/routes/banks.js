import express from 'express';
import { authenticate } from '../modules/protect/index.js';

const router = express.Router();

const unavailable = (_req, res) => res.status(501).json({
  success: false,
  code: 'BANK_PAYOUT_SETUP_NOT_AVAILABLE',
  message: 'Bank payout management is unavailable until secure ownership, verification, and persistence are implemented.',
});

router.get('/', authenticate, (_req, res) => res.json([]));
router.post('/', authenticate, unavailable);
router.patch('/:id/default', authenticate, unavailable);
router.delete('/:id', authenticate, unavailable);

export default router;
