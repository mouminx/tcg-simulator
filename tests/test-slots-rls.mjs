/**
 * Adversarial test of the slot schema: per-slot isolation, unique names, and the two new RPCs.
 *
 * Same principle as the first security suite — most of these are attacks that must be REFUSED, and a
 * check passes when the attack fails. Plain fetch, because that is what an attacker uses.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/** The repo root, derived from this file — the supabase CLI must run there to read the local stack's env. */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const env = Object.fromEntries(
  execFileSync('supabase', ['status', '-o', 'env'], { cwd: REPO_ROOT, encoding: 'utf8' })
    .split('\n').filter(Boolean)
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }),
);
const API = env.API_URL, ANON = env.ANON_KEY;

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

const api = (path, { token, method = 'GET', body, prefer } = {}) => fetch(`${API}${path}`, {
  method,
  headers: {
    apikey: ANON, Authorization: `Bearer ${token ?? ANON}`,
    'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}),
  },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

async function signUp(email, password, displayName) {
  const res = await api('/auth/v1/signup', { method: 'POST', body: { email, password, data: { display_name: displayName } } });
  return { res, json: await res.json() };
}

const stamp = Date.now();
/**
 * Player names are globally unique and this database persists between runs, so a fixed name passes once
 * and then collides with its own previous run. Stamped, and kept under the 24-character limit.
 */
const NAME_A = `Moum${stamp}`;
const NAME_A_UPPER = NAME_A.toUpperCase();
const NAME_B = `Ashf${stamp}`;
const NAME_B_NEW = `Ashn${stamp}`;
const NAME_FREE = `Free${stamp}`;

// ── Unique player names ──────────────────────────────────────────────────────
let { json: a } = await signUp(`slots-a-${stamp}@example.test`, 'password-one-1', NAME_A);
check('sign-up with a fresh player name succeeds', !!a.access_token, JSON.stringify(a).slice(0, 140));
const A = { token: a.access_token, id: a.user?.id };

let dup = await signUp(`slots-b-${stamp}@example.test`, 'password-two-2', NAME_A);
check('ATTACK REFUSED: an exact duplicate player name is rejected',
  !dup.json.access_token && /already taken/i.test(JSON.stringify(dup.json)),
  JSON.stringify(dup.json).slice(0, 140));

dup = await signUp(`slots-c-${stamp}@example.test`, 'password-two-2', NAME_A_UPPER);
check('ATTACK REFUSED: a case-variant name is rejected (impersonation)',
  !dup.json.access_token && /already taken/i.test(JSON.stringify(dup.json)),
  JSON.stringify(dup.json).slice(0, 140));

dup = await signUp(`slots-d-${stamp}@example.test`, 'password-two-2', 'Mou  minx');
check('REFUSED: a double-space name is rejected', !dup.json.access_token,
  JSON.stringify(dup.json).slice(0, 120));

dup = await signUp(`slots-e-${stamp}@example.test`, 'password-two-2', 'x');
check('REFUSED: a one-character name is rejected', !dup.json.access_token,
  JSON.stringify(dup.json).slice(0, 120));

// A failed signup must leave nothing behind — the email has to stay reusable.
const reuse = await signUp(`slots-b-${stamp}@example.test`, 'password-two-2', NAME_B);
check('a signup that failed on the name left no account behind (email reusable)',
  !!reuse.json.access_token, JSON.stringify(reuse.json).slice(0, 140));
const B = { token: reuse.json.access_token, id: reuse.json.user?.id };

// ── Availability check ──────────────────────────────────────────────────────
const avail = async (name, token) => {
  const r = await api('/rest/v1/rpc/is_display_name_available', { token, method: 'POST', body: { p_name: name } });
  return { status: r.status, value: await r.json() };
};
let v = await avail(NAME_A);
check('availability check reports a taken name as false (anonymously)', v.status === 200 && v.value === false, `${v.status} ${v.value}`);
v = await avail(NAME_FREE);
check('availability check reports a free name as true', v.status === 200 && v.value === true, `${v.status} ${v.value}`);
v = await avail(NAME_A.toLowerCase());
check('availability check is case-insensitive', v.value === false, `${v.value}`);
v = await avail('q');
check('availability check rejects an invalid name', v.value === false, `${v.value}`);

// ── No save rows at signup ──────────────────────────────────────────────────
let r = await api('/rest/v1/saves?select=slot', { token: A.token });
let body = await r.json();
check('a new account has NO save rows (slots are created on first write)',
  Array.isArray(body) && body.length === 0, JSON.stringify(body).slice(0, 100));

// ── save_game per slot ──────────────────────────────────────────────────────
const save = (token, slot, data, version, revision, meta) => api('/rest/v1/rpc/save_game', {
  token, method: 'POST',
  body: { p_slot: slot, p_data: data, p_save_version: version, p_revision: revision, p_meta: meta ?? {} },
});

r = await save(A.token, 2, { balance: 100 }, 23, 0, { cards: 5 });
body = await r.json();
check('writing slot 2 creates it at revision 1',
  r.status === 200 && body.slot === 2 && body.revision === 1, `status=${r.status} ${JSON.stringify(body).slice(0, 120)}`);

r = await save(A.token, 3, { balance: 300 }, 23, 0, { cards: 9 });
body = await r.json();
check('writing slot 3 creates it independently', r.status === 200 && body.slot === 3 && body.revision === 1,
  `slot=${body.slot} rev=${body.revision}`);

r = await api('/rest/v1/saves?select=slot,meta&order=slot', { token: A.token });
body = await r.json();
check('the account now lists exactly slots 2 and 3',
  body.length === 2 && body[0].slot === 2 && body[1].slot === 3, JSON.stringify(body.map(x => x.slot)));
check('meta round-tripped for the picker', body[0].meta?.cards === 5, JSON.stringify(body[0].meta));

r = await save(A.token, 4, { balance: 1 }, 23, 0);
check('REFUSED: slot 4 does not exist', r.status >= 400, `status=${r.status}`);
r = await save(A.token, 0, { balance: 1 }, 23, 0);
check('REFUSED: slot 0 does not exist', r.status >= 400, `status=${r.status}`);

// A revision claim against a slot that has never been written is out of step and must be refused.
r = await save(A.token, 1, { balance: 1 }, 23, 7);
body = await r.json();
check('REFUSED: claiming a revision for a non-existent slot is a conflict',
  r.status === 409, `status=${r.status} ${JSON.stringify(body).slice(0, 120)}`);

// Per-slot revisions must be independent.
r = await save(A.token, 2, { balance: 150 }, 23, 1);
body = await r.json();
check('slot 2 advances to revision 2', body.revision === 2, `rev=${body.revision}`);
r = await api('/rest/v1/saves?slot=eq.3&select=revision', { token: A.token });
body = await r.json();
check('slot 3 revision is untouched by slot 2 writes', body[0].revision === 1, `rev=${body[0].revision}`);

r = await save(A.token, 2, { balance: 999 }, 23, 1);
check('REFUSED: a stale revision on slot 2 is a 409', r.status === 409, `status=${r.status}`);

// ── Cross-account isolation, per slot ───────────────────────────────────────
r = await api(`/rest/v1/saves?user_id=eq.${A.id}&select=slot,data`, { token: B.token });
body = await r.json();
check("ATTACK REFUSED: B cannot read A's slots", Array.isArray(body) && body.length === 0,
  JSON.stringify(body).slice(0, 120));

r = await save(B.token, 2, { balance: 0, hacked: true }, 23, 0);
body = await r.json();
check("B writing its OWN slot 2 does not touch A's slot 2",
  r.status === 200 && body.revision === 1, `status=${r.status} rev=${body.revision}`);
r = await api('/rest/v1/saves?slot=eq.2&select=data', { token: A.token });
body = await r.json();
check("...and A's slot 2 still holds A's data", body[0].data.balance === 150 && !body[0].data.hacked,
  JSON.stringify(body[0].data).slice(0, 100));

r = await api(`/rest/v1/saves?user_id=eq.${A.id}&slot=eq.2`, {
  token: B.token, method: 'PATCH', body: { data: { balance: 0 } }, prefer: 'return=representation',
});
const patched = await r.text();
check("ATTACK REFUSED: B cannot PATCH A's slot directly",
  r.status === 403 || patched === '[]', `status=${r.status} ${patched.slice(0, 100)}`);

// ── delete_save ─────────────────────────────────────────────────────────────
r = await api('/rest/v1/rpc/delete_save', { token: A.token, method: 'POST', body: { p_slot: 3 } });
check('delete_save removes the slot', r.status === 200 || r.status === 204, `status=${r.status}`);
r = await api('/rest/v1/saves?select=slot&order=slot', { token: A.token });
body = await r.json();
check('only slot 2 remains for A', body.length === 1 && body[0].slot === 2, JSON.stringify(body.map(x => x.slot)));

r = await api('/rest/v1/rpc/delete_save', { method: 'POST', body: { p_slot: 2 } });
check('ATTACK REFUSED: anonymous cannot call delete_save', r.status >= 400, `status=${r.status}`);

r = await api('/rest/v1/saves?slot=eq.2&select=slot', { token: B.token });
body = await r.json();
check("...and A deleting slot 3 did not remove B's slot 2", body.length === 1, `B rows=${body.length}`);

// A freed slot can be created again.
r = await save(A.token, 3, { balance: 7 }, 23, 0);
body = await r.json();
check('a deleted slot can be recreated at revision 1', r.status === 200 && body.revision === 1,
  `status=${r.status} rev=${body.revision}`);

// ── Profile name update stays unique ────────────────────────────────────────
r = await api(`/rest/v1/profiles?id=eq.${B.id}`, {
  token: B.token, method: 'PATCH', body: { display_name: NAME_A }, prefer: 'return=representation',
});
check('ATTACK REFUSED: renaming yourself to a taken name fails', r.status >= 400, `status=${r.status}`);

r = await api(`/rest/v1/profiles?id=eq.${B.id}`, {
  token: B.token, method: 'PATCH', body: { display_name: NAME_B_NEW }, prefer: 'return=representation',
});
body = await r.json();
check('renaming to a free name works', r.status === 200 && body[0]?.display_name === NAME_B_NEW,
  JSON.stringify(body).slice(0, 100));


// ── Direct table writes must be impossible (folded in from the pre-slots suite) ──
// These are the checks that do not involve save_game at all: the security model is that a client holds
// no write privilege on `saves` whatsoever, so every one of these must be refused at the table.
r = await api('/rest/v1/saves?select=user_id,slot', { token: A.token });
body = await r.json();
check('an unfiltered select returns only the caller\'s own rows',
  body.every(row => row.user_id === A.id), `${body.length} rows, ids=${[...new Set(body.map(x => x.user_id))].length}`);

r = await api(`/rest/v1/saves?user_id=eq.${A.id}&slot=eq.2`, {
  token: A.token, method: 'PATCH', body: { data: { balance: 999999999 } }, prefer: 'return=representation',
});
let txt = await r.text();
check('ATTACK REFUSED: A cannot PATCH its OWN save row directly',
  r.status === 403 || r.status === 401 || txt === '[]', `status=${r.status} ${txt.slice(0, 110)}`);
r = await api('/rest/v1/saves?slot=eq.2&select=data', { token: A.token });
body = await r.json();
check('...and the save is genuinely unchanged', body[0].data.balance !== 999999999,
  JSON.stringify(body[0].data).slice(0, 80));

r = await api('/rest/v1/saves', {
  token: A.token, method: 'POST', body: { user_id: A.id, slot: 1, data: { balance: 1e9 }, save_version: 23 },
});
check('ATTACK REFUSED: A cannot INSERT a save row', r.status === 403 || r.status === 401, `status=${r.status}`);

r = await api(`/rest/v1/saves?user_id=eq.${A.id}&slot=eq.2`, { token: A.token, method: 'DELETE' });
check('ATTACK REFUSED: A cannot DELETE a save row directly (delete_save exists for that)',
  r.status === 403 || r.status === 401, `status=${r.status}`);

// PostgREST resolves an RPC by its exact argument set, so a smuggled user id must not resolve at all.
r = await api('/rest/v1/rpc/save_game', {
  token: A.token, method: 'POST',
  body: { p_slot: 2, p_data: { balance: 1e9 }, p_save_version: 23, p_revision: 0, p_user_id: B.id, user_id: B.id },
});
check('ATTACK REFUSED: extra user-id arguments do not reach save_game', r.status >= 400,
  `status=${r.status} (unknown args must not be silently ignored)`);

// ── Anonymous callers get nothing ──
r = await api('/rest/v1/saves?select=user_id');
body = await r.json();
check('ATTACK REFUSED: an anonymous caller reads no saves',
  !Array.isArray(body) || body.length === 0, JSON.stringify(body).slice(0, 90));

r = await api('/rest/v1/profiles?select=display_name');
body = await r.json();
check('ATTACK REFUSED: display names are not an anonymous public directory',
  !Array.isArray(body) || body.length === 0, JSON.stringify(body).slice(0, 90));

r = await api('/rest/v1/rpc/save_game', {
  method: 'POST', body: { p_slot: 1, p_data: { balance: 1e9 }, p_save_version: 23, p_revision: 0 },
});
check('ATTACK REFUSED: an anonymous caller cannot execute save_game', r.status >= 400, `status=${r.status}`);

// ── Shape and size guards ──
r = await save(A.token, 2, [1, 2, 3], 23, null);
check('REFUSED: a JSON array is not a valid save', r.status >= 400, `status=${r.status}`);
r = await save(A.token, 2, { junk: 'x'.repeat(5 * 1024 * 1024) }, 23, null);
check('REFUSED: an oversized save is rejected', r.status >= 400, `status=${r.status}`);
r = await save(A.token, 2, { balance: 1 }, 23, null, { blob: 'y'.repeat(8192) });
check('REFUSED: oversized picker meta is rejected', r.status >= 400, `status=${r.status}`);
r = await save(A.token, 2, { balance: 1 }, 23, null, [1, 2]);
check('REFUSED: non-object picker meta is rejected', r.status >= 400, `status=${r.status}`);

const finalRows = await (await api('/rest/v1/saves?select=slot&order=slot', { token: A.token })).json();
check('after every rejected write A still has exactly the slots it should',
  JSON.stringify(finalRows.map(x => x.slot)) === JSON.stringify([2, 3]),
  JSON.stringify(finalRows.map(x => x.slot)));

const failed = results.filter(x => !x.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.log('FAILURES:');
  failed.forEach(f => console.log(`  - ${f.name}: ${f.detail}`));
  process.exit(1);
}
