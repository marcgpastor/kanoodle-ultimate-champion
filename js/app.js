/* Kanoodle Ultimate Champion — índex de reptes, cronòmetre i estadístiques. Sense dependències. */
(() => {
'use strict';

const TKEY = 'kanoodle.times.v1';
const FKEY = 'kanoodle.favs.v1';
const PKEY = 'kanoodle.prefs.v1';
const SKEY = 'kanoodle.session.v1';    // sessió en curs
const HKEY = 'kanoodle.sessions.v1';   // sessions acabades

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = (t, c, txt) => { const n = document.createElement(t); if (c) n.className = c; if (txt != null) n.textContent = txt; return n; };

let DATA = null;
let DIFF = {};               // reptes -> peces que has de col·locar (1–10)
let filter = 'all';
let diffFilter = 'all';
let current = null;          // número del repte obert
let indexScroll = 0;

/* ---------------- què hi ha desat ---------------- */

const read = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { toast('No s’ha pogut desar res en aquest navegador.'); } };

let store = {};              // { "147": [{t, d}] }
let favs  = new Set();
let session = null;          // { ids, idx, results, startedAt }
const solutions = {};        // repte -> solució del resolutor (o null)
const API = root_api();
function root_api() { return typeof KanoodleAPI !== 'undefined' ? KanoodleAPI : null; }
let shownHints = new Set();  // lletres de les peces revelades ara mateix
let sessionLog = [];         // sessions acabades
let prefs = { mode: 'up', target: 180000, sound: true, autoTarget: true };

const saveTimes = () => write(TKEY, store);
const saveFavs  = () => write(FKEY, [...favs]);
const saveSession = () => session ? write(SKEY, session) : localStorage.removeItem(SKEY);
const saveLog = () => write(HKEY, sessionLog);
const savePrefs = () => write(PKEY, prefs);

const runs = n => store[n] || [];
const best = n => { const r = runs(n); return r.length ? Math.min(...r.map(x => x.t)) : null; };
const done = n => runs(n).length > 0;
const fav  = n => favs.has(n);

function addRun(n, ms) {
  const prev = best(n);
  (store[n] = store[n] || []).push({ t: ms, d: new Date().toISOString() });
  saveTimes();
  return prev === null || ms < prev;
}

/* ---------------- format ---------------- */

function fmt(ms, tenths = true) {
  const neg = ms < 0; ms = Math.abs(Math.round(ms));
  const h = Math.floor(ms / 3600000), m = Math.floor(ms % 3600000 / 60000);
  const s = Math.floor(ms % 60000 / 1000), d = Math.floor(ms % 1000 / 100);
  const p = (v, k = 2) => String(v).padStart(k, '0');
  let out = h ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
  if (tenths && !h) out += '.' + d;
  return (neg ? '-' : '') + out;
}

// "1:23.4" | "1:23" | "83" | "83,5" | "1:02:03"  ->  ms
function parseTime(raw) {
  const t = raw.trim().replace(',', '.');
  if (!/^\d+(:\d{1,2}){0,2}(\.\d{1,3})?$/.test(t)) return null;
  const [whole, frac = ''] = t.split('.');
  const parts = whole.split(':').map(Number);
  if (parts.some(isNaN)) return null;
  let sec = 0;
  for (const p of parts) sec = sec * 60 + p;
  return sec * 1000 + Number((frac + '000').slice(0, 3));
}

const dateLabel = iso => new Date(iso).toLocaleDateString('ca-ES', { day: 'numeric', month: 'short', year: 'numeric' });
const dayKey    = d => new Date(d).toISOString().slice(0, 10);

/* ---------------- dibuix dels reptes ---------------- */

const SVGNS = 'http://www.w3.org/2000/svg';
const svgEl = (t, attrs) => { const n = document.createElementNS(SVGNS, t); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };

function gloss(defs) {
  const g = svgEl('radialGradient', { id: 'gloss', cx: '.35', cy: '.28', r: '.75' });
  g.append(svgEl('stop', { offset: '0', 'stop-color': '#fff', 'stop-opacity': '.42' }),
           svgEl('stop', { offset: '.55', 'stop-color': '#fff', 'stop-opacity': '.04' }),
           svgEl('stop', { offset: '1', 'stop-color': '#000', 'stop-opacity': '.2' }));
  defs.append(g);
}

/** una boleta: buida, amb peça del diagrama, o fantasma si ve d'una pista */
function ball(g, cx, cy, r, letter, ghost) {
  if (letter === '.') {
    g.append(svgEl('circle', { cx, cy, r, fill: '#241E1B', stroke: '#3D3532', 'stroke-width': r * .1 }));
    return;
  }
  if (ghost) {
    g.append(svgEl('circle', { cx, cy, r, fill: '#241E1B' }));
    g.append(svgEl('circle', {
      cx, cy, r: r * .93, fill: DATA.colors[letter], 'fill-opacity': .38,
      stroke: DATA.colors[letter], 'stroke-width': r * .13,
      'stroke-dasharray': `${r * .42} ${r * .3}`
    }));
  } else {
    g.append(svgEl('circle', { cx, cy, r, fill: DATA.colors[letter], stroke: '#100C0A', 'stroke-width': r * .09 }));
    g.append(svgEl('circle', { cx, cy, r, fill: 'url(#gloss)' }));
  }
  const t = svgEl('text', {
    x: cx, y: cy, fill: ghost ? DATA.colors[letter] : '#16110F',
    'fill-opacity': ghost ? .95 : 1,
    'text-anchor': 'middle', 'dominant-baseline': 'central',
    'font-family': 'IBM Plex Sans, sans-serif', 'font-weight': '600', 'font-size': r * 1.15
  });
  t.textContent = letter;
  g.append(t);
}

function draw2D(rows, ghosts) {
  const P = 1, R = .45, PAD = .42;
  const w = 11 * P + PAD * 2, h = 5 * P + PAD * 2;
  const svg = svgEl('svg', { viewBox: `0 0 ${w} ${h}`, role: 'img', 'aria-label': 'Diagrama del tauler' });
  const defs = svgEl('defs', {}); gloss(defs); svg.append(defs);
  svg.append(svgEl('rect', { x: 0, y: 0, width: w, height: h, rx: .55, fill: '#0B0807' }));
  const g = svgEl('g', {});
  rows.forEach((row, r) => [...row].forEach((ch, c) => {
    const id = r * 11 + c;
    const gh = ghosts && ghosts.get(id);
    ball(g, PAD + c * P + P / 2, PAD + r * P + P / 2, R, gh || ch, !!gh && ch === '.');
  }));
  svg.append(g);
  return svg;
}

function draw3D(layers, ghosts) {
  const tpl = DATA.tpl3d, LEAD = .13;           // espai per a l'etiqueta de cada capa
  const W = 1 + LEAD, H = tpl.h + .06;
  const svg = svgEl('svg', { viewBox: `${-LEAD} -.03 ${W} ${H}`, role: 'img', 'aria-label': 'Diagrama de la piràmide' });
  const defs = svgEl('defs', {}); gloss(defs); svg.append(defs);
  const g = svgEl('g', {});
  let row = 0, id = 0;
  layers.forEach((layer, li) => {
    const first = tpl.rows[row];
    const label = svgEl('text', {
      x: -LEAD * .35, y: first[0][1], fill: '#6E635E', 'text-anchor': 'middle', 'dominant-baseline': 'central',
      'font-family': 'IBM Plex Mono, monospace', 'font-weight': '600', 'font-size': .05
    });
    label.textContent = `${li + 1}×${li + 1}`;
    g.append(label);
    layer.forEach(line => {
      const geo = tpl.rows[row++];
      [...line].forEach((ch, i) => {
        const gh = ghosts && ghosts.get(id);
        ball(g, geo[i][0], geo[i][1], geo[i][2], gh || ch, !!gh && ch === '.');
        id++;
      });
    });
  });
  svg.append(g);
  return svg;
}

function drawPiece(letter) {
  const cells = DATA.shapes[letter];
  const h = Math.max(...cells.map(c => c[0])) + 1, w = Math.max(...cells.map(c => c[1])) + 1;
  const svg = svgEl('svg', { viewBox: `-.05 -.05 ${w + .1} ${h + .1}` });
  const defs = svgEl('defs', {}); gloss(defs); svg.append(defs);
  const g = svgEl('g', {});
  for (const [r, c] of cells) ball(g, c + .5, r + .5, .5, letter);
  svg.append(g);
  return svg;
}

/* ---------------- dades d'un repte ---------------- */

const is3D    = n => n >= 251;
const layout  = n => is3D(n) ? DATA.p3d[n] : DATA.p2d[n];
const letters = n => {
  const flat = is3D(n) ? layout(n).flat().join('') : layout(n).join('');
  return new Set([...flat].filter(ch => ch !== '.'));
};

const DIFF_BANDS = { easy: [1, 4], mid: [5, 6], hard: [7, 12] };

function computeDifficulty() {
  for (let n = 1; n <= 500; n++) DIFF[n] = 12 - letters(n).size;
}

/** anell de la boleta: com més clar, més peces has de col·locar */
const ringColor = d => `color-mix(in srgb, #F4EFE9 ${4 + d * 8}%, #3D3532)`;

/* ---------------- índex ---------------- */

const BEADS = ['#00ADEF', '#98D320', '#F0E406', '#F03BA6', '#F79806', '#7ED5E5',
               '#EF3338', '#F694CF', '#5E54AE', '#DAEE94', '#C8C0B6', '#FFFFFF'];

function passes(n) {
  if (diffFilter !== 'all') {
    const [lo, hi] = DIFF_BANDS[diffFilter];
    if (DIFF[n] < lo || DIFF[n] > hi) return false;
  }
  if (filter === '2d')   return !is3D(n);
  if (filter === '3d')   return is3D(n);
  if (filter === 'done') return done(n);
  if (filter === 'todo') return !done(n);
  if (filter === 'fav')  return fav(n);
  return true;
}

function renderIndex() {
  const host = $('#main');
  host.textContent = '';
  const racks = [
    { title: 'Reptes 2D', sub: 'Tauler pla · 1–250', from: 1,   to: 250 },
    { title: 'Reptes 3D', sub: 'Piràmide · 251–500', from: 251, to: 500 },
  ];
  let shown = 0;
  for (const rk of racks) {
    const nums = [];
    for (let n = rk.from; n <= rk.to; n++) if (passes(n)) nums.push(n);
    if (!nums.length) continue;
    shown += nums.length;
    const sec = el('section', 'rack' + (nums.some(done) ? ' rack--timed' : ''));
    const head = el('div', 'rack__head');
    head.append(el('b', null, rk.title), el('span', null, rk.sub), el('span', null, `${nums.length} visibles`));
    const grid = el('div', 'rack__grid');
    for (const n of nums) grid.append(bead(n));
    sec.append(head, grid);
    host.append(sec);
  }
  if (!shown) {
    const msg = diffFilter !== 'all'
      ? 'Cap repte encaixa amb aquests dos filtres alhora.'
      : filter === 'fav'
      ? 'Cap favorit encara. Obre un repte i toca l’estrella per tenir-lo a mà.'
      : filter === 'done'
        ? 'Encara no has desat cap temps. Tria un repte i cronometra’l.'
        : 'Els has fet tots. Impressionant.';
    host.append(el('p', 'empty', msg));
  }
  renderScoreboard();
  paintSessionButton();
}

function paintSessionButton() {
  const b = $('#startsession');
  if (session) {
    b.textContent = `Continua la sessió · ${session.idx + 1}/${session.ids.length}`;
    b.classList.add('btn--accent');
    b.classList.remove('btn--ghost');
  } else {
    b.textContent = 'Mode sessió';
    b.classList.add('btn--ghost');
    b.classList.remove('btn--accent');
  }
}

function bead(n) {
  const b = el('button', 'bead');
  b.type = 'button';
  b.textContent = n;
  b.dataset.n = n;
  if (fav(n)) b.classList.add('is-fav');
  const d = DIFF[n];
  const t = best(n);
  if (t !== null) {
    b.classList.add('is-done');
    b.style.setProperty('--bead', BEADS[n % BEADS.length]);
    b.append(el('span', 'bead__time', fmt(t, false)));
  } else {
    b.style.borderColor = ringColor(d);
  }
  b.title = `Repte ${n} · ${d} ${d === 1 ? 'peça' : 'peces'} per col·locar`;
  b.setAttribute('aria-label',
    `Repte ${n}, ${d} ${d === 1 ? 'peça' : 'peces'} per col·locar` +
    `${t !== null ? `, millor temps ${fmt(t)}` : ', pendent'}${fav(n) ? ', favorit' : ''}`);
  return b;
}

function renderScoreboard() {
  const solved = [];
  for (let n = 1; n <= 500; n++) if (done(n)) solved.push(n);
  const total = solved.reduce((a, n) => a + best(n), 0);
  const sb = $('#scoreboard');
  sb.textContent = '';
  const item = (label, value, accent) => {
    const d = el('div'), dd = el('dd');
    if (accent) dd.append(el('b', null, value), document.createTextNode(accent));
    else dd.textContent = value;
    d.append(dd, el('dt', null, label));
    return d;
  };
  sb.append(item('Reptes fets', String(solved.length), ' / 500'));
  sb.append(item('Temps acumulat', solved.length ? fmt(total, false) : '—'));
  if (solved.length) sb.append(item('Mitjana', fmt(total / solved.length, false)));
}

/* ---------------- vista de repte ---------------- */

function openLevel(n, push = true) {
  n = Math.min(500, Math.max(1, n | 0));
  if (current === null) indexScroll = window.scrollY;
  current = n;
  elapsed = 0; stopTimer(); paintClock();

  $('#lv-num').textContent  = n;
  $('#lv-kind').textContent = is3D(n) ? '3D' : '2D';
  $('#lv-diff').textContent = `${DIFF[n]} ${DIFF[n] === 1 ? 'peça' : 'peces'}`;
  document.title = `Repte ${n} — Kanoodle Ultimate Champion`;
  paintFav();

  const note = DATA.notes[n];
  $('#lv-note').hidden = !note;
  if (note) $('#lv-note').textContent = note;

  shownHints = new Set();
  paintDiagram();

  $('#lv-caption').hidden = !is3D(n);
  if (is3D(n)) $('#lv-caption').textContent = 'La capa 5×5 és la base de la piràmide; la 1×1, el cim.';

  const placed = letters(n);
  const todo = Object.keys(DATA.shapes).filter(L => !placed.has(L));
  $('#lv-pcount').textContent = `— ${todo.length} de 12`;
  const pieces = $('#lv-pieces');
  pieces.textContent = '';
  if (!todo.length) pieces.append(el('p', 'empty', 'Cap: el diagrama ja és complet.'));
  for (const L of todo) {
    const p = el('button', 'piece');
    p.type = 'button';
    p.dataset.piece = L;
    p.title = `Ensenya’m on va la peça ${L}`;
    p.append(drawPiece(L), el('span', null, L));
    p.onclick = () => toggleHint(L);
    pieces.append(p);
  }
  $('#hintbar').hidden = !todo.length;

  $('#prev').disabled = n === 1;
  $('#next').disabled = n === 500;

  renderTimes();
  renderPresets();
  applyTarget();
  paintSession();
  paintHints();
  paintRivals();
  show('level');
  if (push && location.hash !== '#' + n) location.hash = '#' + n;
  window.scrollTo(0, 0);
}

function paintFav() {
  $('#fav').setAttribute('aria-pressed', String(fav(current)));
  $('#fav').title = fav(current) ? 'Treu-lo dels favorits' : 'Marca’l com a favorit';
}

function renderTimes() {
  const list = $('#lv-times');
  list.textContent = '';
  $('#lv-spark').textContent = '';
  const rs = runs(current).map((r, i) => ({ ...r, i }));
  if (!rs.length) { list.append(el('li', 'empty', 'Cap temps desat encara.')); return; }
  if (rs.length >= 2) $('#lv-spark').append(sparkline(rs));

  [...rs].sort((a, b) => a.t - b.t).forEach((r, rank) => {
    const li = el('li', rank === 0 ? 'times__best' : '');
    li.append(el('span', 'times__val', fmt(r.t)));
    li.append(el('span', 'times__date', dateLabel(r.d)));
    if (rank === 0) li.append(el('span', 'times__date', 'millor'));
    const del = el('button', 'times__del', '✕');
    del.type = 'button';
    del.title = 'Esborra aquest temps';
    del.onclick = () => {
      store[current].splice(r.i, 1);
      if (!store[current].length) delete store[current];
      saveTimes();
      if (playing()) { API.markRunDeleted(current, r.d); syncNow(); }
      renderTimes();
    };
    li.append(del);
    list.append(li);
  });
}

/** diferència respecte al rècord anterior, curta de llegir */
function fmtDelta(ms) {
  return ms < 60000 ? (ms / 1000).toFixed(1).replace('.', ',') + ' s' : fmt(ms, false);
}

/** evolució dels intents d'aquest repte, en ordre cronològic */
function sparkline(rs) {
  const pts = [...rs].sort((a, b) => new Date(a.d) - new Date(b.d));
  const W = 300, H = 54, PAD = 6;
  const max = Math.max(...pts.map(p => p.t)), min = Math.min(...pts.map(p => p.t));
  const span = Math.max(1, max - min);
  const x = i => PAD + i * (W - PAD * 2) / Math.max(1, pts.length - 1);
  const y = t => PAD + (1 - (t - min) / span) * (H - PAD * 2);

  const svg = svgEl('svg', { class: 'spark', viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none',
                             role: 'img', 'aria-label': 'Evolució dels teus temps en aquest repte' });
  svg.append(svgEl('polyline', {
    points: pts.map((p, i) => `${x(i)},${y(p.t)}`).join(' '),
    fill: 'none', stroke: '#00ADEF', 'stroke-width': 2,
    'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'vector-effect': 'non-scaling-stroke'
  }));
  pts.forEach((p, i) => svg.append(svgEl('circle', {
    cx: x(i), cy: y(p.t), r: 3.2, fill: p.t === min ? '#98D320' : '#00ADEF',
    'vector-effect': 'non-scaling-stroke'
  })));
  return svg;
}

/* ---------------- rellotge: cronòmetre i compte enrere ---------------- */

const PRESETS = [30000, 60000, 120000, 180000, 300000, 600000];
let t0 = 0, elapsed = 0, ticker = 0, running = false, audio = null;
let target = 180000;         // objectiu en ús ara mateix

const remaining = () => Math.max(0, target - elapsed);
const shown = () => prefs.mode === 'down' ? remaining() : elapsed;

function paintClock() {
  const s = fmt(shown());
  const dot = s.lastIndexOf('.');
  const c = $('#clock');
  c.textContent = '';
  c.append(document.createTextNode(dot < 0 ? s : s.slice(0, dot)));
  if (dot >= 0) c.append(el('span', 'clock__frac', s.slice(dot)));

  const box = $('.clock');
  const over = prefs.mode === 'down' && remaining() === 0 && elapsed > 0;
  box.classList.toggle('is-warning', prefs.mode === 'down' && !over && remaining() <= 10000 && elapsed > 0);
  box.classList.toggle('is-over', over);
  $('#clockover').hidden = !over;
  $('#save').disabled = elapsed === 0 || over;
}

// setInterval i no requestAnimationFrame: així el compte enrere també salta
// quan la pestanya està en segon pla (rAF s'hi atura).
function tick() {
  elapsed = performance.now() - t0;
  if (prefs.mode === 'down' && elapsed >= target) {
    elapsed = target;
    stopTimer();
    paintClock();
    beep();
    return;
  }
  paintClock();
}

function startTimer() {
  if (prefs.mode === 'down' && remaining() === 0) return;
  t0 = performance.now() - elapsed;
  running = true;
  $('.clock').classList.add('is-running');
  $('#startstop').textContent = 'Atura';
  clearInterval(ticker);
  ticker = setInterval(tick, 60);
}

function stopTimer() {
  clearInterval(ticker);
  ticker = 0; running = false;
  $('.clock').classList.remove('is-running');
  $('#startstop').textContent = elapsed ? 'Continua' : 'Comença';
}

function resetTimer() {
  stopTimer();
  elapsed = 0;
  $('#startstop').textContent = 'Comença';
  paintClock();
}

function setMode(m) {
  prefs.mode = m; savePrefs();
  $$('.clock__modes button').forEach(b => {
    const on = b.dataset.mode === m;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-pressed', String(on));
  });
  $('#setup').hidden = m !== 'down';
  applyTarget();
}

/** objectiu que toca en obrir un repte: el teu rècord si l'has demanat, si no el que tenies posat */
function applyTarget() {
  const b = current !== null ? best(current) : null;
  setTarget(prefs.autoTarget && b ? b : prefs.target, false);
}

function setTarget(ms, manual = true) {
  target = Math.min(3600000, Math.max(10000, Math.round(ms / 1000) * 1000));
  if (manual) { prefs.target = target; savePrefs(); }
  $('#targetlabel').textContent = fmt(target, false);
  $$('#presets button').forEach(b => b.classList.toggle('is-on', Number(b.dataset.ms) === target));
  resetTimer();
}

/** els xips d'objectiu; el primer és el teu rècord d'aquest repte, si en tens */
function renderPresets() {
  const box = $('#presets');
  box.textContent = '';
  const b = current !== null ? best(current) : null;
  if (b) {
    const chip = el('button', 'is-best', `Bat ${fmt(b, false)}`);
    chip.type = 'button';
    chip.dataset.ms = Math.round(b / 1000) * 1000;
    chip.title = 'El teu millor temps en aquest repte';
    chip.onclick = () => setTarget(b);
    box.append(chip);
  }
  for (const ms of PRESETS) {
    const chip = el('button', null, fmt(ms, false));
    chip.type = 'button';
    chip.dataset.ms = ms;
    chip.onclick = () => setTarget(ms);
    box.append(chip);
  }
  $$('#presets button').forEach(x => x.classList.toggle('is-on', Number(x.dataset.ms) === target));
}

function paintAutoTarget() {
  $('#autotarget').setAttribute('aria-pressed', String(prefs.autoTarget));
}

function beep() {
  if (!prefs.sound) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    [0, .28, .56].forEach(off => {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = 'square'; o.frequency.value = 880;
      const t = audio.currentTime + off;
      g.gain.setValueAtTime(.0001, t);
      g.gain.exponentialRampToValueAtTime(.22, t + .01);
      g.gain.exponentialRampToValueAtTime(.0001, t + .18);
      o.connect(g).connect(audio.destination);
      o.start(t); o.stop(t + .2);
    });
  } catch { /* sense so, i ja està */ }
}

