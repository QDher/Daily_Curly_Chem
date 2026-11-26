// Validation of one entry of the test-run page (table mech_entries).

export const SITES = ['mechpilot'];
export const KINDS = ['arrows', 'drawing', 'votes', 'questionnaire', 'remark'];
export const LEVELS = ['undergraduate', 'graduate', 'postgraduate'];
export const MAX_PAYLOAD = 250000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class Invalid extends Error {}

// One entry as stored. testers: the labels allowed.
export function validRow(b, testers) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) throw new Invalid('body must be a JSON object');
  if (!SITES.includes(b.site)) throw new Invalid('invalid site');
  if (typeof b.visitor !== 'string' || !/^[0-9a-f]{8}$/.test(b.visitor)) throw new Invalid('invalid visitor');
  if (!testers.includes(b.visitor)) throw new Invalid('unknown visitor');
  if (typeof b.session !== 'string' || !UUID_RE.test(b.session)) throw new Invalid('invalid session');
  if (!Number.isInteger(b.seq) || b.seq < 0 || b.seq > 9999) throw new Invalid('invalid seq');
  if (!KINDS.includes(b.kind)) throw new Invalid('invalid kind');
  const task = b.task === undefined ? null : b.task;
  if (task !== null && (typeof task !== 'string' || task.length < 1 || task.length > 120)) throw new Invalid('invalid task');
  const lv = b.user_level === undefined ? null : b.user_level;
  if (lv !== null && !LEVELS.includes(lv)) throw new Invalid('invalid user_level');
  const p = b.payload;
  if (!p || typeof p !== 'object' || Array.isArray(p)) throw new Invalid('invalid payload');
  const payload = JSON.stringify(p);
  if (payload.length > MAX_PAYLOAD) throw new Invalid('payload too large');
  // summary columns are taken from the payload, so that they cannot disagree with it
  let accepted = null;
  if (b.kind === 'arrows') accepted = Number.isInteger(p.accepted) ? 1 : 0;
  if (b.kind === 'drawing') accepted = p.accepted === true ? 1 : 0;
  const flagged = b.kind === 'drawing' && p.flagged === 'wrong' ? 'wrong' : null;
  return { site: b.site, visitor: b.visitor, session: b.session.toLowerCase(), seq: b.seq, kind: b.kind, task, user_level: lv, accepted, flagged, payload };
}

export function isoTime(v) {
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
