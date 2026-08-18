import express from 'express';

import { authenticate, authorizeAdmin } from '../modules/protect/index.js';
import {
  getAdminRunnerById,
  getAdminRunnerList,
  updateRunnerAvailability,
} from '../services/runnerManagementService.js';

const router = express.Router();

router.get('/', authenticate, authorizeAdmin(), async (req, res) => {
  try {
    const { search = '', status = 'all', verified = 'all', page = '1', limit = '20' } = req.query;

    const result = await getAdminRunnerList({
      search: String(search),
      status: String(status),
      verified: String(verified),
      page: Number(page),
      limit: Number(limit),
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[adminRunners][list]', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Unable to load runners.',
    });
  }
});

router.get('/:id', authenticate, authorizeAdmin(), async (req, res) => {
  try {
    const runner = await getAdminRunnerById(req.params.id);

    return res.status(200).json({
      success: true,
      data: runner,
    });
  } catch (error) {
    console.error('[adminRunners][detail]', error);

    if (error.message === 'Runner not found.') {
      return res.status(404).json({
        success: false,
        message: 'Runner not found.',
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || 'Unable to load runner details.',
    });
  }
});

router.post('/:id/suspend', authenticate, authorizeAdmin(), async (req, res) => {
  try {
    const result = await updateRunnerAvailability(req.params.id, false);

    return res.status(200).json(result);
  } catch (error) {
    console.error('[adminRunners][suspend]', error);

    if (error.message === 'Runner not found.') {
      return res.status(404).json({
        success: false,
        message: 'Runner not found.',
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || 'Unable to suspend runner.',
    });
  }
});

router.post('/:id/activate', authenticate, authorizeAdmin(), async (req, res) => {
  try {
    const result = await updateRunnerAvailability(req.params.id, true);

    return res.status(200).json(result);
  } catch (error) {
    console.error('[adminRunners][activate]', error);

    if (error.message === 'Runner not found.') {
      return res.status(404).json({
        success: false,
        message: 'Runner not found.',
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || 'Unable to activate runner.',
    });
  }
});

export default router;
