import express from 'express';

import { authenticate, authorizeAdmin } from '../modules/protect/index.js';

const router = express.Router();

/**
 * GET /admin/me
 * Return minimal authenticated admin identity for frontend gating.
 * - Requires `authenticate` middleware (401 on missing/invalid token)
 * - Requires `authorizeAdmin()` middleware (403 for non-admin roles)
 */
router.get('/me', authenticate, authorizeAdmin(), async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication is required.',
      });
    }

    const { id, email, role } = user;

    return res.status(200).json({
      success: true,
      data: {
        id,
        email,
        role,
      },
    });
  } catch (error) {
    console.error('Failed to resolve admin identity:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

export default router;
