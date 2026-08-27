/* Fabrica les dues tandes de reptes nous i les afegeix a data/puzzles.json.

   Cada repte surt d'un encaix sencer de les 12 peces: se'n deixen unes quantes
   al tauler i s'amaguen la resta. A diferència del quadern, aquí exigim que hi
   hagi **una única solució**, i els ordenem de menys a més peces per col·locar.

   És determinista: amb la mateixa llavor surten sempre els mateixos reptes.

   Ús:  node tools/generate.js [--seed 20260827] [--count 100]            */

const fs = require('fs');
const path = require('path');
require(path.join(__dirname, '..', 'js', 'solver.js'));
const S = globalThis.KanoodleSolver;

const DATA = path.join(__dirname, '..', 'data', 'puzzles.json');
const D = JSON.parse(fs.readFileSync(DATA, 'utf8'));

const arg = (name, def) => {
  const i = process.argv.indexOf('--' + name);
  return i > 0 ? Number(process.argv[i + 1]) : def;
};
const SEED = arg('seed', 20260827);
const COUNT = arg('count', 100);

// Quants reptes volem de cada dificultat. El quadern es concentra a 4–6 peces;
// aquí obrim el ventall perquè hi hagi de ben fàcils i de ben difícils.
const CURVE = { 2: 6, 3: 10, 4: 14, 5: 16, 6: 16, 7: 14, 8: 12, 9: 8, 10: 4 };

function makeBatch(dim, seed) {
  const want = {};
  const total = Object.values(CURVE).reduce((a, b) => a + b, 0);
  for (const k of Object.keys(CURVE)) want[k] = Math.round(CURVE[k] / total * COUNT);

  const got = {};
  const out = [];
  const seen = new Set();
  let s = seed, tilings = 0;

  while (out.length < COUNT) {
    const rnd = S.rngFrom(s++);
    const tiling = S.fullTiling(D.shapes, D.sizes, dim, rnd);
    if (!tiling) continue;
    tilings++;

    // d'un mateix encaix en traiem uns quants reptes: la part cara ja està feta
    for (let i = 0; i < 40 && out.length < COUNT; i++) {
      const need = Object.keys(want).filter(k => (got[k] || 0) < want[k]);
      if (!need.length) break;
      const k = Number(need[Math.floor(rnd() * need.length)]);
      const p = S.generateFrom(tiling, dim, k, D.shapes, D.sizes, rnd, s);
      if (!p) continue;
      const key = (dim === 3 ? p.grid.flat() : p.grid).join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      got[k] = (got[k] || 0) + 1;
      out.push({ grid: p.grid, toPlace: k });
    }
    if (tilings > 400) break;   // xarxa de seguretat
  }

  out.sort((a, b) => a.toPlace - b.toPlace);
  return { out, tilings };
}

const batches = [
  { dim: 2, from: 501, seed: SEED },
  { dim: 3, from: 601, seed: SEED + 1 },
];

const sets = [
  { from: 1, to: 250, dim: 2, origin: 'book' },
  { from: 251, to: 500, dim: 3, origin: 'book' },
];

for (const b of batches) {
  const t0 = Date.now();
  const { out, tilings } = makeBatch(b.dim, b.seed);
  const dict = b.dim === 3 ? D.p3d : D.p2d;
  for (const k of Object.keys(dict)) if (Number(k) >= b.from) delete dict[k];
  out.forEach((p, i) => { dict[b.from + i] = p.grid; });

  const spread = {};
  for (const p of out) spread[p.toPlace] = (spread[p.toPlace] || 0) + 1;
  console.log(`${b.dim}D · ${out.length} reptes ${b.from}–${b.from + out.length - 1} · ` +
    `${tilings} encaixos · ${Math.round((Date.now() - t0) / 1000)} s`);
  console.log('   peces per col·locar: ' +
    Object.keys(spread).sort((a, c) => a - c).map(k => `${k}→${spread[k]}`).join('  '));

  sets.push({ from: b.from, to: b.from + out.length - 1, dim: b.dim, origin: 'gen', seed: b.seed });
}

D.sets = sets;
fs.writeFileSync(DATA, JSON.stringify(D));
console.log('data/puzzles.json:', Math.round(fs.statSync(DATA).size / 1024), 'KB');