/* ---------------- estadístiques ---------------- */

function allRuns() {
  const out = [];
  for (const n in store) for (const r of store[n]) out.push({ n: Number(n), t: r.t, d: r.d });
  return out.sort((a, b) => new Date(a.d) - new Date(b.d));
}

function renderStats() {
  const host = $('#stats');
  host.textContent = '';
  const rs = allRuns();
  if (!rs.length) {
    host.append(card('Encara no hi ha res a mesurar', [
      el('p', 'empty', 'Cronometra un parell de reptes i aquí hi trobaràs el teu progrés, l’evolució dels temps i quins reptes se t’han donat millor.')
    ], true));
    return;
  }

  const solved2 = [], solved3 = [];
  for (let n = 1; n <= 500; n++) if (done(n)) (is3D(n) ? solved3 : solved2).push(n);

  /* 1 — progrés */
  const bars = el('div', 'bars');
  bars.append(bar('Reptes 2D', solved2.length, 250, '#00ADEF'));
  bars.append(bar('Reptes 3D', solved3.length, 250, '#F03BA6'));
  bars.append(bar('En total',  solved2.length + solved3.length, 500, '#98D320'));
  host.append(card('Progrés', [bars,
    el('p', 'hint', `${rs.length} ${rs.length === 1 ? 'intent cronometrat' : 'intents cronometrats'} en total.`)]));

  /* 2 — activitat dels últims 3 mesos */
  host.append(card('Activitat · 12 setmanes', heatmap(rs)));

  /* 3 — evolució */
  host.append(card('Evolució dels temps', evolution(rs), true));

  /* 4 — repartiment per durada */
  host.append(card('Quant t’hi acostumes a estar', histogram([...solved2, ...solved3].map(best))));

  /* 5 — sessions */
  if (sessionLog.length) host.append(card('Últimes sessions', [sessionList()]));

  /* 6 — rànquings */
  const byBest = [...solved2, ...solved3].map(n => ({ n, t: best(n) })).sort((a, b) => a.t - b.t);
  host.append(card('Els teus més ràpids', [toplist(byBest.slice(0, 5))]));
  host.append(card('Els que t’han costat més', [toplist(byBest.slice(-5).reverse())]));
}

