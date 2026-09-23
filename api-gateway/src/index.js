import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();
const PORT = process.env.PORT || 4000;
const PROXY_TIMEOUT = Number(process.env.PROXY_TIMEOUT_MS || 120000);

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

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    const isAllowed =
      allowedOrigins.includes(origin) ||
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

    if (isAllowed) {
      return callback(null, true);
    }

    console.warn(`[gateway] Blocked CORS origin: ${origin}`);

    return callback(null, false);
  },

  credentials: true,

  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options(/(.*)/, cors(corsOptions));

function normalizeTarget(value, fallback, serviceName) {
  const rawValue = (value || fallback).trim();

  try {
    const parsed = new URL(rawValue);

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Invalid protocol: ${parsed.protocol}`);
    }

    return parsed.origin;
  } catch (error) {
    console.error(`[gateway] Invalid ${serviceName} URL: "${rawValue}"`);

    throw error;
  }
}

const services = {
  auth: normalizeTarget(process.env.AUTH_SERVICE_URL, 'http://localhost:5001', 'AUTH_SERVICE_URL'),

  dashboard: normalizeTarget(
    process.env.DASHBOARD_SERVICE_URL,
    'http://localhost:5002',
    'DASHBOARD_SERVICE_URL'
  ),

  project: normalizeTarget(
    process.env.PROJECT_SERVICE_URL,
    'http://localhost:5003',
    'PROJECT_SERVICE_URL'
  ),

  profile: normalizeTarget(
    process.env.PROFILE_SERVICE_URL,
    'http://localhost:5004',
    'PROFILE_SERVICE_URL'
  ),
};

app.get('/', (req, res) => {
  res.status(200).json({
    service: 'api-gateway',
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({
    service: 'api-gateway',
    status: 'healthy',
  });
});

async function wakeService(serviceName, target) {
  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, 115000);

  const startedAt = Date.now();

  try {
    console.log(`[gateway] Waking ${serviceName}: ${target}`);

    const response = await fetch(`${target}/`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'digital-logbook-api-gateway',
      },
    });

    const elapsed = Date.now() - startedAt;

    console.log(`[gateway] ${serviceName} responded with ${response.status} in ${elapsed}ms`);

    return {
      service: serviceName,
      status: 'awake',
      httpStatus: response.status,
      responseTimeMs: elapsed,
    };
  } catch (error) {
    const elapsed = Date.now() - startedAt;

    console.error(`[gateway] Failed to wake ${serviceName}:`, error.message);

    return {
      service: serviceName,
      status: 'failed',
      error: error.message,
      responseTimeMs: elapsed,
    };
  } finally {
    clearTimeout(timer);
  }
}

app.get('/api/wake', async (req, res) => {
  console.log('[gateway] Wake request received');

  const results = await Promise.all(
    Object.entries(services).map(([serviceName, target]) => wakeService(serviceName, target))
  );

  const failed = results.filter((result) => result.status === 'failed');

  res.status(failed.length === 0 ? 200 : 207).json({
    success: failed.length === 0,
    message:
      failed.length === 0
        ? 'All backend services are awake'
        : `${failed.length} backend service(s) failed to wake`,
    services: results,
  });
});

function createServiceProxy(serviceName, target) {
  return createProxyMiddleware({
    target,

    changeOrigin: true,

    proxyTimeout: PROXY_TIMEOUT,
    timeout: PROXY_TIMEOUT,

    on: {
      proxyReq: (proxyReq, req) => {
        console.log(
          `[gateway] -> ${serviceName}`,
          `${req.method} ${req.originalUrl}`,
          `target=${target}${req.url}`
        );
      },

      proxyRes: (proxyRes, req) => {
        console.log(
          `[gateway] <- ${serviceName}`,
          `${req.method} ${req.originalUrl}`,
          `status=${proxyRes.statusCode}`
        );
      },

      error: (err, req, res) => {
        console.error(`[gateway] ${serviceName} proxy error`);

        console.error({
          code: err.code,
          message: err.message,
          method: req.method,
          url: req.originalUrl,
          target,
        });

        if (!res.headersSent) {
          res.writeHead(502, {
            'Content-Type': 'application/json',
          });
        }

        res.end(
          JSON.stringify({
            success: false,
            error: 'Backend service unavailable',
            service: serviceName,
            details:
              process.env.NODE_ENV === 'production'
                ? undefined
                : {
                    code: err.code,
                    message: err.message,
                    target,
                  },
          })
        );
      },
    },
  });
}

app.use('/api/auth', createServiceProxy('auth', services.auth));

app.use('/api/dashboard', createServiceProxy('dashboard', services.dashboard));

app.use('/api/project', createServiceProxy('project', services.project));

app.use('/api/profile', createServiceProxy('profile', services.profile));

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Gateway route not found',
    method: req.method,
    path: req.originalUrl,
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('========================================');
  console.log(`API Gateway running on port ${PORT}`);
  console.log(`Proxy timeout: ${PROXY_TIMEOUT}ms`);
  console.log(`AUTH      -> ${services.auth}`);
  console.log(`DASHBOARD -> ${services.dashboard}`);
  console.log(`PROJECT   -> ${services.project}`);
  console.log(`PROFILE   -> ${services.profile}`);
  console.log('========================================');
});

export default app;
