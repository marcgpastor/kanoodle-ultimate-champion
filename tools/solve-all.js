/* Resol els 500 reptes i verifica cada solució de manera independent.
   Ús:  node tools/solve-all.js   */
const path = require('path');
require(path.join(__dirname, '..', 'js', 'solver.js'));
const S = globalThis.KanoodleSolver;
const D = require(path.join(__dirname, '..', 'data', 'puzzles.json'));

// totes les col·locacions legals, per comprovar les solucions des de fora
const legal = { 2: new Set(), 3: new Set() };
for (const dim of [2, 3])
  for (const r of (dim === 3 ? S.placements3D(D.shapes) : S.placements2D(D.shapes)))
    legal[dim].add(r.piece + '|' + r.cells.slice().sort((a, b) => a - b).join(','));

const problems = [];
let total = 0, worst = 0, worstN = 0, maxNodes = 0;

for (let n = 1; n <= 500; n++) {
  const dim = n >= 251 ? 3 : 2;
  const grid = dim === 3 ? D.p3d[n] : D.p2d[n];
  const flat = dim === 3 ? grid.flat().join('') : grid.join('');

  const t0 = process.hrtime.bigint();
  const r = S.solve(grid, dim, D.shapes, D.sizes);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  total += ms;
  if (ms > worst) { worst = ms; worstN = n; }

  if (!r.ok) { problems.push(`${n}: sense solució (${r.reason})`); continue; }
  if (r.nodes > maxNodes) maxNodes = r.nodes;

  const seen = new Set();
  for (let i = 0; i < 55; i++)
    if (flat[i] !== '.' && !r.broken.includes(flat[i])) seen.add(i);

  for (const p of r.pieces) {
    if (p.cells.length !== D.sizes[p.piece]) problems.push(`${n}: la peça ${p.piece} té ${p.cells.length} boles`);
    for (const c of p.cells) {
      if (seen.has(c)) problems.push(`${n}: solapament al forat ${c}`);
      seen.add(c);
    }
    const k = p.piece + '|' + p.cells.slice().sort((a, b) => a - b).join(',');
    if (!legal[dim].has(k)) problems.push(`${n}: la peça ${p.piece} no hi cap així`);
  }
  if (seen.size !== 55) problems.push(`${n}: cobreix ${seen.size} forats de 55`);

  const used = new Set(r.pieces.map(p => p.piece));
  for (const L of Object.keys(D.shapes))
    if (!used.has(L) && (flat.indexOf(L) < 0 || r.broken.includes(L))) problems.push(`${n}: falta la peça ${L}`);
}

console.log(`500 reptes · mitjana ${(total / 500).toFixed(2)} ms · pitjor ${worst.toFixed(0)} ms (repte ${worstN}) · nodes màx ${maxNodes}`);
if (problems.length) {
  console.log(`\n${problems.length} problemes:`);
  for (const p of problems.slice(0, 20)) console.log('  ' + p);
  process.exit(1);
}
console.log('Cap problema: totes les solucions són vàlides.');
