import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

test('gateway preserves paths, JSON, uploads, authorization and CORS', async (t) => {
  const backend = http
    .createServer(async (req, res) => {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          path: req.url,
          method: req.method,
          body: Buffer.concat(chunks).toString(),
          authorization: req.headers.authorization,
          contentType: req.headers['content-type'],
        })
      );
    })
    .listen(0, '127.0.0.1');
  await once(backend, 'listening');
  t.after(() => backend.close());
  const placeholder = http.createServer().listen(0, '127.0.0.1');
  await once(placeholder, 'listening');
  const port = placeholder.address().port;
  await new Promise((resolve) => placeholder.close(resolve));
  const upstream = `http://127.0.0.1:${backend.address().port}`;
  const gateway = spawn(process.execPath, ['src/index.js'], {
    cwd: new URL('..', import.meta.url),
    env: {
      ...process.env,
      PORT: String(port),
      CORS_ORIGINS: 'https://example.test',
      AUTH_SERVICE_URL: upstream,
      DASHBOARD_SERVICE_URL: upstream,
      PROJECT_SERVICE_URL: upstream,
      PROFILE_SERVICE_URL: upstream,
    },
    stdio: 'ignore',
  });
  t.after(() => gateway.kill());
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base)).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.ok(ready, 'gateway starts');
  for (const service of ['auth', 'dashboard', 'project', 'profile']) {
    const body = JSON.stringify({ message: 'request body survives proxying' });
    const response = await fetch(`${base}/api/${service}/service/check?value=1`, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(5000),
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test',
        Origin: 'https://example.test',
      },
    });
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://example.test');
    assert.deepEqual(await response.json(), {
      path: '/service/check?value=1',
      method: 'POST',
      body,
      authorization: 'Bearer test',
      contentType: 'application/json',
    });
  }
  const form = new FormData();
  form.append('file', new Blob(['upload contents']), 'test.txt');
  const upload = await fetch(`${base}/api/project/upload`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(5000),
  }).then((r) => r.json());
  assert.match(upload.contentType, /^multipart\/form-data; boundary=/);
  assert.match(upload.body, /upload contents/);
  const denied = await fetch(base, { headers: { Origin: 'https://untrusted.test' } });
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
});
