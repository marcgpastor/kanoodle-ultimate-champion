/* Client de la classificació.
   Mentre BASE estigui buit, la web funciona exactament com abans: tot el que
   té a veure amb competir queda amagat i no es fa cap petició enlloc. */

(function (root) {
'use strict';

// ← Enganxa-hi la URL del teu Worker, sense barra final.
//   Per exemple: 'https://kanoodle-api.elteusubdomini.workers.dev'
const BASE = '';

const PKEY = 'kanoodle.player.v1';   // { token, id, name }
const BKEY = 'kanoodle.board.v1';    // { at, players, times }
const QKEY = 'kanoodle.queue.v1';    // reptes pendents de pujar
const AKEY = 'kanoodle.adminkey.v1';

const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} };

let player = read(PKEY, null);

async function call(path, { method = 'GET', body, token, adminKey } = {}) {
  const headers = {};
  if (body) headers['content-type'] = 'application/json';
  if (token) headers.authorization = 'Bearer ' + token;
  if (adminKey) headers['x-admin-key'] = adminKey;
  const res = await fetch(BASE + path, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const err = new Error((data && data.error) || 'error ' + res.status);
    err.status = res.status;
    throw err;
  }
  return data;
}

/* ---------------- sessió ---------------- */

const enabled = () => !!BASE;
const me = () => player;

async function join(token, name) {
  const res = await call('/join', { method: 'POST', body: { token, name } });
  player = { token, id: res.id, name: res.name };
  write(PKEY, player);
  queueAll();                       // en entrar, puja tot el que ja tenies
  return player;
}

function logout() {
  player = null;
  write(PKEY, null);
  write(BKEY, null);
  write(QKEY, null);
}

/* ---------------- pujar i baixar ---------------- */

const queued = () => read(QKEY, []);

/** marca un repte perquè es pugi a la propera ocasió */
function queue(puzzle) {
  const q = new Set(queued());
  q.add(Number(puzzle));
  write(QKEY, [...q]);
}

/** marca'ls tots: serveix en entrar i quan una pujada ha fallat de mala manera */
function queueAll() {
  write(QKEY, Array.from({ length: 500 }, (_, i) => i + 1));
}

/**
 * Puja els temps pendents i torna a baixar la classificació.
 * `bestOf(puzzle)` ha de tornar el teu millor temps en ms, o null.
 * Si no hi ha xarxa no passa res: els pendents s'hi queden per a la propera.
 */
async function sync(bestOf) {
  if (!enabled() || !player) return null;
  const pending = queued();
  if (pending.length) {
    const times = {};
    for (const p of pending) {
      const ms = bestOf(p);
      if (ms) times[p] = ms;
    }
    // els reptes pendents sense temps no cal tornar-los a mirar
    await call('/times', { method: 'POST', body: { times }, token: player.token });
    write(QKEY, []);
  }
  const data = await call('/board', { token: player.token });
  const board = { at: Date.now(), players: data.players, times: data.times };
  write(BKEY, board);
  return board;
}

/** l'última classificació que s'ha baixat; serveix també sense connexió */
const board = () => read(BKEY, null);

/* ---------------- administració ---------------- */

const adminKey = () => read(AKEY, '') || '';
const setAdminKey = k => write(AKEY, k || null);

const invite = name => call('/admin/invite', { method: 'POST', body: { name }, adminKey: adminKey() });
const players = () => call('/admin/players', { adminKey: adminKey() });
const revoke = (id, r) => call('/admin/revoke', { method: 'POST', body: { id, revoked: r ? 1 : 0 }, adminKey: adminKey() });
const remove = id => call('/admin/delete', { method: 'POST', body: { id }, adminKey: adminKey() });

root.KanoodleAPI = {
  enabled, me, join, logout, queue, queueAll, queued, sync, board,
  adminKey, setAdminKey, invite, players, revoke, remove,
};

})(typeof globalThis !== 'undefined' ? globalThis : this);
