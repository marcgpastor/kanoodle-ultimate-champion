/* API de la classificació de Kanoodle.
   Cloudflare Worker + D1. Només s'hi entra amb invitació: no hi ha cap
   formulari de registre obert, i qui no tingui un testimoni vàlid no pot ni
   llegir ni escriure res. */

const MAX_PUZZLE = 500;
const MAX_MS = 24 * 3600 * 1000;
const MAX_NAME = 24;

/* ---------------- ajudes ---------------- */

const json = (data, status, headers) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });

function withCors(res, cors) {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(cors)) headers.set(k, v);
  return new Response(res.body, { status: res.status, headers });
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!allowed.includes(origin)) return { vary: 'Origin' };
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-headers': 'content-type, authorization, x-admin-key',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}

async function sha256hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** comparació sense fuites de temps, per a la clau d'administració */
function sameSecret(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const cleanName = v => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, MAX_NAME);

async function playerFrom(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return null;
  return env.DB.prepare(
    'SELECT id, name, joined_at FROM players WHERE token_hash = ? AND revoked = 0'
  ).bind(await sha256hex(token)).first();
}

const isAdmin = (request, env) =>
  sameSecret(request.headers.get('X-Admin-Key') || '', env.ADMIN_KEY || ' ');

/* ---------------- rutes ---------------- */

async function join(request, env) {
  const body = await request.json().catch(() => ({}));
  const token = String(body.token || '').trim();
  if (!token) return json({ error: 'falta el testimoni' }, 400);

  const row = await env.DB.prepare(
    'SELECT id, name, joined_at FROM players WHERE token_hash = ? AND revoked = 0'
  ).bind(await sha256hex(token)).first();
  if (!row) return json({ error: 'invitacio no valida' }, 401);

  const name = cleanName(body.name) || row.name;
  await env.DB.prepare(
    'UPDATE players SET name = ?, joined_at = COALESCE(joined_at, ?) WHERE id = ?'
  ).bind(name, new Date().toISOString(), row.id).run();

  return json({ id: row.id, name });
}

async function putTimes(request, env, player) {
  const body = await request.json().catch(() => ({}));
  const entries = Object.entries(body.times || {}).slice(0, 600);
  const now = new Date().toISOString();
  const stmt = env.DB.prepare(
    'INSERT INTO times (player_id, puzzle, ms, at) VALUES (?, ?, ?, ?) ' +
    'ON CONFLICT(player_id, puzzle) DO UPDATE SET ms = excluded.ms, at = excluded.at ' +
    'WHERE excluded.ms < times.ms'
  );
  const batch = [];
  for (const [p, v] of entries) {
    const puzzle = Number(p), ms = Math.round(Number(v));
    if (!Number.isInteger(puzzle) || puzzle < 1 || puzzle > MAX_PUZZLE) continue;
    if (!Number.isFinite(ms) || ms < 1 || ms > MAX_MS) continue;
    batch.push(stmt.bind(player.id, puzzle, ms, now));
  }
  if (batch.length) await env.DB.batch(batch);
  return json({ saved: batch.length });
}

async function board(env) {
  const players = await env.DB.prepare(
    'SELECT id, name FROM players WHERE joined_at IS NOT NULL AND revoked = 0 ORDER BY id'
  ).all();
  const times = await env.DB.prepare(
    'SELECT t.puzzle, t.player_id, t.ms FROM times t ' +
    'JOIN players p ON p.id = t.player_id ' +
    'WHERE p.joined_at IS NOT NULL AND p.revoked = 0'
  ).all();
  return json({
    players: players.results.map(p => [p.id, p.name]),
    times: times.results.map(t => [t.puzzle, t.player_id, t.ms]),
  });
}

async function adminInvite(request, env) {
  const body = await request.json().catch(() => ({}));
  const name = cleanName(body.name) || 'Convidat';
  const token = newToken();
  const res = await env.DB.prepare(
    'INSERT INTO players (name, token_hash, created_at) VALUES (?, ?, ?)'
  ).bind(name, await sha256hex(token), new Date().toISOString()).run();
  return json({ id: res.meta.last_row_id, name, token });
}

async function adminPlayers(env) {
  const rows = await env.DB.prepare(
    'SELECT p.id, p.name, p.created_at, p.joined_at, p.revoked, ' +
    '(SELECT COUNT(*) FROM times t WHERE t.player_id = p.id) AS times ' +
    'FROM players p ORDER BY p.id'
  ).all();
  return json({ players: rows.results });
}

async function adminUpdate(request, env, remove) {
  const body = await request.json().catch(() => ({}));
  const id = Number(body.id);
  if (!Number.isInteger(id)) return json({ error: 'id no valid' }, 400);
  if (remove) {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM times WHERE player_id = ?').bind(id),
      env.DB.prepare('DELETE FROM players WHERE id = ?').bind(id),
    ]);
  } else {
    await env.DB.prepare('UPDATE players SET revoked = ? WHERE id = ?')
      .bind(body.revoked ? 1 : 0, id).run();
  }
  return json({ ok: true });
}

/* ---------------- entrada ---------------- */

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.headers.get('Origin') && !cors['access-control-allow-origin'])
      return json({ error: 'origen no permes' }, 403, cors);

    const path = new URL(request.url).pathname.replace(/\/+$/, '') || '/';
    const post = request.method === 'POST';

    try {
      if (path === '/' || path === '/salut') return json({ ok: true }, 200, cors);

      if (path.startsWith('/admin/')) {
        if (!isAdmin(request, env)) return json({ error: 'clau incorrecta' }, 401, cors);
        if (post && path === '/admin/invite') return withCors(await adminInvite(request, env), cors);
        if (path === '/admin/players') return withCors(await adminPlayers(env), cors);
        if (post && path === '/admin/revoke') return withCors(await adminUpdate(request, env, false), cors);
        if (post && path === '/admin/delete') return withCors(await adminUpdate(request, env, true), cors);
        return json({ error: 'no existeix' }, 404, cors);
      }

      if (post && path === '/join') return withCors(await join(request, env), cors);

      const player = await playerFrom(request, env);
      if (!player || !player.joined_at) return json({ error: 'cal una invitacio' }, 401, cors);

      if (path === '/me') return json({ id: player.id, name: player.name }, 200, cors);
      if (post && path === '/times') return withCors(await putTimes(request, env, player), cors);
      if (path === '/board') return withCors(await board(env), cors);

      return json({ error: 'no existeix' }, 404, cors);
    } catch (err) {
      return json({ error: 'error del servidor' }, 500, cors);
    }
  },
};
