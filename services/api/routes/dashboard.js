import express from 'express';
import { authenticate, authorizeAdmin } from '../modules/protect/index.js';
import { dashboardOverview } from '../controllers/dashboardController.js';
import { getApiHealth } from '../modules/health.js';

const router = express.Router();

router.get('/overview', authenticate, authorizeAdmin(), dashboardOverview);

router.get('/health', authenticate, authorizeAdmin(), (_req, res) => {
  return res.status(200).json({
    success: true,
    data: getApiHealth(),
  });
});

export default router;
