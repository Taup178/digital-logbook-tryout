// Read-only checks against either Compose, Vite, or a configured Render frontend.
import assert from 'node:assert/strict';

const base = (process.argv[2] || 'http://localhost:8080').replace(/\/$/, '');
const gateway = (process.argv[3] || base).replace(/\/$/, '');
const get = (url, options = {}) => fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
const index = await get(base + '/');
assert.equal(index.status, 200);
const html = await index.text();
assert.match(html, /<div id="root"/);
const deepLink = await get(base + '/dashboard');
assert.equal(deepLink.status, 200);
assert.match(await deepLink.text(), /<div id="root"/);
console.log('PASS frontend and SPA deep links');
const asset = html.match(/src="([^"]+\.js)"/);
if (asset) {
  const response = await get(new URL(asset[1], base));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /javascript/);
  console.log('PASS frontend JavaScript asset');
}
for (const service of ['auth', 'dashboard', 'project', 'profile']) {
  const response = await get(`${gateway}/api/${service}/`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).service, service + '-service');
  console.log(`PASS gateway -> ${service}`);
}
const protectedRoute = await get(gateway + '/api/project/service/templates', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'unauthenticated smoke check' }),
});
assert.equal(protectedRoute.status, 401);
assert.match((await protectedRoute.json()).error, /Unauthorized/);
console.log('PASS protected API rejects unauthenticated POST');
