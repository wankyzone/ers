import express from 'express';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    // TODO: replace with real DB query
    res.json([]);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch transactions' });
  }
});

export default router;