import express from 'express';
import { submitKyc } from '../services/kycService.js';

const router = express.Router();

router.post('/verify', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Missing x-user-id header.',
      });
    }

    const result = await submitKyc(userId, req.body);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('KYC verification error:', err);

    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }
});

export default router;