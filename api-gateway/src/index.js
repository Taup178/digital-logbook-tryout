import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();

const PORT = process.env.PORT || 4000;
const PROXY_TIMEOUT = Number(process.env.PROXY_TIMEOUT_MS || 120000);
const WAKE_TIMEOUT = 115000;
const WAKE_TTL = 10 * 60 * 1000;

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

let wakePromise = null;
let lastSuccessfulWake = 0;

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
  }, WAKE_TIMEOUT);

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

    const responseTime = Date.now() - startedAt;

    console.log(`[gateway] ${serviceName} awake - HTTP ${response.status} - ${responseTime}ms`);

    return {
      service: serviceName,
      status: 'awake',
      httpStatus: response.status,
      responseTimeMs: responseTime,
    };
  } catch (error) {
    const responseTime = Date.now() - startedAt;

    console.error(`[gateway] ${serviceName} wake failed: ${error.message}`);

    return {
      service: serviceName,
      status: 'failed',
      error: error.message,
      responseTimeMs: responseTime,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function wakeAllServices() {
  const now = Date.now();

  if (lastSuccessfulWake && now - lastSuccessfulWake < WAKE_TTL) {
    return;
  }

  if (wakePromise) {
    return wakePromise;
  }

  console.log('[gateway] Waking all backend services...');

  wakePromise = Promise.all(
    Object.entries(services).map(([serviceName, target]) => wakeService(serviceName, target))
  );

  try {
    const results = await wakePromise;

    const failedServices = results.filter((result) => result.status !== 'awake');

    if (failedServices.length === 0) {
      lastSuccessfulWake = Date.now();

      console.log('[gateway] All backend services are awake');
    } else {
      console.error(
        '[gateway] Some backend services failed to wake:',
        failedServices.map((service) => service.service)
      );
    }

    return results;
  } finally {
    wakePromise = null;
  }
}

async function ensureAllServicesAwake(req, res, next) {
  try {
    await wakeAllServices();
    next();
  } catch (error) {
    console.error('[gateway] Service wake-up error:', error.message);

    res.status(503).json({
      success: false,
      error: 'Backend services are starting. Please try again.',
    });
  }
}

app.get('/api/wake', async (req, res) => {
  try {
    lastSuccessfulWake = 0;

    const results = await wakeAllServices();

    const failed = results?.filter((result) => result.status === 'failed') || [];

    res.status(failed.length === 0 ? 200 : 207).json({
      success: failed.length === 0,
      services: results,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
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
          })
        );
      },
    },
  });
}

app.use('/api/auth', ensureAllServicesAwake, createServiceProxy('auth', services.auth));

app.use(
  '/api/dashboard',
  ensureAllServicesAwake,
  createServiceProxy('dashboard', services.dashboard)
);

app.use('/api/project', ensureAllServicesAwake, createServiceProxy('project', services.project));

app.use('/api/profile', ensureAllServicesAwake, createServiceProxy('profile', services.profile));

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
