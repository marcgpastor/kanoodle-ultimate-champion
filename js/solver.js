/* Resolutor de Kanoodle: cobertura exacta per a les 12 peces, en 2D i en 3D.

   2D — tauler pla d'11x5. Cada peça es pot girar i girar del revés: 8 orientacions.

   3D — piràmide de 55 boles apilades en cúbic centrat a les cares. Amb la capa
   k = 0 a la base (5x5) i k = 4 al cim, el centre de la bola (k, i, j) és a
   (i + k/2, j + k/2, k/√2). Multiplicant per 2 les dues primeres coordenades
   queda una xarxa d'enters (X, Y, Z) = (2i + k, 2j + k, k) on les 12 direccions
   entre boles que es toquen són (±2,0,0), (0,±2,0) i (±1,±1,±1).

   Les peces són planes, així que només es poden col·locar en plans generats per
   dos vectors unitaris perpendiculars. Amb el producte escalar de l'espai real
   —(dX1·dX2 + dY1·dY2)/4 + dZ1·dZ2/2— en surten 24 parells, és a dir 3 plans
   diferents (l'horitzontal i dos de diagonals) amb les 8 simetries de cadascun. */

(function (root) {
'use strict';

/* ---------------- formes ---------------- */

const normalise = cells => {
  const r0 = Math.min(...cells.map(c => c[0]));
  const c0 = Math.min(...cells.map(c => c[1]));
  return cells.map(([r, c]) => [r - r0, c - c0]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
};
const shapeKey = cells => cells.map(c => c.join(',')).join(';');

/** les 8 orientacions d'una peça plana, sense repetits */
function orientations(cells) {
  const out = new Map();
  for (let flip = 0; flip < 2; flip++) {
    let s = flip ? cells.map(([r, c]) => [r, -c]) : cells.map(c => c.slice());
    for (let rot = 0; rot < 4; rot++) {
      s = s.map(([r, c]) => [c, -r]);
      const n = normalise(s);
      out.set(shapeKey(n), n);
    }
  }
  return [...out.values()];
}

/* ---------------- tauler pla ---------------- */

const W2 = 11, H2 = 5;

function placements2D(shapes) {
  const rows = [];
  for (const piece of Object.keys(shapes)) {
    for (const o of orientations(shapes[piece])) {
      const h = Math.max(...o.map(c => c[0])) + 1;
      const w = Math.max(...o.map(c => c[1])) + 1;
      for (let r = 0; r + h <= H2; r++)
        for (let c = 0; c + w <= W2; c++)
          rows.push({ piece, cells: o.map(([a, b]) => (r + a) * W2 + (c + b)) });
    }
  }
  return rows;
}

/* ---------------- piràmide ---------------- */

// (k, i, j) en l'ordre en què surten al diagrama: capa 1x1 primer, després 2x2...
const POS3 = [];
const IDX3 = new Map();
for (let L = 0; L <= 4; L++) {
  const k = 4 - L;
  for (let r = 0; r <= L; r++)
    for (let c = 0; c <= L; c++) {
      IDX3.set(`${2 * c + k},${2 * r + k},${k}`, POS3.length);
      POS3.push([k, c, r]);
    }
}

const UNITS = [[2, 0, 0], [-2, 0, 0], [0, 2, 0], [0, -2, 0]];
for (const x of [1, -1]) for (const y of [1, -1]) for (const z of [1, -1]) UNITS.push([x, y, z]);

const realDot = (a, b) => (a[0] * b[0] + a[1] * b[1]) / 4 + a[2] * b[2] / 2;

const BASES = [];
for (const u of UNITS) for (const v of UNITS) if (Math.abs(realDot(u, v)) < 1e-9) BASES.push([u, v]);

function placements3D(shapes) {
  const rows = [];
  for (const piece of Object.keys(shapes)) {
    const shape = normalise(shapes[piece]);
    const [br, bc] = shape[0];
    const seen = new Set();
    for (const [u, v] of BASES) {
      for (let p = 0; p < POS3.length; p++) {
        const [k, i, j] = POS3[p];
        const X = 2 * i + k, Y = 2 * j + k, Z = k;
        const cells = [];
        let ok = true;
        for (const [r, c] of shape) {
          const dr = r - br, dc = c - bc;
          const id = IDX3.get(
            `${X + dc * u[0] + dr * v[0]},${Y + dc * u[1] + dr * v[1]},${Z + dc * u[2] + dr * v[2]}`);
          if (id === undefined) { ok = false; break; }
          cells.push(id);
        }
        if (!ok) continue;
        const k2 = cells.slice().sort((a, b) => a - b).join(',');
        if (seen.has(k2)) continue;
        seen.add(k2);
        rows.push({ piece, cells });
      }
    }
  }
  return rows;
}

/* ---------------- veïnatge ---------------- */

// Quins forats es toquen. Serveix per descartar de seguida les bosses d'aire
// massa petites per a cap peça.
const NEIGH2 = Array.from({ length: 55 }, (_, id) => {
  const r = (id / W2) | 0, c = id % W2, out = [];
  if (r > 0) out.push(id - W2);
  if (r < H2 - 1) out.push(id + W2);
  if (c > 0) out.push(id - 1);
  if (c < W2 - 1) out.push(id + 1);
  return out;
});

// Els 4 forats de sota que aguanten cada bola (cap, a la base). Una bola que no
// en toca ni un penja a l'aire i la peça no s'hi aguanta.
const SUPPORT3 = POS3.map(([k, i, j]) => {
  const out = [];
  if (k === 0) return out;
  for (const dx of [1, -1]) for (const dy of [1, -1]) {
    const id = IDX3.get(`${2 * i + k + dx},${2 * j + k + dy},${k - 1}`);
    if (id !== undefined) out.push(id);
  }
  return out;
});

/**
 * Es pot parar de debò aquest diagrama 3D? Cada bola dibuixada ha de tocar-ne
 * alguna de sota, o ser a la base. Com que la regla val per a totes, cada bola
 * acaba tenint una cadena de suports fins a terra i res no queda penjat.
 * `cells` pot ser la llista plana de 55 o la cadena equivalent.
 */
function stable3D(cells) {
  for (let c = 0; c < N; c++) {
    if (cells[c] === '.') continue;
    const sup = SUPPORT3[c];
    if (!sup.length) continue;                      // ja recolza a terra
    if (!sup.some(s => cells[s] !== '.')) return false;
  }
  return true;
}

const NEIGH3 = POS3.map(([k, i, j]) => {
  const out = [];
  for (const [dx, dy, dz] of UNITS) {
    const id = IDX3.get(`${2 * i + k + dx},${2 * j + k + dy},${k + dz}`);
    if (id !== undefined) out.push(id);
  }
  return out;
});

const cache = {};
function allPlacements(shapes, dim) {
  const k = 'd' + dim;
  if (!cache[k]) cache[k] = dim === 3 ? placements3D(shapes) : placements2D(shapes);
  return cache[k];
}

/* ---------------- cobertura exacta ---------------- */

const N = 55;   // tant el tauler com la piràmide tenen 55 forats

/** cerca en profunditat: sempre s'ataca el primer forat lliure que queda */
function search(rows, freeLo, freeHi, pieces, budget, neigh, sizes, wanted = 1) {
  const list = [];
  for (const r of rows) {
    if (!pieces.includes(r.piece)) continue;
    let lo = 0, hi = 0, ok = true;
    for (const c of r.cells) {
      if (c < 32) lo |= 1 << c; else hi |= 1 << (c - 32);
    }
    if ((lo & ~freeLo) || (hi & ~freeHi)) ok = false;   // trepitja un forat ja ocupat
    if (ok) list.push({ piece: r.piece, cells: r.cells, lo, hi, pi: pieces.indexOf(r.piece) });
  }

  const byCell = Array.from({ length: N }, () => []);
  list.forEach((r, k) => { for (const c of r.cells) byCell[c].push(k); });

  const used = new Uint8Array(pieces.length);
  const chosen = [];
  let nodes = 0, count = 0, first = null;

  const stack = new Int32Array(N);
  const lowest = (lo, hi) => lo ? 31 - Math.clz32(lo & -lo) : 32 + (31 - Math.clz32(hi & -hi));

  /** cap bossa de forats aïllats pot ser més petita que la peça més petita que queda */
  function regionsOk(remLo, remHi, minSize) {
    let lo = remLo, hi = remHi;
    while (lo || hi) {
      let top = 0, size = 0;
      const seed = lowest(lo, hi);
      if (seed < 32) lo &= ~(1 << seed); else hi &= ~(1 << (seed - 32));
      stack[top++] = seed;
      while (top) {
        const c = stack[--top];
        size++;
        for (const d of neigh[c]) {
          if (d < 32) { if (lo >> d & 1) { lo &= ~(1 << d); stack[top++] = d; } }
          else { if (hi >> (d - 32) & 1) { hi &= ~(1 << (d - 32)); stack[top++] = d; } }
        }
      }
      if (size < minSize) return false;
    }
    return true;
  }

  /** el forat amb menys col·locacions possibles; -1 si algun en té zero */
  function tightest(remLo, remHi) {
    let bestCell = -2, bestFit = Infinity;
    for (let c = 0; c < N; c++) {
      if (c < 32 ? !(remLo >> c & 1) : !(remHi >> (c - 32) & 1)) continue;
      let fit = 0;
      for (const k of byCell[c]) {
        const r = list[k];
        if (used[r.pi]) continue;
        if ((r.lo & ~remLo) || (r.hi & ~remHi)) continue;
        if (++fit >= bestFit) break;
      }
      if (fit === 0) return -1;
      if (fit < bestFit) { bestFit = fit; bestCell = c; if (fit === 1) break; }
    }
    return bestCell;
  }

  function rec(remLo, remHi) {
    if (!remLo && !remHi) {
      if (!first) first = chosen.slice();
      return ++count >= wanted;
    }
    if (++nodes > budget) throw new RangeError('massa feina');
    const cell = tightest(remLo, remHi);
    if (cell < 0) return false;
    for (const k of byCell[cell]) {
      const r = list[k];
      if (used[r.pi]) continue;
      if ((r.lo & ~remLo) || (r.hi & ~remHi)) continue;
      used[r.pi] = 1; chosen.push(r);
      const nLo = remLo & ~r.lo, nHi = remHi & ~r.hi;
      let least = 99;
      for (let p = 0; p < pieces.length; p++) if (!used[p] && sizes[pieces[p]] < least) least = sizes[pieces[p]];
      if ((least === 99 || regionsOk(nLo, nHi, least)) && rec(nLo, nHi)) return true;
      used[r.pi] = 0; chosen.pop();
    }
    return false;
  }

  rec(freeLo, freeHi);
  return { found: count > 0, chosen: first, count, nodes, options: list };
}

/* ---------------- generar reptes nous ---------------- */

/** generador reproduïble: la mateixa llavor dona sempre el mateix repte */
function rngFrom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(list, rnd) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const k = Math.floor(rnd() * (i + 1));
    [out[i], out[k]] = [out[k], out[i]];
  }
  return out;
}

/** un encaix sencer de les 12 peces, triat a l'atzar */
function fullTiling(shapes, sizes, dim, rnd, budget = 2e6) {
  const rows = shuffled(allPlacements(shapes, dim), rnd);
  const pieces = shuffled(Object.keys(shapes), rnd);
  let freeLo = 0, freeHi = 0;
  for (let c = 0; c < N; c++) { if (c < 32) freeLo |= 1 << c; else freeHi |= 1 << (c - 32); }
  const res = search(rows, freeLo, freeHi, pieces, budget, dim === 3 ? NEIGH3 : NEIGH2, sizes);
  return res.found ? res.chosen : null;
}

/** quantes solucions té un repte, com a molt `limit` */
function countSolutions(grid, dim, shapes, sizes, limit = 2, budget = 2e6) {
  const { placed } = readPuzzle(grid, dim);
  const blocked = new Set();
  for (const L of Object.keys(placed)) for (const c of placed[L]) blocked.add(c);
  let freeLo = 0, freeHi = 0;
  for (let c = 0; c < N; c++) {
    if (blocked.has(c)) continue;
    if (c < 32) freeLo |= 1 << c; else freeHi |= 1 << (c - 32);
  }
  const pieces = Object.keys(shapes).filter(L => !placed[L]);
  return search(allPlacements(shapes, dim), freeLo, freeHi, pieces, budget,
                dim === 3 ? NEIGH3 : NEIGH2, sizes, limit).count;
}

/**
 * Fabrica un repte nou: parteix d'un encaix sencer, en deixa unes quantes
 * peces al tauler i amaga la resta. Només serveix si té una única solució.
 */
function generate(seed, dim, toPlace, shapes, sizes) {
  const rnd = rngFrom(seed);
  const tiling = fullTiling(shapes, sizes, dim, rnd);
  if (!tiling) return null;

  return generateFrom(tiling, dim, toPlace, shapes, sizes, rnd, seed);
}

/** a partir d'un encaix ja trobat, amaga'n unes quantes peces */
function generateFrom(tiling, dim, toPlace, shapes, sizes, rnd, seed) {
  const hidden = new Set(shuffled(tiling.map(p => p.piece), rnd).slice(0, toPlace));
  const cells = new Array(N).fill('.');
  for (const p of tiling) if (!hidden.has(p.piece)) for (const c of p.cells) cells[c] = p.piece;

  // Un repte 3D que no s'aguanta no serveix: abans de res, que es puga parar.
  if (dim === 3 && !stable3D(cells)) return null;

  const grid = dim === 3 ? to3D(cells) : to2D(cells);
  if (countSolutions(grid, dim, shapes, sizes, 2) !== 1) return null;
  return { seed, dim, toPlace, grid };
}

const to2D = cells => [0, 1, 2, 3, 4].map(r => cells.slice(r * 11, r * 11 + 11).join(''));
const to3D = cells => {
  const out = []; let i = 0;
  for (let L = 0; L <= 4; L++) {
    const layer = [];
    for (let r = 0; r <= L; r++) { layer.push(cells.slice(i, i + L + 1).join('')); i += L + 1; }
    out.push(layer);
  }
  return out;
};

/* ---------------- entrada ---------------- */

/** grid: files de text en 2D, capes de files en 3D. Torna les cel·les i les lletres. */
function readPuzzle(grid, dim) {
  const flat = dim === 3 ? grid.flat().join('') : grid.join('');
  const placed = {};
  [...flat].forEach((ch, i) => { if (ch !== '.') (placed[ch] = placed[ch] || []).push(i); });
  return { flat, placed };
}

/**
 * Resol un repte. Torna { ok, pieces: [{piece, cells}], reason }.
 * `sizes` és la mida de cada peça, per detectar diagrames incoherents.
 */
function solve(grid, dim, shapes, sizes, budget = 4e6) {
  const { flat, placed } = readPuzzle(grid, dim);
  const rows = allPlacements(shapes, dim);

  // Una peça dibuixada amb menys boles de les que té és una errata del quadern:
  // la tornem a posar en joc i deixem que el resolutor trobi on anava.
  const broken = Object.keys(placed).filter(L => placed[L].length !== sizes[L]);

  const blocked = new Set();
  for (const L of Object.keys(placed)) if (!broken.includes(L)) for (const c of placed[L]) blocked.add(c);

  let freeLo = 0, freeHi = 0, freeCount = 0;
  for (let c = 0; c < N; c++) {
    if (blocked.has(c)) continue;
    freeCount++;
    if (c < 32) freeLo |= 1 << c; else freeHi |= 1 << (c - 32);
  }

  const pieces = Object.keys(shapes).filter(L => !placed[L] || broken.includes(L));
  const need = pieces.reduce((a, L) => a + sizes[L], 0);
  if (need !== freeCount) return { ok: false, reason: 'mismatch', broken, need, freeCount };

  let res;
  try { res = search(rows, freeLo, freeHi, pieces, budget, dim === 3 ? NEIGH3 : NEIGH2, sizes); }
  catch (e) {
    if (!(e instanceof RangeError)) throw e;      // un error de debò no s'ha d'amagar
    return { ok: false, reason: 'budget', broken };
  }
  if (!res.found) return { ok: false, reason: 'unsolvable', broken, nodes: res.nodes };

  // les peces amb menys llocs possibles primer: són les pistes que més orienten
  const count = {};
  for (const r of res.options) count[r.piece] = (count[r.piece] || 0) + 1;
  const order = res.chosen.map(r => r.piece).sort((a, b) => count[a] - count[b]);

  return {
    ok: true, broken,
    pieces: res.chosen.map(r => ({ piece: r.piece, cells: r.cells.slice() })),
    order, nodes: res.nodes
  };
}

root.KanoodleSolver = { solve, generate, generateFrom, fullTiling, rngFrom, countSolutions, stable3D, placements2D, placements3D, orientations, POS3, SUPPORT3, BASES };

})(typeof globalThis !== 'undefined' ? globalThis : this);
