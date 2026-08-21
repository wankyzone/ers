import express from 'express';

import { authenticate, authorizeAdmin } from '../modules/protect/index.js';
import {
  getAdminClientActivity,
  getAdminClientById,
  getAdminClientList,
} from '../services/clientManagementService.js';

const router = express.Router();

router.get('/', authenticate, authorizeAdmin(), async (req, res) => {
  try {
    const {
      search = '',
      status = 'all',
      accountStatus = 'all',
      page = '1',
      limit = '20',
    } = req.query;

    const result = await getAdminClientList({
      search: String(search),
      status: String(status),
      accountStatus: String(accountStatus),
      page: Number(page),
      limit: Number(limit),
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[adminClients][list]', error);

    return res.status(500).json({
      success: false,
      message: error.message || 'Unable to load clients.',
    });
  }
});

router.get('/:id/activity', authenticate, authorizeAdmin(), async (req, res) => {
  try {
    const { page = '1', limit = '20' } = req.query;

    const result = await getAdminClientActivity(req.params.id, {
      page: Number(page),
      limit: Number(limit),
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[adminClients][activity]', error);

    return res.status(500).json({
      success: false,
      message: error.message || 'Unable to load client activity.',
    });
  }
});

router.get('/:id', authenticate, authorizeAdmin(), async (req, res) => {
  try {
    const client = await getAdminClientById(req.params.id);

    return res.status(200).json({
      success: true,
      data: client,
    });
  } catch (error) {
    console.error('[adminClients][detail]', error);

    if (error.message === 'Client not found.') {
      return res.status(404).json({
        success: false,
        message: 'Client not found.',
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || 'Unable to load client details.',
    });
  }
});

export default router;