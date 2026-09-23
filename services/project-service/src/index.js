import './config.js';

import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import * as yaml from 'js-yaml';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { requireAuth } from './middleware/auth.js';
import projectRoutes from './Routes/project.js';
import entryRoutes from './Routes/entries.js';
import priorityRoutes from './Routes/priority.js';
import fieldRoutes from './Routes/field.js';
import archiveRoutes from './Routes/archive.js';
import activityRoutes from './Routes/activity.js';
import aiRoutes from './Routes/ai.js';
import notesRoutes from './Routes/notes.js';
import notificationRoutes, { sendPendingHandler } from './Routes/notifications.js';
import templateRoutes from './Routes/templates.js';
import attachmentRoutes from './Routes/attachments.js';
import memberRoutes from './Routes/members.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5003;
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
  'http://localhost:3001',
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
app.use(express.json({ limit: '5mb' }));

// ── OpenAPI / Swagger UI ──────────────────────────────────────
try {
  const specPath = join(__dirname, '..', 'docs', 'openapi.yaml');
  const openApiSpec = yaml.load(readFileSync(specPath, 'utf8'), {
    schema: yaml.DEFAULT_SCHEMA,
  });
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiSpec, {
      customSiteTitle: 'Codacaine API Docs',
      swaggerOptions: { persistAuthorization: true },
    })
  );
  console.log('Swagger UI available at /api-docs');
} catch (err) {
  console.warn('OpenAPI spec not found — /api-docs disabled:', err.message);
}
app.get('/', (req, res) => {
  res.json({ service: 'project-service', status: 'healthy' });
});
// Public notification-email trigger — called by the hourly pg_cron/pg_net poke
// (migration 011), which carries no user JWT. Idempotent: already-emailed
// rows are no-ops. Mounted BEFORE requireAuth for that reason.
app.post('/service/notifications/sendPending', sendPendingHandler);
// All /service routes require a valid JWT.
// The verified user's email is attached to req.userEmail by requireAuth.
app.use('/service', requireAuth, projectRoutes);
app.use('/service', requireAuth, entryRoutes);
app.use('/service', requireAuth, priorityRoutes);
app.use('/service', requireAuth, fieldRoutes);
app.use('/service', requireAuth, archiveRoutes);
app.use('/service', requireAuth, activityRoutes);
app.use('/service', requireAuth, aiRoutes);
app.use('/service', requireAuth, notesRoutes);
app.use('/service', requireAuth, notificationRoutes);
app.use('/service/templates', requireAuth, templateRoutes);
app.use('/service/attachments', requireAuth, attachmentRoutes);
app.use('/service', requireAuth, memberRoutes);
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Project Service running on port ${PORT}`);
});