function sessionList() {
  const ol = el('ol', 'toplist');
  for (const s of sessionLog.slice(0, 6)) {
    const played = s.results.filter(r => !r.skipped);
    const total = played.reduce((a, r) => a + r.t, 0);
    const li = el('li');
    const b = el('button');
    b.type = 'button';
    const short = new Date(s.startedAt).toLocaleDateString('ca-ES', { day: 'numeric', month: 'short' });
    b.append(el('span', 'toplist__n', short),
             el('span', 'toplist__kind', `${played.length} ${played.length === 1 ? 'repte' : 'reptes'}`),
             el('span', 'toplist__t', played.length ? fmt(total, false) : '—'));
    b.onclick = () => { renderSummary(s); show('session'); window.scrollTo(0, 0); };
    b.title = 'Mira el resum d’aquesta sessió';
    li.append(b);
    ol.append(li);
  }
  return ol;
}

function card(title, kids, wide) {
  const c = el('section', 'card' + (wide ? ' card--wide' : ''));
  c.append(el('h3', null, title));
  for (const k of [].concat(kids)) c.append(k);
  return c;
}

function bar(label, value, total, color, text) {
  const w = el('div');
  const head = el('div', 'bar__head');
  head.append(el('span', null, label), el('b', null, text ?? `${value} / ${total}`));
  const track = el('div', 'bar__track');
  const fill = el('div', 'bar__fill');
  fill.style.width = (value / total * 100).toFixed(1) + '%';
  fill.style.background = color;
  track.append(fill);
  w.append(head, track);
  return w;
}

