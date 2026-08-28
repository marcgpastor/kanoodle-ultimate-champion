/* Client del compte compartit.
   Mentre BASE estigui buit, la web funciona exactament com abans: tot el que
   té a veure amb el compte queda amagat i no es fa cap petició enlloc.

   El model és senzill: cada intent es distingeix per la seva data, així que
   dos navegadors es fusionen sols i pujar dues vegades el mateix no fa res. */

(function (root) {
'use strict';

// ← Enganxa-hi la URL del teu Worker, sense barra final.
//   Per exemple: 'https://kanoodle-api.elteusubdomini.workers.dev'
const BASE = 'https://kanoodle-api.marc-gp.workers.dev';

const PKEY = 'kanoodle.player.v1';   // { token, id, name }
const BKEY = 'kanoodle.board.v1';    // { at, players, times }
const SKEY = 'kanoodle.pending.v1';  // què queda per pujar
const AKEY = 'kanoodle.adminkey.v1';

const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// Funció i no objecte: si fos un objecte, les seves llistes s'acabarien
// compartint amb la cua i un push les embrutaria per sempre.
const fresh = () => ({ lastSyncAt: '', pushAll: true, delRuns: [], favAdd: [], favDel: [] });
const pending = () => Object.assign(fresh(), read(SKEY, null));
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
  setPending(fresh());                    // en entrar, puja tot el que ja tinguis
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
  // L'hora d'ara, no la de quan torni la resposta: el que apuntis mentre dura
  // la petició ha de quedar per damunt d'aquesta marca i pujar la propera volta.
  const startedAt = new Date().toISOString();

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

  // Buidem la cua abans de sortir, no en tornar: així el que marquis mentre la
  // petició és en vol s'hi acumula sol en comptes de quedar-hi soterrat. Si la
  // petició peta, tornem a posar-hi el que no ha arribat.
  setPending({ lastSyncAt: startedAt, pushAll: false, delRuns: [], favAdd: [], favDel: [] });

  let res;
  try {
    res = await call('/sync', { method: 'POST', body, token: player.token });
  } catch (err) {
    requeue(s);
    throw err;
  }

  if (res.board) write(BKEY, { at: Date.now(), players: res.board.players, times: res.board.times });
  return res;
}

/** torna a la cua el que no ha arribat, sense trepitjar el que s'hi ha afegit
    mentrestant: davant d'un mateix repte mana sempre la marca més nova */
function requeue(sent) {
  const now = pending();

  const key = r => r[0] + '|' + r[1];
  const delRuns = [...sent.delRuns];
  const vistos = new Set(delRuns.map(key));
  for (const r of now.delRuns) if (!vistos.has(key(r))) { vistos.add(key(r)); delRuns.push(r); }

  const favAdd = new Set(sent.favAdd), favDel = new Set(sent.favDel);
  for (const v of now.favAdd) { favAdd.add(v); favDel.delete(v); }
  for (const v of now.favDel) { favDel.add(v); favAdd.delete(v); }

  setPending({
    lastSyncAt: sent.lastSyncAt,
    pushAll: sent.pushAll || now.pushAll,
    delRuns,
    favAdd: [...favAdd],
    favDel: [...favDel],
  });
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
