// Entries of the Daily Curly Chem test run: Cloudflare Worker "curly-entries" with its own D1 database (binding DB).
// Separate from the Worker of the two puzzle sites (decision 64, 2026-11-26).
//
//   POST /mech_entries   one entry of the page (table mech_entries, site "mechpilot"): 201 {} for a new row, 200 {}
//        when a row with the same (site, visitor, session, seq) is replaced; visitors are limited to MECH_TESTERS
//        (wrangler.toml) and to MAX_ROWS rows each (429 beyond). Body up to about 260 kB.
//   GET or POST /rpc/mech_summary (p_site): counts per task and kind, without payloads.
//   GET or POST /rpc/mech_export (p_site, p_since): the rows with their payloads; only with the header X-Export-Key
//        equal to the Worker secret MECH_EXPORT_KEY (403 otherwise, also when the secret is not set).
//
// Browsers may call it only from ALLOWED_ORIGINS; requests without an Origin header (curl) are accepted.

import { SITES, MAX_PAYLOAD, Invalid, validRow, isoTime } from './rows.js';

const MAX_ROWS = 2000;

const json = (data, status, headers) => new Response(JSON.stringify(data), { status, headers: { ...headers, 'Content-Type': 'application/json' } });

async function readBody(request, max) {
  const text = await request.text();
  if (text.length > max) throw new Invalid('body too large');
  let b;
  try { b = JSON.parse(text); } catch { throw new Invalid('body must be a JSON object'); }
  if (!b || typeof b !== 'object' || Array.isArray(b)) throw new Invalid('body must be a JSON object');
  return b;
}

async function insert(db, body, env) {
  const testers = String(env.MECH_TESTERS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const row = validRow(body, testers);
  const old = await db.prepare('SELECT id FROM mech_entries WHERE site = ? AND visitor = ? AND session = ? AND seq = ?')
    .bind(row.site, row.visitor, row.session, row.seq).first();
  if (!old) {
    const c = await db.prepare('SELECT count(*) AS n FROM mech_entries WHERE site = ? AND visitor = ?').bind(row.site, row.visitor).first();
    if (c.n >= MAX_ROWS) return { status: 429, data: { error: 'too many entries' } };
  }
  const cols = Object.keys(row);
  await db.prepare(`INSERT INTO mech_entries (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})
    ON CONFLICT (site, visitor, session, seq) DO UPDATE SET kind = excluded.kind, task = excluded.task,
      user_level = excluded.user_level, accepted = excluded.accepted, flagged = excluded.flagged,
      payload = excluded.payload, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`)
    .bind(...cols.map((c) => row[c])).run();
  return { status: old ? 200 : 201, data: {} };
}

async function rpc(db, fn, a, request, env) {
  if (!SITES.includes(a.p_site)) throw new Invalid('invalid p_site');
  if (fn === 'mech_summary') {
    const r = await db.prepare(`SELECT task, kind, count(*) AS entries, count(DISTINCT visitor) AS visitors,
        sum(accepted) AS accepted, sum(flagged = 'wrong') AS wrong
      FROM mech_entries WHERE site = ? GROUP BY task, kind ORDER BY task, kind`).bind(a.p_site).all();
    return { data: r.results.map((x) => ({ ...x, wrong: x.wrong || 0 })) };
  }
  if (fn === 'mech_export') {
    const key = env.MECH_EXPORT_KEY;
    if (!key || request.headers.get('X-Export-Key') !== key) return { status: 403, data: { error: 'export key required' } };
    const since = a.p_since ? isoTime(a.p_since) : '1970-01-01T00:00:00.000Z';
    if (!since) throw new Invalid('invalid p_since');
    const r = await db.prepare(`SELECT id, visitor, session, seq, kind, task, user_level, accepted, flagged, payload,
        created_at, updated_at FROM mech_entries
      WHERE site = ? AND coalesce(updated_at, created_at) >= ? ORDER BY visitor, session, seq`).bind(a.p_site, since).all();
    return { data: r.results.map((x) => ({ ...x, payload: JSON.parse(x.payload) })) };
  }
  throw new Invalid('unknown function');
}

async function route(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');
  if (path === '' && request.method === 'GET') return { data: { service: 'curly-entries' } };
  if (path === '/mech_entries') {
    if (request.method !== 'POST') return { status: 405, data: { error: 'use POST' } };
    return insert(env.DB, await readBody(request, MAX_PAYLOAD + 2000), env);
  }
  const m = /^\/rpc\/(mech_\w+)$/.exec(path);
  if (m) {
    if (request.method === 'POST') return rpc(env.DB, m[1], await readBody(request, 4096), request, env);
    if (request.method === 'GET') return rpc(env.DB, m[1], Object.fromEntries(url.searchParams), request, env);
    return { status: 405, data: { error: 'use GET or POST' } };
  }
  return { status: 404, data: { error: 'not found' } };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    const cors = { Vary: 'Origin' };
    if (origin !== null) {
      if (!allowed.includes(origin)) return json({ error: 'origin not allowed' }, 403, cors);
      cors['Access-Control-Allow-Origin'] = origin;
    }
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' } });
    }
    try {
      const { status = 200, data } = await route(request, env);
      return json(data, status, cors);
    } catch (e) {
      if (e instanceof Invalid) return json({ error: e.message }, 400, cors);
      console.error(e);
      return json({ error: 'server error' }, 500, cors);
    }
  },
};