function heatmap(rs) {
  const per = {};
  for (const r of rs) per[dayKey(r.d)] = (per[dayKey(r.d)] || 0) + 1;
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const start = new Date(today); start.setDate(start.getDate() - 83 - today.getDay());
  const grid = el('div', 'heat');
  let maxDay = 1;
  for (const k in per) maxDay = Math.max(maxDay, per[k]);
  const days = Math.round((today - start) / 864e5) + 1;
  for (let i = 0; i < days; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const c = per[dayKey(d)] || 0;
    const dot = el('i');
    if (c) dot.style.background = `color-mix(in srgb, #98D320 ${Math.round(30 + 70 * c / maxDay)}%, #2C2522)`;
    dot.title = `${d.toLocaleDateString('ca-ES')}: ${c} ${c === 1 ? 'intent' : 'intents'}`;
    grid.append(dot);
  }
  const legend = el('div', 'heat__legend');
  legend.append(el('span', null, 'Menys'));
  for (const p of [0, 40, 70, 100]) {
    const i = el('i');
    i.style.background = p ? `color-mix(in srgb, #98D320 ${p}%, #2C2522)` : '#2C2522';
    legend.append(i);
  }
  legend.append(el('span', null, 'Més'));
  return [grid, legend];
}

function evolution(rs) {
  const W = 640, H = 220, L = 46, B = 24, T = 10, R = 10;
  const t0d = new Date(rs[0].d).getTime(), t1d = new Date(rs[rs.length - 1].d).getTime();
  const span = Math.max(1, t1d - t0d);
  const peak = Math.max(...rs.map(r => r.t));
  const STEPS = [15000, 30000, 60000, 120000, 300000, 600000, 900000, 1800000, 3600000];
  const step = STEPS.find(s => peak / s <= 5) || STEPS[STEPS.length - 1];
  const ticks = Math.ceil(peak / step);
  const maxT = ticks * step;
  const x = d => L + (new Date(d).getTime() - t0d) / span * (W - L - R);
  const y = t => T + (1 - t / maxT) * (H - T - B);

  const svg = svgEl('svg', { class: 'chart', viewBox: `0 0 ${W} ${H}`,
                             role: 'img', 'aria-label': 'Cada intent cronometrat, per data' });
  for (let i = 0; i <= ticks; i++) {
    const t = step * i;
    svg.append(svgEl('line', { x1: L, x2: W - R, y1: y(t), y2: y(t), stroke: '#2C2522', 'stroke-width': 1 }));
    const lab = svgEl('text', { x: L - 8, y: y(t), fill: '#6E635E', 'text-anchor': 'end',
      'dominant-baseline': 'central', 'font-family': 'IBM Plex Mono, monospace', 'font-size': 11 });
    lab.textContent = fmt(t, false);
    svg.append(lab);
  }
  for (const r of rs) {
    svg.append(svgEl('circle', { cx: x(r.d), cy: y(r.t), r: 4,
      fill: is3D(r.n) ? '#F03BA6' : '#00ADEF', 'fill-opacity': .8 }));
  }
  for (const [d, anchor] of [[rs[0].d, 'start'], [rs[rs.length - 1].d, 'end']]) {
    const lab = svgEl('text', { x: anchor === 'start' ? L : W - R, y: H - 6, fill: '#6E635E',
      'text-anchor': anchor, 'font-family': 'IBM Plex Mono, monospace', 'font-size': 11 });
    lab.textContent = dateLabel(d);
    svg.append(lab);
  }
  const legend = el('div', 'chart__legend');
  for (const [c, t] of [['#00ADEF', '2D'], ['#F03BA6', '3D']]) {
    const s = el('span'); const i = el('i'); i.style.background = c;
    s.append(i, document.createTextNode(t)); legend.append(s);
  }
  return [svg, legend];
}

function histogram(times) {
  const buckets = [
    ['< 1 min', t => t < 60000],
    ['1–2 min', t => t >= 60000 && t < 120000],
    ['2–3 min', t => t >= 120000 && t < 180000],
    ['3–5 min', t => t >= 180000 && t < 300000],
    ['5 min o més', t => t >= 300000],
  ];
  const counts = buckets.map(([, f]) => times.filter(f).length);
  const max = Math.max(1, ...counts);
  const box = el('div', 'bars');
  buckets.forEach(([label], i) => box.append(
    bar(label, counts[i], max, '#F0E406',
        `${counts[i]} ${counts[i] === 1 ? 'repte' : 'reptes'}`)));
  return [box, el('p', 'hint', 'Segons el millor temps de cada repte.')];
}

function toplist(items) {
  const ol = el('ol', 'toplist');
  for (const { n, t } of items) {
    const li = el('li');
    const b = el('button');
    b.type = 'button';
    b.append(el('span', 'toplist__n', '№ ' + n),
             el('span', 'toplist__kind', is3D(n) ? '3D' : '2D'),
             el('span', 'toplist__t', fmt(t)));
    b.onclick = () => openLevel(n);
    li.append(b);
    ol.append(li);
  }
  return ol;
}

/* ---------------- la colla ---------------- */

const compEnabled = () => !!API && API.enabled();
const playing = () => compEnabled() && API.me();

/** la classificació baixada, indexada per repte i per jugador */
function boardIndex() {
  const b = compEnabled() ? API.board() : null;
  if (!b) return null;
  const names = new Map(b.players);
  const byPuzzle = new Map();
  const byPlayer = new Map();
  for (const [pz, pid, ms] of b.times) {
    if (!byPuzzle.has(pz)) byPuzzle.set(pz, []);
    byPuzzle.get(pz).push([pid, ms]);
    if (!byPlayer.has(pid)) byPlayer.set(pid, []);
    byPlayer.get(pid).push(ms);
  }
  for (const list of byPuzzle.values()) list.sort((a, b2) => a[1] - b2[1]);
  return { names, byPuzzle, byPlayer, at: b.at };
}

let syncing = false, syncQueued = null;

/** puja el que hi hagi de nou i, si cal, torna a baixar tot el teu historial */
async function syncNow(opts = {}) {
  const { full = false, loud = false } = opts;
  if (!playing()) return;
  if (syncing) { syncQueued = opts; return; }   // no la perdem: va tot seguit
  syncing = true;
  try {
    const res = await API.sync({ store, favs: [...favs], sessions: sessionLog }, full);
    if (res && full) applyRemote(res);
    paintWhoami();
    if (current !== null) { paintRivals(); renderTimes(); }
    if (!$('#view-board').hidden) renderBoard();
    if (loud) toast('Tot al dia.');
  } catch (e) {
    if (loud) toast(e.status === 401 ? 'La teva invitació ja no val.' : 'No he pogut connectar amb el servidor.');
  } finally {
    syncing = false;
    if (syncQueued) { const next = syncQueued; syncQueued = null; syncNow(next); }
  }
}

