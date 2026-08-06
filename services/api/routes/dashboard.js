import express from 'express';
import { authenticate, authorizeAdmin } from '../modules/protect/index.js';
import { dashboardOverview } from '../controllers/dashboardController.js';

const router = express.Router();

router.get('/overview', authenticate, authorizeAdmin(), dashboardOverview);

export default router;
