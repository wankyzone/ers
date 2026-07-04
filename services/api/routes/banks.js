import express from 'express';

const router = express.Router();

router.get('/', async (_req, res) => {
  return res.json([]);
});

router.post('/', async (req, res) => {
  return res.status(201).json({
    success: true,
    message: 'Placeholder bank account created',
    data: {
      id: 'placeholder-bank',
      ...req.body,
      is_default: false,
    },
  });
});

router.patch('/:id/default', async (req, res) => {
  return res.json({
    success: true,
    message: 'Placeholder default bank updated',
    id: req.params.id,
  });
});

router.delete('/:id', async (req, res) => {
  return res.json({
    success: true,
    message: 'Placeholder bank account deleted',
    id: req.params.id,
  });
});

export default router;