/** fusiona el que ve del servidor amb el que ja hi ha en aquest navegador */
function applyRemote(res) {
  let changed = false;

  if (Array.isArray(res.runs)) {
    const seen = new Map();               // repte -> conjunt de dates que ja tenim
    for (const p in store) seen.set(p, new Set(store[p].map(r => r.d)));
    for (const [puzzle, ms, at] of res.runs) {
      const key = String(puzzle);
      if (!seen.has(key)) { seen.set(key, new Set()); }
      if (seen.get(key).has(at)) continue;
      (store[key] = store[key] || []).push({ t: ms, d: at });
      seen.get(key).add(at);
      changed = true;
    }
    if (changed) saveTimes();
  }

  if (Array.isArray(res.favs)) {
    const next = new Set(res.favs.map(Number));
    if (next.size !== favs.size || [...next].some(n => !favs.has(n))) {
      favs = next; saveFavs(); changed = true;
    }
  }

  if (Array.isArray(res.sessions)) {
    const have = new Set(sessionLog.map(s => s.startedAt));
    let added = 0;
    for (const s of res.sessions) if (s && !have.has(s.startedAt)) { sessionLog.push(s); added++; }
    if (added) {
      sessionLog.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
      sessionLog = sessionLog.slice(0, 50);
      saveLog(); changed = true;
    }
  }

  if (changed) {
    if (current !== null) paintFav();
    if (!$('#view-index').hidden) renderIndex();
  }
  return changed;
}

function paintWhoami() {
  const box = $('#whoami');
  const p = playing();
  $('#toboard').hidden = !p;
  $('#adminlink').hidden = !compEnabled();
  if (!compEnabled()) { box.hidden = true; return; }
  box.hidden = false;
  box.textContent = '';
  if (!p) {
    box.append(document.createTextNode('Tens una invitació? Obre l’enllaç que t’han passat.'));
    return;
  }
  box.append(document.createTextNode('Jugues com a '), el('b', null, p.name));
  const out = el('button', null, 'Surt');
  out.type = 'button';
  out.onclick = () => {
    if (!confirm('Vols sortir de la classificació? Els teus temps es queden en aquest navegador.')) return;
    API.logout(); paintWhoami(); renderIndex();
  };
  box.append(out);
}

/** el panell de rivals dins d'un repte */
function paintRivals() {
  const box = $('#rivals');
  const idx = boardIndex();
  const p = playing();
  if (!p || !idx) { box.hidden = true; return; }
  box.hidden = false;
  const list = $('#rivals-list');
  list.textContent = '';
  const rows = idx.byPuzzle.get(current) || [];
  const done = new Map(rows);
  let pos = 0, prev = null;
  for (const [pid, ms] of rows) {
    if (ms !== prev) pos++;
    prev = ms;
    const li = el('li', (pid === p.id ? ' is-me' : '') + (pos === 1 ? ' is-first' : ''));
    li.append(el('span', 'rivals__pos', String(pos)),
              el('span', 'rivals__name', idx.names.get(pid) || '?'),
              el('span', 'rivals__t', fmt(ms)));
    list.append(li);
  }
  for (const [pid, name] of idx.names) {
    if (done.has(pid)) continue;
    const li = el('li', 'is-none' + (pid === p.id ? ' is-me' : ''));
    li.append(el('span', 'rivals__pos', '·'), el('span', 'rivals__name', name), el('span', 'rivals__t', '—'));
    list.append(li);
  }
}

/** la taula general */
function renderBoard() {
  const host = $('#boardbody');
  host.textContent = '';
  const idx = boardIndex();
  const p = playing();
  if (!p) { host.append(el('p', 'empty', 'Encara no hi ets. Obre l’enllaç d’invitació que t’han passat.')); return; }
  if (!idx || !idx.names.size) {
    host.append(el('p', 'empty', 'Encara no hi ha res. Toca «Actualitza» quan tinguis connexió.'));
    return;
  }

  const wins = new Map();
  for (const rows of idx.byPuzzle.values()) {
    if (!rows.length) continue;
    const top = rows[0][1];
    for (const [pid, ms] of rows) { if (ms === top) wins.set(pid, (wins.get(pid) || 0) + 1); else break; }
  }

  const rows = [...idx.names].map(([id, name]) => {
    const times = idx.byPlayer.get(id) || [];
    const total = times.reduce((a, b) => a + b, 0);
    return { id, name, count: times.length, wins: wins.get(id) || 0, avg: times.length ? total / times.length : null };
  }).sort((a, b) => b.wins - a.wins || b.count - a.count || (a.avg ?? 9e9) - (b.avg ?? 9e9));

  const card = el('section', 'card card--wide');
  const table = el('table', 'standings standings--rank');
  const head = el('tr');
  ['', 'Jugador', 'Reptes', 'Millors', 'Mitjana'].forEach((h, i) =>
    head.append(el('th', i >= 2 ? 'num' : null, h)));
  const thead = el('thead'); thead.append(head); table.append(thead);
  const body = el('tbody');
  rows.forEach((r, i) => {
    const tr = el('tr', r.id === p.id ? 'is-me' : '');
    tr.append(el('td', null, String(i + 1)));
    const nameCell = el('td', null, r.name);
    if (i === 0 && r.wins) nameCell.append(el('span', 'crown', ' ★'));
    tr.append(nameCell);
    tr.append(el('td', 'num', String(r.count)));
    tr.append(el('td', 'num', String(r.wins)));
    tr.append(el('td', 'num', r.avg ? fmt(r.avg, false) : '—'));
    body.append(tr);
  });
  table.append(body);
  card.append(el('h3', null, 'Classificació general'), table,
    el('p', 'hint', '«Millors» és a quants reptes tens el temps més ràpid de la colla.'));
  host.append(card);

  if (idx.at) host.append(el('p', 'hint', 'Última actualització: ' +
    new Date(idx.at).toLocaleString('ca-ES', { dateStyle: 'medium', timeStyle: 'short' })));

  host.append(deviceCard());
}

/** el teu enllaç, per continuar amb el mateix compte en un altre navegador */
function deviceCard() {
  const card = el('section', 'card card--wide');
  card.append(el('h3', null, 'Jugar en un altre navegador'));
  card.append(el('p', 'hint',
    'Obre aquest enllaç al mòbil, a la feina o on vulguis i hi trobaràs els mateixos temps. ' +
    'Val per a tants dispositius com vulguis, i tot el que facis en qualsevol d’ells acaba als altres.'));
  const link = API.myLink();
  const box = el('div', 'invitelink');
  const code = el('code', null, link);
  const copy = el('button', 'btn btn--ghost', 'Copia l’enllaç');
  copy.type = 'button';
  copy.onclick = () => navigator.clipboard.writeText(link)
    .then(() => toast('Enllaç copiat.'), () => toast('Selecciona’l i copia’l a mà.'));
  box.append(code, copy);
  card.append(box);
  card.append(el('p', 'hint', 'És la teva clau: qui el tingui juga com si fos tu. No el publiquis enlloc.'));
  return card;
}

/* ---------------- invitacions ---------------- */

