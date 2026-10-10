'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../server');

test('Node server serves the standalone app and its local assets', async (t) => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const page = await fetch(base);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /SurgeCore|styles\.css/);
  const script = await fetch(`${base}/core.js`);
  assert.equal(script.status, 200);
  assert.match(script.headers.get('content-type'), /javascript/);
  const deployment = await fetch(`${base}/vercel.json`);
  assert.equal(deployment.status, 200);
  const vercelConfig = await deployment.json();
  assert.equal(vercelConfig.outputDirectory, '.');
  assert.equal((await fetch(`${base}/missing-file.txt`)).status, 404);

  // Installable and offline: manifest, icons and service worker must be served with the right types.
  const manifestResponse = await fetch(`${base}/manifest.webmanifest`);
  assert.match(manifestResponse.headers.get('content-type'), /manifest\+json/);
  const manifest = await manifestResponse.json();
  assert.equal(manifest.display, 'standalone');
  for (const icon of manifest.icons) {
    const response = await fetch(`${base}/${icon.src}`);
    assert.equal(response.status, 200, icon.src);
    assert.equal(response.headers.get('content-type'), 'image/png');
  }
  const worker = await fetch(`${base}/sw.js`);
  assert.equal(worker.status, 200);
  assert.match(worker.headers.get('content-type'), /javascript/);
  // Every file the service worker precaches (except the optional config.js) must exist.
  const shell = [...(await worker.text()).matchAll(/'([^']+\.(?:html|css|js|webmanifest|png))'/g)]
    .map((m) => m[1])
    .filter((f) => f !== 'config.js');
  assert.ok(shell.length >= 8);
  for (const file of shell) assert.equal((await fetch(`${base}/${file}`)).status, 200, file);
});
