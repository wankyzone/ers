import express from 'express';

import { authenticate, authorizeAdmin } from '../modules/protect/index.js';
import {
  getAdminProfile,
  updateAdminProfile,
} from '../controllers/settingsController.js';

const router = express.Router();

router.get('/profile', authenticate, authorizeAdmin(), getAdminProfile);
router.patch('/profile', authenticate, authorizeAdmin(), updateAdminProfile);

export default router;
