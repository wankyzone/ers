import express from 'express';

const router = express.Router();

// example route
router.post('/verify', async (req, res) => {
  try {
    // your logic here
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'KYC failed' });
  }
});

export default router; 