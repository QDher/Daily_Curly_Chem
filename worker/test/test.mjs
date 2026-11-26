// Tests of the Worker against a local D1 database (Miniflare). Run: npm test (in worker/)
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://qdher.github.io';
const mf = new Miniflare(convertV4MiniflareOptions({
  modules: ['index.js', 'rows.js'].map((f) => ({ type: 'ESModule', path: path.join(root, 'src', f) })),
  modulesRoot: path.join(root, 'src'),
  compatibilityDate: '2026-10-23',
  d1Databases: { DB: 'test-db' },
  bindings: { ALLOWED_ORIGINS: ORIGIN, MECH_TESTERS: 'aaaaaaaa,bbbbbbbb', MECH_EXPORT_KEY: 'test-key' },
}));
const db = await mf.getD1Database('DB');
const statements = (sql) => sql.replace(/^\s*--.*$/gm, '').split(/;\s*$/m).map((s) => s.trim()).filter(Boolean);
for (const f of fs.readdirSync(path.join(root, 'migrations')).sort()) {
  for (const s of statements(fs.readFileSync(path.join(root, 'migrations', f), 'utf8'))) await db.prepare(s).run();
}
const call = async (method, p, body, origin = ORIGIN, extra = {}) => {
  const headers = { 'Content-Type': 'application/json', ...extra };
  if (origin) headers.Origin = origin;
  const r = await mf.dispatchFetch('http://localhost' + p, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  return { status: r.status, headers: r.headers, data: text ? JSON.parse(text) : null };
};

let pass = 0, n = 0;
const test = async (name, fn) => { n += 1; try { await fn(); pass += 1; } catch (e) { console.log('FAILED: ' + name + ': ' + e.message); } };
const S = '11111111-2222-4333-8444-555555555555';
const entry = (over = {}) => ({ site: 'mechpilot', visitor: 'aaaaaaaa', session: S, seq: 0, kind: 'drawing', task: 't2-diketone', user_level: 'graduate',
  payload: { kind: 'drawing', accepted: true, flagged: null, strokes: [{ points: [{ x: 1, y: 2 }], times: [0], pressure: [0.5] }] }, ...over });

await test('service name', async () => { assert.equal((await call('GET', '/')).data.service, 'curly-entries'); });
await test('a new entry is stored (201), sent again it is replaced (200)', async () => {
  assert.equal((await call('POST', '/mech_entries', entry())).status, 201);
  const again = entry(); again.payload.accepted = false; again.payload.flagged = 'wrong';
  assert.equal((await call('POST', '/mech_entries', again)).status, 200);
  const row = await db.prepare('SELECT accepted, flagged, updated_at FROM mech_entries').first();
  assert.equal(row.accepted, 0); assert.equal(row.flagged, 'wrong'); assert.ok(row.updated_at);
});
await test('arrows, votes, questionnaire and remark entries are stored', async () => {
  let seq = 1;
  for (const kind of ['arrows', 'votes', 'questionnaire', 'remark']) {
    const r = await call('POST', '/mech_entries', entry({ seq: seq++, kind, payload: { kind, accepted: kind === 'arrows' ? 0 : undefined, text: 'x' } }));
    assert.equal(r.status, 201, kind);
  }
  assert.equal((await db.prepare("SELECT accepted FROM mech_entries WHERE kind = 'arrows'").first()).accepted, 1);
});
await test('refused: unknown tester, other site, bad session, bad kind, payload not an object, too large', async () => {
  for (const [over, msg] of [[{ visitor: 'cccccccc' }, 'unknown visitor'], [{ visitor: 'john0002' }, 'invalid visitor'], [{ site: 'onepot' }, 'invalid site'],
    [{ session: 'x' }, 'invalid session'], [{ kind: 'other' }, 'invalid kind'], [{ payload: 'text' }, 'invalid payload'], [{ seq: -1 }, 'invalid seq'],
    [{ payload: { big: 'x'.repeat(250001) } }, 'payload too large']]) {
    const r = await call('POST', '/mech_entries', entry(over));
    assert.equal(r.status, 400, msg); assert.equal(r.data.error, msg);
  }
});
await test('other origins are refused; no origin (curl) is accepted', async () => {
  assert.equal((await call('POST', '/mech_entries', entry({ seq: 9 }), 'https://example.org')).status, 403);
  assert.equal((await call('POST', '/mech_entries', entry({ seq: 9 }), null)).status, 201);
});
await test('summary has counts and no payload', async () => {
  const r = await call('GET', '/rpc/mech_summary?p_site=mechpilot');
  assert.equal(r.status, 200);
  assert.ok(r.data.length >= 2); assert.ok(r.data.every((x) => !('payload' in x)));
});
await test('export needs the key and returns the payloads', async () => {
  assert.equal((await call('GET', '/rpc/mech_export?p_site=mechpilot')).status, 403);
  assert.equal((await call('GET', '/rpc/mech_export?p_site=mechpilot', undefined, null, { 'X-Export-Key': 'wrong' })).status, 403);
  const r = await call('GET', '/rpc/mech_export?p_site=mechpilot', undefined, null, { 'X-Export-Key': 'test-key' });
  assert.equal(r.status, 200); assert.equal(r.data.length, 6); assert.ok(r.data[0].payload.strokes);
  const none = await call('POST', '/rpc/mech_export', { p_site: 'mechpilot', p_since: '2999-01-01' }, null, { 'X-Export-Key': 'test-key' });
  assert.equal(none.data.length, 0);
});
await test('the tester labels of wrangler.toml are the first six of data/testers.json', async () => {
  const toml = fs.readFileSync(path.join(root, 'wrangler.toml'), 'utf8');
  const labels = /MECH_TESTERS = "([^"]*)"/.exec(toml)[1];
  const want = JSON.parse(fs.readFileSync(path.join(root, '..', 'data', 'testers.json'), 'utf8')).sha256.slice(0, 6).map((h) => h.slice(0, 8)).join(',');
  assert.equal(labels, want);
});
await mf.dispose();
console.log(pass + '/' + n + ' passed');
process.exit(pass === n ? 0 : 1);
