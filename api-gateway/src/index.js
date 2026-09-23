import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();
const PORT = process.env.PORT || 4000;

const allowedOrigins = [
  ...(process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  'https://digital-logbook-xjhn.onrender.com',
  'https://digital-logbook-bxgv.onrender.com',
  'https://digital-logbook-bjev.onrender.com',
  'https://digital-logbook-hlulani.onrender.com',
  'http://localhost:5173',
  'http://localhost:3000',
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      ) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.options(
  /(.*)/,
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      ) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Preserve the incoming stream: the destination service parses JSON and uploads.

app.get('/', (req, res) => {
  res.json({ service: 'api-gateway', status: 'healthy' });
});

// ── Proxy routes ────────────────────────────────────────────────
// Each /api/{service}/* request is forwarded to the corresponding backend.
// The /api/{service} prefix is stripped; the backend receives the remaining path.

const proxyErrorHandler = (err, req, res) => {
  console.error(`[gateway] Proxy error: ${err.message}`);
  res.status(502).json({ success: false, error: 'Backend service unavailable' });
};

const commonOptions = { changeOrigin: true };

// Auth service
app.use(
  '/api/auth',
  createProxyMiddleware({
    target: process.env.AUTH_SERVICE_URL || 'http://localhost:5001',
    ...commonOptions,
    pathRewrite: { '^/api/auth': '' },
    on: { error: proxyErrorHandler },
  })
);

// Dashboard service
app.use(
  '/api/dashboard',
  createProxyMiddleware({
    target: process.env.DASHBOARD_SERVICE_URL || 'http://localhost:5002',
    ...commonOptions,
    pathRewrite: { '^/api/dashboard': '' },
    on: { error: proxyErrorHandler },
  })
);

// Project service
app.use(
  '/api/project',
  createProxyMiddleware({
    target: process.env.PROJECT_SERVICE_URL || 'http://localhost:5003',
    ...commonOptions,
    pathRewrite: { '^/api/project': '' },
    on: { error: proxyErrorHandler },
  })
);

// Profile service
app.use(
  '/api/profile',
  createProxyMiddleware({
    target: process.env.PROFILE_SERVICE_URL || 'http://localhost:5004',
    ...commonOptions,
    pathRewrite: { '^/api/profile': '' },
    on: { error: proxyErrorHandler },
  })
);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`API Gateway running on port ${PORT}`);
});

export default app;
