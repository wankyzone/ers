import express from 'express';

import { authenticate, authorizeAdmin } from '../modules/protect/index.js';
import {
  getAdminErrandById,
  getAdminErrandList,
} from '../services/adminErrandManagementService.js';

const router = express.Router();

router.get('/', authenticate, authorizeAdmin(), async (req, res) => {
  try {
    const { search = '', status = 'all', page = '1', limit = '20' } = req.query;

    const result = await getAdminErrandList({
      search: String(search),
      status: String(status),
      page: Number(page),
      limit: Number(limit),
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[adminErrands][list]', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Unable to load errands.',
    });
  }
});

router.get('/:id', authenticate, authorizeAdmin(), async (req, res) => {
  try {
    const errand = await getAdminErrandById(req.params.id);

    return res.status(200).json({
      success: true,
      data: errand,
    });
  } catch (error) {
    console.error('[adminErrands][detail]', error);

    if (error.message === 'Errand not found.') {
      return res.status(404).json({
        success: false,
        message: 'Errand not found.',
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || 'Unable to load errand details.',
    });
  }
});

export default router;
