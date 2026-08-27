/* Client del compte compartit.
   Mentre BASE estigui buit, la web funciona exactament com abans: tot el que
   té a veure amb el compte queda amagat i no es fa cap petició enlloc.

   El model és senzill: cada intent es distingeix per la seva data, així que
   dos navegadors es fusionen sols i pujar dues vegades el mateix no fa res. */

(function (root) {
'use strict';

// ← Enganxa-hi la URL del teu Worker, sense barra final.
//   Per exemple: 'https://kanoodle-api.elteusubdomini.workers.dev'
const BASE = '';

const PKEY = 'kanoodle.player.v1';   // { token, id, name }
const BKEY = 'kanoodle.board.v1';    // { at, players, times }
const SKEY = 'kanoodle.pending.v1';  // què queda per pujar
const AKEY = 'kanoodle.adminkey.v1';

const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} };

const FRESH = { lastSyncAt: '', pushAll: true, delRuns: [], favAdd: [], favDel: [] };
const pending = () => Object.assign({}, FRESH, read(SKEY, null));
const setPending = v => write(SKEY, v);

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
  setPending(Object.assign({}, FRESH));   // en entrar, puja tot el que ja tinguis
  return player;
}

function logout() {
  player = null;
  write(PKEY, null);
  write(BKEY, null);
  write(SKEY, null);
}

/** l'enllaç per continuar amb aquest mateix compte en un altre navegador */
const myLink = () => player
  ? location.origin + location.pathname + '#entra=' + player.token
  : null;

/* ---------------- coses pendents de pujar ---------------- */

function markFav(puzzle, on) {
  const s = pending();
  const add = new Set(s.favAdd), del = new Set(s.favDel);
  if (on) { add.add(puzzle); del.delete(puzzle); }
  else { del.add(puzzle); add.delete(puzzle); }
  s.favAdd = [...add]; s.favDel = [...del];
  setPending(s);
}

function markRunDeleted(puzzle, at) {
  const s = pending();
  s.delRuns.push([puzzle, at]);
  setPending(s);
}

/** després d'importar un fitxer les dates són velles: cal repassar-ho tot */
function markEverything() {
  const s = pending();
  s.pushAll = true;
  setPending(s);
}

/* ---------------- sincronitzar ---------------- */

/**
 * `local` és { store, favs, sessions } tal com els té la pàgina.
 * Amb `full` es torna a baixar tot el teu historial; sense, només la
 * classificació. Torna la resposta del servidor, o null si no toca.
 */
async function sync(local, full) {
  if (!enabled() || !player) return null;
  const s = pending();
  const since = s.pushAll ? '' : s.lastSyncAt;

  const addRuns = [];
  for (const puzzle of Object.keys(local.store || {}))
    for (const r of local.store[puzzle])
      if (!since || r.d > since) addRuns.push([Number(puzzle), r.t, r.d]);

  const addSessions = (local.sessions || []).filter(x => x && (!since || x.startedAt > since));

  const body = {
    full: !!full,
    addRuns,
    delRuns: s.delRuns,
    favAdd: s.pushAll ? [...(local.favs || [])] : s.favAdd,
    favDel: s.favDel,
    addSessions,
  };

  const res = await call('/sync', { method: 'POST', body, token: player.token });

  setPending({ lastSyncAt: new Date().toISOString(), pushAll: false, delRuns: [], favAdd: [], favDel: [] });
  if (res.board) write(BKEY, { at: Date.now(), players: res.board.players, times: res.board.times });
  return res;
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
  enabled, me, join, logout, myLink,
  markFav, markRunDeleted, markEverything,
  sync, board,
  adminKey, setAdminKey, invite, players, revoke, remove,
};

})(typeof globalThis !== 'undefined' ? globalThis : this);
