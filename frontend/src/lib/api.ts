const GATEWAY = (import.meta.env.VITE_API_GATEWAY_URL || '').replace(/\/$/, '');

export const AUTH_URL = `${GATEWAY}/api/auth`;
export const DASHBOARD_URL = `${GATEWAY}/api/dashboard`;
export const PROJECT_URL = `${GATEWAY}/api/project`;
export const PROFILE_URL = `${GATEWAY}/api/profile`;

const DEFAULT_TIMEOUT_MS = 90_000; // 90s — Render free-tier cold start + AI processing

export async function request<T>(
  url: string,
  options?: RequestInit & { timeoutMs?: number }
): Promise<T> {
  const start = Date.now();
  const shortUrl = url.replace(/https?:\/\/[^/]+/, '');
  console.log(
    `[api] → ${options?.method || 'GET'} ${shortUrl} timeout=${options?.timeoutMs ?? 90}s`
  );

  const { getSupabase } = await import('./supabase');
  const {
    data: { session },
  } = await getSupabase().auth.getSession();
  const token = session?.access_token || '';

  const { timeoutMs: _timeoutMs, ...fetchOptions } = options ?? {};
  const timeoutMs = _timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      cache: 'no-store', // Never use HTTP cache — all data reads go through SQLite
      headers: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
        ...options?.headers,
      },
    });

    if (!res.ok) {
      const body = await res.text();
      console.log(
        `[api] ← ${options?.method || 'GET'} ${shortUrl} ${res.status} in ${Date.now() - start}ms`
      );
      throw new Error(`API error ${res.status}: ${body}`);
    }

    console.log(
      `[api] ← ${options?.method || 'GET'} ${shortUrl} ${res.status} in ${Date.now() - start}ms`
    );
    return res.json() as Promise<T>;
  } catch (err: unknown) {
    console.log(
      `[api] ✗ ${options?.method || 'GET'} ${shortUrl} ERROR in ${Date.now() - start}ms:`,
      (err as Error)?.message
    );
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  auth: {
    health: () => request<{ service: string; status: string }>(`${AUTH_URL}`),
  },
  dashboard: {
    health: () => request<{ service: string; status: string }>(`${DASHBOARD_URL}`),
  },
  projects: {
    health: () => request<{ service: string; status: string }>(`${PROJECT_URL}`),
  },
};
