import express from 'express';

import { authenticate, authorizeAdmin } from '../modules/protect/index.js';
import { getAnalyticsOverview } from '../services/analyticsService.js';

const router = express.Router();

router.get('/overview', authenticate, authorizeAdmin(), async (req, res) => {
  try {
    const { range = '30d' } = req.query;

    const result = await getAnalyticsOverview({
      range: String(range),
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[adminAnalytics][overview]', error);

    return res.status(500).json({
      success: false,
      message: error.message || 'Unable to load analytics.',
    });
  }
});

export default router;
