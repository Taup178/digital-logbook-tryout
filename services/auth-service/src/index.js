const express = require('express');
const cors = require('cors');
require('dotenv').config();

const PORT = process.env.PORT || 5001;

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

/**
 * Create and configure the Express app.
 * Exported as a factory so tests can mount routes before the error handler.
 */
function createApp() {
  const app = express();

  // Apply CORS options globally
  app.use(cors(corsOptions));

  // Safe preflight wildcard handler for Express 5 (regex instead of '*')
  app.options(/(.*)/, cors(corsOptions));

  app.use(express.json());

  app.get('/', (req, res) => {
    res.json({ service: 'auth-service', status: 'healthy' });
  });

  // Global error handler - ensures CORS headers on errors
  app.use(errorHandler);

  return app;
}

// Exported error handler so tests can mount it after test routes
function errorHandler(err, req, res, next) {
  console.error('Unhandled error:', err);
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  res.status(500).json({ error: 'Internal server error', message: err.message });
}

const app = createApp();

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Auth Service running on port ${PORT}`);
  });
}

module.exports = app;
module.exports.createApp = createApp;
module.exports.errorHandler = errorHandler;
