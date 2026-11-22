#!/usr/bin/env node
// Read-only API smoke test. Run while the app is running:
//   npm run smoke
//   API_BASE=http://127.0.0.1:8790 npm run smoke
// Add --online to also exercise the OpenAlex discovery endpoint.

const BASE = process.env.API_BASE || 'http://127.0.0.1:8787';
const online = process.argv.includes('--online');
const results = [];

async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`PASS  ${name}`);
  } catch (error) {
    results.push({ name, ok: false, error: error.message });
    console.log(`FAIL  ${name}: ${error.message}`);
  }
}

async function json(path, init) {
  const response = await fetch(`${BASE}${path}`, init);
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  if (!response.ok) {
    throw new Error(`${path} -> HTTP ${response.status}: ${String(text).slice(0, 160)}`);
  }
  return body;
}

await check('server status', async () => {
  const body = await json('/api/status');
  if (body.ok !== true) throw new Error('status.ok is not true');
});

await check('health records shape', async () => {
  const body = await json('/api/health');
  if (!body.profile || !Array.isArray(body.weights) || !Array.isArray(body.waterEntries)) {
    throw new Error('unexpected health payload');
  }
  if (typeof body.profile.profileComplete !== 'boolean') {
    throw new Error('profileComplete flag missing');
  }
});

await check('dashboard shape', async () => {
  const body = await json('/api/dashboard');
  if (!body.habits?.duolingo || !body.reading || !body.health) {
    throw new Error('unexpected dashboard payload');
  }
});

await check('papers list', async () => {
  const body = await json('/api/papers');
  if (!Array.isArray(body.papers)) throw new Error('papers is not an array');
});

await check('vocabulary deck seeded', async () => {
  const body = await json('/api/vocab/deck');
  if (!Array.isArray(body.cards) || body.cards.length < 20) {
    throw new Error(`expected >=20 cards, got ${body.cards?.length}`);
  }
});

for (const [path, key] of [
  ['/api/memos', 'memos'],
  ['/api/reminders', 'reminders'],
  ['/api/courses', 'courses'],
]) {
  await check(`${path} shape`, async () => {
    const body = await json(path);
    if (!Array.isArray(body[key])) throw new Error(`${key} is not an array`);
  });
}

await check('settings shape', async () => {
  const body = await json('/api/settings');
  if (typeof body.waterGoalMl !== 'number') throw new Error('waterGoalMl missing');
  if (typeof body.profileComplete !== 'boolean') throw new Error('profileComplete missing');
});

await check('AI status', async () => {
  const body = await json('/api/ai/status');
  if (typeof body.configured !== 'boolean') throw new Error('configured flag missing');
});

await check('JSON export', async () => {
  const body = await json('/api/export');
  if (body.app !== 'My Workspace' || !Array.isArray(body.papers)) {
    throw new Error('unexpected export payload');
  }
});

await check('PDF.js assets served', async () => {
  const response = await fetch(`${BASE}/pdfjs-assets/cmaps/78-EUC-H.bcmap`);
  if (!response.ok) throw new Error(`cmap HTTP ${response.status}`);
});

if (online) {
  await check('OpenAlex discovery (online)', async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    try {
      const body = await json('/api/discovery/latest', { signal: controller.signal });
      if (!Array.isArray(body.foreign) || !Array.isArray(body.domestic)) {
        throw new Error('unexpected discovery payload');
      }
      if (body.foreign.length + body.domestic.length === 0) {
        throw new Error('OpenAlex returned no papers');
      }
    } finally {
      clearTimeout(timer);
    }
  });
}

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log(JSON.stringify(failed, null, 2));
  process.exit(1);
}
