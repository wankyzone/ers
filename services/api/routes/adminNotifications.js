import express from 'express';

import { authenticate, authorizeAdmin } from '../modules/protect/index.js';
import { getAdminNotifications } from '../services/adminNotificationService.js';

const router = express.Router();

router.get('/', authenticate, authorizeAdmin(), async (_req, res) => {
  try {
    const result = await getAdminNotifications();

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[adminNotifications]', error);

    return res.status(500).json({
      success: false,
      message: error.message || 'Unable to load notifications.',
    });
  }
});

export default router;
