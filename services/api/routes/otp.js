import express from 'express';

const router = express.Router();

router.post('/verify', async (_req, res) => {
  return res.json({
    success: true,
    message: 'Placeholder OTP verified',
  });
});

export default router;