function renderAdmin() {
  const host = $('#adminbody');
  host.textContent = '';
  if (!compEnabled()) { host.append(el('p', 'empty', 'Encara no hi ha cap servidor configurat.')); return; }

  const card = el('section', 'card card--wide');
  card.append(el('h3', null, 'Clau d’administració'));
  const keyRow = el('div', 'invite');
  const keyInput = el('input');
  keyInput.type = 'password';
  keyInput.placeholder = 'La clau que vas posar al Worker';
  keyInput.value = API.adminKey();
  const keyBtn = el('button', 'btn btn--solid', 'Desa la clau');
  keyBtn.type = 'button';
  keyBtn.onclick = () => { API.setAdminKey(keyInput.value.trim()); renderAdmin(); };
  keyRow.append(keyInput, keyBtn);
  card.append(keyRow);
  host.append(card);

  if (!API.adminKey()) return;

  const inv = el('section', 'card card--wide');
  inv.append(el('h3', null, 'Convida algú'));
  const row = el('div', 'invite');
  const nameInput = el('input');
  nameInput.type = 'text';
  nameInput.maxLength = 24;
  nameInput.placeholder = 'Nom de qui convides';
  const go = el('button', 'btn btn--accent', 'Crea la invitació');
  go.type = 'button';
  go.onclick = async () => {
    go.disabled = true;
    try {
      const res = await API.invite(nameInput.value.trim());
      const link = location.origin + location.pathname + '#entra=' + res.token;
      const box = el('div', 'invitelink');
      const code = el('code', null, link);
      const copy = el('button', 'btn btn--ghost', 'Copia');
      copy.type = 'button';
      copy.onclick = () => navigator.clipboard.writeText(link)
        .then(() => toast('Enllaç copiat.'), () => toast('Copia’l a mà.'));
      box.append(code, copy);
      inv.insertBefore(box, row.nextSibling);
      nameInput.value = '';
      toast(`Invitació per a ${res.name} creada. L’enllaç només es veu ara.`);
      listPlayers();
    } catch (e) { toast(e.message); }
    go.disabled = false;
  };
  row.append(nameInput, go);
  inv.append(row, el('p', 'hint', 'L’enllaç conté el testimoni i no es pot tornar a veure: copia’l ara i passa’l.'));
  host.append(inv);

  const listCard = el('section', 'card card--wide');
  listCard.append(el('h3', null, 'Qui hi ha'));
  const listBox = el('div');
  listCard.append(listBox);
  host.append(listCard);

  async function listPlayers() {
    listBox.textContent = 'Carregant…';
    try {
      const { players } = await API.players();
      listBox.textContent = '';
      if (!players.length) { listBox.append(el('p', 'empty', 'Encara no has convidat ningú.')); return; }
      const table = el('table', 'standings');
      const head = el('tr');
      ['Nom', 'Estat', 'Temps', ''].forEach((h, i) => head.append(el('th', i === 2 ? 'num' : null, h)));
      const thead = el('thead'); thead.append(head); table.append(thead);
      const body = el('tbody');
      for (const pl of players) {
        const tr = el('tr');
        tr.append(el('td', null, pl.name));
        tr.append(el('td', null, pl.revoked ? 'revocat' : pl.joined_at ? 'actiu' : 'pendent d’entrar'));
        tr.append(el('td', 'num', String(pl.times)));
        const actions = el('td');
        const toggle = el('button', 'link', pl.revoked ? 'Torna a activar' : 'Revoca');
        toggle.type = 'button';
        toggle.onclick = async () => { await API.revoke(pl.id, !pl.revoked); listPlayers(); };
        const del = el('button', 'link link--danger', 'Esborra');
        del.type = 'button';
        del.style.marginLeft = '12px';
        del.onclick = async () => {
          if (!confirm(`Esborrar ${pl.name} i tots els seus temps?`)) return;
          await API.remove(pl.id); listPlayers();
        };
        actions.append(toggle, del);
        tr.append(actions);
        body.append(tr);
      }
      table.append(body);
      listBox.append(table);
    } catch (e) {
      listBox.textContent = '';
      listBox.append(el('p', 'empty', e.message));
    }
  }
  listPlayers();
}

/* ---------------- pistes ---------------- */

let worker, seq = 0;
const pending = new Map();

function getWorker() {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker('js/worker.js');
    worker.onmessage = e => {
      const cb = pending.get(e.data.id);
      pending.delete(e.data.id);
      if (cb) cb(e.data.res);
    };
    worker.onerror = () => {
      worker = null;
      for (const [id, cb] of pending) { pending.delete(id); cb(null); }
    };
  } catch (e) { worker = null; }
  return worker;
}

/** Demana la solució al fil de càlcul; si no n'hi ha, la fa aquí mateix. */
function askSolver(n, done) {
  const grid = layout(n), dim = is3D(n) ? 3 : 2;
  const w = getWorker();
  if (w) {
    const id = ++seq;
    pending.set(id, done);
    // si el fil de càlcul es queda mut, no deixem els botons penjats
    setTimeout(() => { if (pending.delete(id)) done(null); }, 20000);
    w.postMessage({ id, grid, dim, shapes: DATA.shapes, sizes: DATA.sizes });
    return;
  }
  setTimeout(() => {
    let r = null;
    try { r = KanoodleSolver.solve(grid, dim, DATA.shapes, DATA.sizes); } catch (e) { r = null; }
    done(r && r.ok ? r : null);
  }, 30);
}

function withSolution(n, cb) {
  if (n in solutions) return cb(solutions[n]);
  const btns = $$('.hintbar .btn');
  btns.forEach(b => b.dataset.busy = '1');
  $('#hintnote').textContent = 'Calculant la solució…';
  askSolver(n, res => {
    solutions[n] = res;
    btns.forEach(b => delete b.dataset.busy);
    if (current === n) cb(res);
  });
}

const ghostMap = () => {
  const sol = solutions[current];
  const m = new Map();
  if (!sol) return m;
  for (const p of sol.pieces)
    if (shownHints.has(p.piece)) for (const c of p.cells) m.set(c, p.piece);
  return m;
};

function paintDiagram() {
  const box = $('#lv-diagram');
  box.textContent = '';
  box.className = 'diagram' + (is3D(current) ? ' diagram--3d' : '');
  const ghosts = ghostMap();
  box.append(is3D(current) ? draw3D(layout(current), ghosts) : draw2D(layout(current), ghosts));
}

function paintHints() {
  const sol = solutions[current];
  const total = sol ? sol.pieces.length : 0;
  const shown = shownHints.size;
  $('#hint').textContent = shown ? 'Una altra pista' : 'Dona’m una pista';
  $('#hint').hidden = !!sol && shown >= total;
  $('#hintall').hidden = !!sol && shown >= total;
  $('#hinthide').hidden = shown === 0;
  $('#hintnote').textContent =
    !sol && (current in solutions) ? 'No he sabut resoldre aquest repte.'
    : shown === 0 ? 'Toca una peça i et diré on va.'
    : shown >= total ? 'Aquesta és una solució sencera.' + brokenNote(sol)
    : `${shown} ${shown === 1 ? 'peça' : 'peces'} de ${total}.` + brokenNote(sol);
  $$('#lv-pieces .piece').forEach(p => {
    const on = shownHints.has(p.dataset.piece);
    p.classList.toggle('is-shown', on);
    p.title = on ? `Amaga la peça ${p.dataset.piece}` : `Ensenya’m on va la peça ${p.dataset.piece}`;
  });
  paintDiagram();
}

/** al repte 302 el quadern dibuixa una peça incompleta; el resolutor la recol·loca */
const brokenNote = sol => sol && sol.broken.length
  ? ` Hi entra també la peça ${sol.broken.join(' i ')}, que al quadern surt incompleta.`
  : '';

function reveal(letters) {
  withSolution(current, sol => {
    if (!sol) return paintHints();
    for (const L of letters) if (sol.pieces.some(p => p.piece === L)) shownHints.add(L);
    paintHints();
  });
}

/** tocar una peça la mostra; tornar-la a tocar l'amaga */
function toggleHint(L) {
  withSolution(current, sol => {
    if (!sol) return paintHints();
    if (shownHints.has(L)) shownHints.delete(L);
    else if (sol.pieces.some(p => p.piece === L)) shownHints.add(L);
    paintHints();
  });
}

const revealNext = () => withSolution(current, sol => {
  if (!sol) return paintHints();
  const next = sol.order.find(L => !shownHints.has(L));
  if (next) shownHints.add(next);
  paintHints();
});

/* ---------------- mode sessió ---------------- */

const sessionLevel = () => session ? session.ids[session.idx] : null;
const sessionTotal = () => session.results.reduce((a, r) => a + (r.t || 0), 0);

function startSession(count) {
  const pool = [];
  for (let n = 1; n <= 500; n++) if (passes(n)) pool.push(n);
  if (pool.length < 2) { toast('Amb aquests filtres no hi ha prou reptes.'); return; }
  for (let i = pool.length - 1; i > 0; i--) {          // barreja de Fisher–Yates
    const k = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[k]] = [pool[k], pool[i]];
  }
  session = {
    ids: pool.slice(0, Math.min(count, pool.length)),
    idx: 0, results: [], startedAt: new Date().toISOString()
  };
  saveSession();
  openLevel(session.ids[0]);
}

/** apunta el resultat del repte actual i passa al següent */
function sessionAdvance(result) {
  session.results.push(result);
  session.idx++;
  if (session.idx >= session.ids.length) return finishSession();
  saveSession();
  openLevel(sessionLevel());
}

function finishSession() {
  const done = { ...session, endedAt: new Date().toISOString() };
  session = null;
  saveSession();
  sessionLog.unshift(done);
  sessionLog = sessionLog.slice(0, 50);
  saveLog();
  if (playing()) syncNow();
  showSummary(done);
}

function showSummary(s, push = true) {
  renderSummary(s);
  document.title = 'Sessió acabada — Kanoodle Ultimate Champion';
  show('session');
  if (push && location.hash !== '#sessio') location.hash = '#sessio';
  window.scrollTo(0, 0);
}

function quitSession(ask = true) {
  if (ask && !confirm('Segur que vols deixar la sessió? Els temps que ja has desat es queden.')) return;
  session = null;
  saveSession();
  closeLevel();
}

