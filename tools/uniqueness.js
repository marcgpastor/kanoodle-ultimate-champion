/* Compta quantes solucions té cada repte i ho desa a data/puzzles.json com a
   `multi`: la llista dels que n'admeten més d'una. Els generats en tenen una i
   prou per construcció, però els comprovem igual.

   Cal executar-lo després de build_data.py, que refà el fitxer sencer.

     node tools/uniqueness.js
*/
const fs = require('fs');
const path = require('path');
require(path.join(__dirname, '..', 'js', 'solver.js'));
const S = globalThis.KanoodleSolver;

const file = path.join(__dirname, '..', 'data', 'puzzles.json');
const D = JSON.parse(fs.readFileSync(file, 'utf8'));
const sets = D.sets;
const last = Math.max(...sets.map(s => s.to));
const setOf = n => sets.find(s => n >= s.from && n <= s.to);

const multi = [];
const rars = [];
let t0 = Date.now();
for (let n = 1; n <= last; n++) {
  const dim = setOf(n).dim;
  const grid = dim === 3 ? D.p3d[n] : D.p2d[n];
  if (!grid) continue;
  // el 302 porta una peça incompleta: el resolutor la recol·loca, però comptar-hi
  // solucions amb el diagrama tal com surt no vol dir res
  if (D.notes[n]) { rars.push(n); continue; }
  let c;
  try { c = S.countSolutions(grid, dim, D.shapes, D.sizes, 2); }
  catch (e) { rars.push(n); continue; }
  if (c > 1) multi.push(n);
  else if (c === 0) rars.push(n);
}

D.multi = multi;
fs.writeFileSync(file, JSON.stringify(D));

const per = s => multi.filter(n => n >= s.from && n <= s.to).length;
console.log(`${last} reptes en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
for (const s of sets)
  console.log(`  ${s.from}–${s.to} (${s.dim}D ${s.origin}): ${s.to - s.from + 1 - per(s)} amb solució única, ${per(s)} amb més d'una`);
if (rars.length) console.log('sense comptar: ' + rars.join(', '));
