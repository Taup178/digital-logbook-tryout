import './config.js';

import express from 'express';
import cors from 'cors';

import searchRouter from './Routes/search.js';
import { startDaemon, ping } from './functions/daemon.js';

const app = express();
const PORT = process.env.PORT || 5002;

// Allowed origins for CORS
const allowedOrigins = [
  ...(process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  'https://digital-logbook-bxgv.onrender.com',
  'https://digital-logbook-bjev.onrender.com',
  'https://digital-logbook-hlulani.onrender.com',
  'http://localhost:5173',
  'http://localhost:3000',
];

// CORS configuration with dynamic origin checking
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes(origin) ||
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
    ) {
      callback(null, true);
    } else {
      console.warn(`CORS: Origin ${origin} not allowed`);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Apply CORS options globally
app.use(cors(corsOptions));

// Safe preflight wildcard handler for Express 5 (regex instead of '*')
app.options(/(.*)/, cors(corsOptions));

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ service: 'dashboard-service', status: 'ok' });
});

app.use('/service', searchRouter);

// Health-ping endpoint — triggered by GitHub Actions every 10 min.
// Wakes the Render instance AND pings Supabase with "hello hlulani".
app.get('/service/health-ping', async (req, res) => {
  try {
    const result = await ping();
    if (result.success) {
      return res.json({ status: 'ok', ...result });
    }
    return res.status(503).json({ status: 'degraded', ...result });
  } catch (err) {
    console.error('[HealthPing] Error:', err.message);
    return res.status(500).json({ status: 'error', reason: err.message });
  }
});

// Global error handler - ensures CORS headers on errors
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

app.listen(PORT, () => {
  console.log(`dashboard-service running on port ${PORT}`);
  // Start the Supabase keep-alive daemon
  startDaemon();
});

export default app;