/** la barra de la sessió només surt quan ets al repte que toca */
function paintSession() {
  const on = !!session && sessionLevel() === current;
  $('#sessionbar').hidden = !on;
  $('#levelbar').hidden = on;
  if (!on) { $('#save').textContent = 'Desa el temps'; return; }

  $('#sessioncounter').textContent = `${session.idx + 1} de ${session.ids.length}`;
  $('#sessiontotal').textContent = fmt(sessionTotal(), false);
  const dots = $('#sessiondots');
  dots.textContent = '';
  session.ids.forEach((_, i) => {
    const d = el('i');
    const r = session.results[i];
    if (i === session.idx) d.className = 'is-now';
    else if (r && r.skipped) d.className = 'is-skip';
    else if (r) d.className = 'is-done';
    dots.append(d);
  });
  const last = session.idx === session.ids.length - 1;
  $('#save').textContent = last ? 'Desa i acaba' : 'Desa i continua';
}

function renderSummary(s) {
  const host = $('#summary');
  host.textContent = '';
  const played = s.results.filter(r => !r.skipped);
  const total  = played.reduce((a, r) => a + r.t, 0);
  const records = played.filter(r => r.prevBest === null || r.t < r.prevBest).length;

  const top = el('dl', 'summary__top');
  const item = (label, value) => {
    const d = el('div');
    d.append(el('dd', null, value), el('dt', null, label));
    return d;
  };
  top.append(item('Temps total', played.length ? fmt(total, false) : '—'));
  top.append(item('Reptes', `${played.length} de ${s.ids.length}`));
  if (played.length) top.append(item('Mitjana', fmt(total / played.length, false)));
  top.append(item(records === 1 ? 'Rècord' : 'Rècords', String(records)));
  host.append(top);

  const rows = el('ol', 'summary__rows');
  s.ids.forEach((n, i) => {
    const r = s.results[i];
    const li = el('li');
    const b = el('button');
    b.type = 'button';
    b.append(el('span', 'summary__n', '№ ' + n));
    b.append(el('span', 'toplist__kind', is3D(n) ? '3D' : '2D'));
    if (!r || r.skipped) {
      b.append(el('span', 'summary__skip', 'saltat'));
      b.append(el('span', 'summary__t', '—'));
    } else {
      b.append(el('span', 'summary__t', fmt(r.t)));
      const d = el('span', 'summary__delta');
      if (r.prevBest === null) { d.className += ' new'; d.textContent = 'primer temps'; }
      else if (r.t < r.prevBest) { d.className += ' up'; d.textContent = '−' + fmtDelta(r.prevBest - r.t) + ' · rècord'; }
      else if (r.t > r.prevBest) { d.className += ' down'; d.textContent = '+' + fmtDelta(r.t - r.prevBest); }
      else { d.className += ' down'; d.textContent = 'clavat'; }
      b.append(d);
    }
    b.onclick = () => openLevel(n);
    li.append(b);
    rows.append(li);
  });
  host.append(rows);
}

/* ---------------- navegació entre vistes ---------------- */

function show(which) {
  $('#view-index').hidden   = which !== 'index';
  $('#view-level').hidden   = which !== 'level';
  $('#view-stats').hidden   = which !== 'stats';
  $('#view-session').hidden = which !== 'session';
  $('#view-board').hidden   = which !== 'board';
  $('#view-admin').hidden   = which !== 'admin';
}

function backToIndex() {
  current = null;
  document.title = 'Kanoodle Ultimate Champion — els 500 reptes';
  show('index');
  renderIndex();
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  window.scrollTo(0, indexScroll);
}

function closeLevel() {
  stopTimer();
  backToIndex();
}

function openBoard(push = true) {
  if (current !== null) { stopTimer(); current = null; }
  document.title = 'La colla — Kanoodle Ultimate Champion';
  renderBoard();
  show('board');
  if (push && location.hash !== '#classificacio') location.hash = '#classificacio';
  window.scrollTo(0, 0);
  syncNow({ full: true });
}

function openAdmin(push = true) {
  if (current !== null) { stopTimer(); current = null; }
  document.title = 'Invitacions — Kanoodle Ultimate Champion';
  renderAdmin();
  show('admin');
  if (push && location.hash !== '#invitacions') location.hash = '#invitacions';
  window.scrollTo(0, 0);
}

/** l'enllaç d'invitació: demanem el nom i entrem */
function askToJoin(token) {
  history.replaceState(null, '', location.pathname + location.search);
  if (!compEnabled()) { backToIndex(); return toast('Aquesta còpia no té servidor configurat.'); }
  const dlg = $('#joindlg');
  $('#joinerror').hidden = true;
  $('#joinname').value = (playing() || {}).name || '';
  backToIndex();
  dlg.showModal();
  $('#joinform').onsubmit = async e => {
    e.preventDefault();
    const name = $('#joinname').value.trim();
    if (!name) return;
    try {
      await API.join(token, name);
      dlg.close();
      paintWhoami();
      toast(`Ja hi ets, ${name}. Recuperant les teves dades…`);
      await syncNow({ full: true });
      renderIndex();
      const n = Object.keys(store).length;
      toast(n ? `Llest: ${n} ${n === 1 ? 'repte' : 'reptes'} al teu compte.` : 'Llest.');
    } catch (err) {
      $('#joinerror').hidden = false;
      $('#joinerror').textContent = err.status === 401
        ? 'Aquesta invitació no val: potser ja s’ha revocat.'
        : 'No he pogut connectar amb el servidor.';
    }
  };
}

function openStats(push = true) {
  if (current !== null) { stopTimer(); current = null; }
  document.title = 'Estadístiques — Kanoodle Ultimate Champion';
  renderStats();
  show('stats');
  if (push && location.hash !== '#stats') location.hash = '#stats';
  window.scrollTo(0, 0);
}

/* ---------------- avisos ---------------- */

let toastT = 0;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('is-up');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('is-up'), 2600);
}

function record(ms) {
  const inSession = !!session && sessionLevel() === current;
  const prevBest = best(current);
  const isBest = addRun(current, ms);
  if (playing()) syncNow();
  if (inSession) return sessionAdvance({ n: current, t: ms, prevBest });
  renderTimes();
  renderPresets();
  toast(isBest ? `Rècord personal: ${fmt(ms)}` : `Temps desat: ${fmt(ms)}`);
}

/* ---------------- esdeveniments ---------------- */

