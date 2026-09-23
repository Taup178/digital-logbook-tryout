import * as jose from 'jose';
import pool from '../db.js';

/**
 * Express middleware that verifies the JWT from the
 * Authorization: Bearer <token> header.
 *
 * Uses Supabase's JWKS endpoint to fetch the current public signing key,
 * which supports both legacy HS256 and modern ES256 (ECC) keys and
 * handles key rotation automatically.
 *
 * On success, attaches:
 *   req.user     — the decoded JWT payload
 *   req.userEmail — the verified user's email
 *
 * On failure, responds with 401 and does not call next().
 */

// Auto-fetched and cached JWKS client — jose re-fetches periodically
// so key rotations are picked up without any config changes.
const JWKS_URL =
  process.env.SUPABASE_JWKS_URL ||
  (process.env.SUPABASE_URL
    ? process.env.SUPABASE_URL.replace(/\/$/, '') + '/auth/v1/.well-known/jwks.json'
    : '') ||
  'https://bsfbkprmwiwxqxdwisxb.supabase.co/auth/v1/.well-known/jwks.json';

const jwks = jose.createRemoteJWKSet(new URL(JWKS_URL));

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  // Support both Authorization header and query param (for SSE/EventSource)
  let token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token && req.query?.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: missing access token' });
  }

  try {
    const { payload } = await jose.jwtVerify(token, jwks);

    const email = payload.email;
    if (!email) {
      return res.status(401).json({ error: 'Unauthorized: token does not contain email' });
    }

    req.user = payload;
    req.userEmail = email;

    // Ensure a matching row exists in our public.users table. Some auth flows
    // (OAuth, restored sessions, sign-in before the create-profile page ran)
    // never inserted the row, but project FKs depend on it.
    if (pool) {
      try {
        await pool.query(
          `INSERT INTO users (email) VALUES ($1)
           ON CONFLICT (email) DO NOTHING`,
          [email]
        );
      } catch (err) {
        console.error('User provisioning failed:', err.message);
      }
    }

    next();
  } catch (err) {
    console.error('Token verification failed:', err.message);
    return res.status(401).json({ error: 'Unauthorized: invalid access token' });
  }
}
