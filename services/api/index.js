import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';

import errandsRouter from './routes/errands.js';
import transactionsRouter from './routes/transactions.js';
import paystackRouter from './routes/paystack.js';
import kycRouter from './routes/kyc.js';
import pinRouter from './routes/pin.js';
import banksRouter from './routes/banks.js';
import otpRouter from './routes/otp.js';
import supabase from './supabase.js';

import './jobs/escrow.js';

// ─── App ─────────────────────────

const app = express();

app.use(cors());
app.use(express.json());

app.use(
  '/paystack/webhook',
  express.raw({ type: 'application/json' })
);

// ─── Routes ──────────────────────

app.get('/', (_req, res) => {
  res.json({
    name: 'ERS API',
    status: 'running',
  });
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
  });
});

app.get('/wallet', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'Missing x-user-id header',
      });
    }

    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.log('Wallet fetch error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch wallet',
      });
    }

    return res.json(data ?? {
      balance: 0,
      available_balance: 0,
      escrow_balance: 0,
    });
  } catch (err) {
    console.log('Wallet route error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

app.get('/api/wallet', (req, res, next) => {
  req.url = '/wallet';
  return app.handle(req, res, next);
});

app.post('/withdraw', (_req, res) => {
  res.json({
    success: true,
    message: 'Placeholder withdrawal endpoint',
    requireOtp: false,
  });
});

app.post('/api/withdraw', (_req, res) => {
  res.json({
    success: true,
    message: 'Placeholder withdrawal endpoint',
    requireOtp: false,
  });
});

app.use('/errands', errandsRouter);
app.use('/transactions', transactionsRouter);
app.use('/paystack', paystackRouter);
app.use('/kyc', kycRouter);
app.use('/pin', pinRouter);
app.use('/banks', banksRouter);
app.use('/otp', otpRouter);

app.use('/api/errands', errandsRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/paystack', paystackRouter);
app.use('/api/kyc', kycRouter);
app.use('/api/pin', pinRouter);
app.use('/api/banks', banksRouter);
app.use('/api/otp', otpRouter);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    method: req.method,
    path: req.originalUrl,
  });
});

app.use((err, _req, res, _next) => {
  console.error('Unhandled API error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

function listRoutes(router, prefix = '') {
  const routes = [];

  for (const layer of router.stack ?? []) {
    if (!layer.route) continue;

    const routePath = `${prefix}${layer.route.path}`.replace(/\/+/g, '/');
    const methods = Object.keys(layer.route.methods);

    methods.forEach((method) => {
      routes.push(`${method.toUpperCase().padEnd(6)} ${routePath}`);
    });
  }

  return routes;
}

function registeredRoutes() {
  return [
    'GET    /',
    'GET    /health',
    'GET    /wallet',
    'GET    /api/wallet',
    'POST   /withdraw',
    'POST   /api/withdraw',
    ...listRoutes(errandsRouter, '/errands'),
    ...listRoutes(errandsRouter, '/api/errands'),
    ...listRoutes(transactionsRouter, '/transactions'),
    ...listRoutes(transactionsRouter, '/api/transactions'),
    ...listRoutes(paystackRouter, '/paystack'),
    ...listRoutes(paystackRouter, '/api/paystack'),
    ...listRoutes(kycRouter, '/kyc'),
    ...listRoutes(kycRouter, '/api/kyc'),
    ...listRoutes(pinRouter, '/pin'),
    ...listRoutes(pinRouter, '/api/pin'),
    ...listRoutes(banksRouter, '/banks'),
    ...listRoutes(banksRouter, '/api/banks'),
    ...listRoutes(otpRouter, '/otp'),
    ...listRoutes(otpRouter, '/api/otp'),
  ].sort();
}

// ─── Server ──────────────────────

const server = http.createServer(app);

// ─── Socket ──────────────────────

const io = new Server(server, {
  cors: { 
    origin: '*',
    methods: ['GET', 'POST'],
   },
});

io.on('connection', (socket) => {
  console.log('⚡ Client connected');

  socket.on('join:errand', (errandId) => {
    socket.join(`errand:${errandId}`);
  });

  socket.on('location:update', ({ errandId, lat, lng }) => {
    socket.to(`errand:${errandId}`).emit('location:update', {
      lat,
      lng,
    });
  });

  // 🔥 WITHDRAWAL REALTIME
  socket.on('join:user', (userId) => {
    socket.join(`user:${userId}`);
  });

  socket.on('disconnect', () => {
    console.log('❌ Disconnected');
  });
});

// ─── Start ───────────────────────

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 ERS API running on port ${PORT}`);
  console.log('REGISTERED ROUTES');
  registeredRoutes().forEach((route) => console.log(route));
});
