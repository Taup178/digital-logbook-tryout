import './config.js';

import express from 'express';
import cors from 'cors';

import loginRoutes from './Routes/login.js';
import profileRoutes from './Routes/profile.js';

const app = express();
const PORT = process.env.PORT || 5004;

// Allowed origins for CORS
const allowedOrigins = [
  ...(process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  'https://digital-logbook-bxgv.onrender.com',
  'https://digital-logbook-bjev.onrender.com',
  'https://digital-logbook-hlulani.onrender.com',
  'http://localhost:5173', // for local development
  'http://localhost:3000',
];

// CORS configuration with dynamic origin checking
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, Postman)
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
  res.json({ service: 'profile-service', status: 'healthy' });
});

app.use('/service', loginRoutes);
app.use('/service', profileRoutes);

// Global error handler - ensures CORS headers are sent even on errors
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  // Ensure CORS headers are present on error responses
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }

  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Profile Service running on port ${PORT}`);
});