function wire() {
  $('#main').addEventListener('click', e => {
    const b = e.target.closest('.bead');
    if (b) openLevel(Number(b.dataset.n));
  });

  $$('.segmented button').forEach(b => b.onclick = () => {
    $$('.segmented button').forEach(x => {
      const on = x === b;
      x.classList.toggle('is-on', on);
      x.setAttribute('aria-pressed', String(on));
    });
    filter = b.dataset.filter;
    renderIndex();
  });

  $('#jump').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const n = Number(e.target.value);
    if (n >= 1 && n <= 500) { e.target.value = ''; openLevel(n); }
    else toast('Escriu un número entre 1 i 500.');
  });

  $('#random').onclick = () => {
    const pool = [];
    for (let n = 1; n <= 500; n++) if (passes(n) && n !== current) pool.push(n);
    if (!pool.length) return toast('Cap repte en aquest filtre.');
    openLevel(pool[Math.floor(Math.random() * pool.length)]);
  };

  const dlg = $('#sessiondlg');
  let sessionCount = 5;
  const paintPool = () => {
    let pool = 0;
    for (let n = 1; n <= 500; n++) if (passes(n)) pool++;
    $('#sessionpool').innerHTML = '';
    $('#sessionpool').append(
      document.createTextNode('Es trien a l’atzar d’entre els '),
      el('b', null, String(pool)),
      document.createTextNode(pool === 1 ? ' repte que tens filtrat.' : ' reptes que tens filtrats.'));
  };
  $('#startsession').onclick = () => {
    if (session) return openLevel(sessionLevel());
    paintPool();
    dlg.showModal();
  };
  $('#sessioncancel').onclick = () => dlg.close();
  $$('#sessioncount button').forEach(b => b.onclick = () => {
    $$('#sessioncount button').forEach(x => {
      const on = x === b;
      x.classList.toggle('is-on', on);
      x.setAttribute('aria-pressed', String(on));
    });
    sessionCount = Number(b.dataset.n);
  });
  $('#sessiongo').onclick = () => { dlg.close(); startSession(sessionCount); };

  $('#hint').onclick    = revealNext;
  $('#hintall').onclick = () => withSolution(current, sol => {
    if (sol) for (const p of sol.pieces) shownHints.add(p.piece);
    paintHints();
  });
  $('#hinthide').onclick = () => { shownHints = new Set(); paintHints(); };

  $('#sessionquit').onclick = () => quitSession();
  $('#sessionskip').onclick = () => sessionAdvance({ n: current, skipped: true });
  $('#sessionback').onclick = backToIndex;
  $('#sessionagain').onclick = () => { backToIndex(); $('#startsession').click(); };

  $('#toboard').onclick   = () => openBoard();
  $('#boardback').onclick = backToIndex;
  $('#adminback').onclick = backToIndex;
  $('#boardsync').onclick = () => syncNow({ full: true, loud: true });
  $('#tostats').onclick   = () => openStats();
  $('#statsback').onclick = backToIndex;
  $('#back').onclick      = closeLevel;
  $('#prev').onclick      = () => openLevel(current - 1);
  $('#next').onclick      = () => openLevel(current + 1);

  $('#fav').onclick = () => {
    fav(current) ? favs.delete(current) : favs.add(current);
    saveFavs(); paintFav();
    if (playing()) { API.markFav(current, fav(current)); syncNow(); }
    toast(fav(current) ? `Repte ${current} als favorits.` : `Repte ${current} fora dels favorits.`);
  };

  $$('.clock__modes button').forEach(b => b.onclick = () => setMode(b.dataset.mode));

  $$('.clock__adjust button').forEach(b =>
    b.onclick = () => setTarget(target + Number(b.dataset.delta) * 1000));

  $('#autotarget').onclick = () => {
    prefs.autoTarget = !prefs.autoTarget; savePrefs();
    paintAutoTarget();
    applyTarget();
  };

  $$('#diffchips button').forEach(b => b.onclick = () => {
    $$('#diffchips button').forEach(x => {
      const on = x === b;
      x.classList.toggle('is-on', on);
      x.setAttribute('aria-pressed', String(on));
    });
    diffFilter = b.dataset.diff;
    renderIndex();
  });

  $('#startstop').onclick = () => running ? stopTimer() : startTimer();
  $('#reset').onclick = resetTimer;
  $('#save').onclick = () => {
    if (!elapsed) return;
    stopTimer();
    record(Math.round(elapsed));
    resetTimer();
  };
  $('#sound').onclick = () => {
    prefs.sound = !prefs.sound; savePrefs();
    $('#sound').setAttribute('aria-pressed', String(prefs.sound));
    $('#sound').textContent = prefs.sound ? '🔊 So activat' : '🔇 So desactivat';
    if (prefs.sound) beep();
  };

  $('#manualform').onsubmit = e => {
    e.preventDefault();
    const ms = parseTime($('#manualtime').value);
    if (ms === null || ms === 0) return toast('Format no reconegut. Prova «1:23» o «83».');
    $('#manualtime').value = '';
    record(ms);
  };

  $('#export').onclick = () => {
    const payload = { times: store, favs: [...favs], sessions: sessionLog };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = el('a');
    a.href = URL.createObjectURL(blob);
    a.download = `kanoodle-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  $('#import').onclick = () => $('#importfile').click();
  $('#importfile').onchange = e => {
    const f = e.target.files[0];
    if (!f) return;
    f.text().then(txt => {
      const raw = JSON.parse(txt);
      const incoming = raw.times || raw;          // accepta també l'export antic
      let added = 0;
      for (const n in incoming) {
        if (!Array.isArray(incoming[n])) continue;
        const have = new Set(runs(n).map(r => r.d));
        for (const r of incoming[n]) if (r && !have.has(r.d)) { (store[n] = store[n] || []).push(r); added++; }
      }
      let favAdded = 0;
      for (const n of raw.favs || []) if (!favs.has(Number(n))) { favs.add(Number(n)); favAdded++; }
      if (Array.isArray(raw.sessions)) {
        const have = new Set(sessionLog.map(s => s.startedAt));
        for (const s of raw.sessions) if (s && !have.has(s.startedAt)) sessionLog.push(s);
        sessionLog.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
        sessionLog = sessionLog.slice(0, 50);
        saveLog();
      }
      saveTimes(); saveFavs();
      if (playing()) { API.markEverything(); syncNow(); }
      renderIndex();
      toast(`${added} ${added === 1 ? 'temps importat' : 'temps importats'}` +
            (favAdded ? ` i ${favAdded} ${favAdded === 1 ? 'favorit' : 'favorits'}.` : '.'));
    }).catch(() => toast('El fitxer no s’ha pogut llegir.'));
    e.target.value = '';
  };
  $('#wipe').onclick = () => {
    if (!confirm('Segur que vols esborrar tots els temps, els favorits i les sessions? No es pot desfer.')) return;
    store = {}; favs = new Set(); session = null; sessionLog = [];
    if (compEnabled()) API.logout();
    saveTimes(); saveFavs(); saveSession(); saveLog(); renderIndex();
    toast('Tot esborrat.');
  };

  document.addEventListener('keydown', e => {
    if (/^(INPUT|TEXTAREA|BUTTON)$/.test(e.target.tagName)) return;
    if (current === null) return;
    if (e.key === 'Escape')          closeLevel();
    else if (e.key === 'f' || e.key === 'F') $('#fav').click();
    else if (e.key === 'p' || e.key === 'P') { if (!$('#hint').hidden) $('#hint').click(); }
    else if (e.key === 'ArrowLeft'  && current > 1)   openLevel(current - 1);
    else if (e.key === 'ArrowRight' && current < 500) openLevel(current + 1);
    else if (e.code === 'Space') { e.preventDefault(); running ? stopTimer() : startTimer(); }
  });

  window.addEventListener('hashchange', route);

  // en tornar a la pestanya, el rellotge es posa al dia de seguida
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && running) tick();
  });
}

function route() {
  const h = location.hash.slice(1);
  if (h.startsWith('entra=')) return askToJoin(h.slice(6));
  if (h === 'classificacio') return openBoard(false);
  if (h === 'invitacions') return openAdmin(false);
  if (h === 'stats') return openStats(false);
  if (h === 'sessio') {
    if (sessionLog.length) return showSummary(sessionLog[0], false);
    return closeLevel();
  }
  const n = Number(h);
  if (n >= 1 && n <= 500) return openLevel(n, false);
  closeLevel();
}

/** El primer càlcul paga la compilació i la llista de col·locacions. Ho anem
    fent al fil de càlcul de seguida, que allà no molesta ningú. */
function warmSolver() {
  const w = getWorker();
  if (!w) return;
  for (const [n, dim] of [[1, 2], [251, 3]]) {
    const id = ++seq;
    pending.set(id, () => {});
    w.postMessage({ id, grid: dim === 3 ? DATA.p3d[n] : DATA.p2d[n], dim, shapes: DATA.shapes, sizes: DATA.sizes });
  }
}

/* ---------------- funciona sense connexió ---------------- */

function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  const had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // no recarreguem sols: podries tenir el cronòmetre en marxa
    if (had) toast('Versió nova a punt. Recarrega la pàgina quan vulguis.');
  });
  navigator.serviceWorker.register('sw.js')
    .catch(() => { /* sense mode fora de línia, i ja està */ });
}

/* ---------------- arrencada ---------------- */

fetch('data/puzzles.json')
  .then(r => r.json())
  .then(d => {
    DATA  = d;
    store = read(TKEY, {});
    favs  = new Set((read(FKEY, []) || []).map(Number));
    prefs = Object.assign({ mode: 'up', target: 180000, sound: true, autoTarget: true }, read(PKEY, {}));
    session    = read(SKEY, null);
    sessionLog = read(HKEY, []) || [];
    if (session && (!Array.isArray(session.ids) || session.idx >= session.ids.length)) session = null;
    computeDifficulty();

    wire();
    paintAutoTarget();
    $('#sound').setAttribute('aria-pressed', String(prefs.sound));
    $('#sound').textContent = prefs.sound ? '🔊 So activat' : '🔇 So desactivat';
    renderPresets();
    setMode(prefs.mode);
    paintWhoami();
    route();
    registerSW();
    warmSolver();
    if (playing()) syncNow({ full: true });
    if (session && current === null) {
      toast(`Tens una sessió a mitges: repte ${session.idx + 1} de ${session.ids.length}.`);
    }
  })
  .catch(() => {
    $('#main').append(el('p', 'empty', 'No s’han pogut carregar els reptes. Obre la pàgina des d’un servidor web, no com a fitxer local.'));
  });

})();
