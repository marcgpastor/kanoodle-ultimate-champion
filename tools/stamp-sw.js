/* Posa al service worker una versió que depèn del contingut dels fitxers que
   guarda a la memòria cau. Executa'l abans de fer commit i els navegadors se
   n'adonaran tot sols que hi ha versió nova.

   Ús:  node tools/stamp-sw.js   */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const swPath = path.join(root, 'sw.js');
let sw = fs.readFileSync(swPath, 'utf8');

const list = sw.match(/const ASSETS = \[([\s\S]*?)\];/);
if (!list) { console.error('No he trobat la llista ASSETS a sw.js'); process.exit(1); }

const files = [...list[1].matchAll(/'\.\/([^']*)'/g)].map(m => m[1]).filter(Boolean);
const h = crypto.createHash('sha256');
for (const f of files.sort()) {
  const p = path.join(root, f);
  if (!fs.existsSync(p)) { console.error('Falta ' + f + ', que sw.js diu que ha de guardar'); process.exit(1); }
  h.update(f).update(fs.readFileSync(p));
}
const version = 'h' + h.digest('hex').slice(0, 10);

const before = sw.match(/const VERSION = '([^']*)'/)[1];
sw = sw.replace(/const VERSION = '[^']*'/, `const VERSION = '${version}'`);
fs.writeFileSync(swPath, sw);
console.log(before === version
  ? `Res a fer: ${version} (${files.length} fitxers)`
  : `sw.js: ${before} → ${version} (${files.length} fitxers)`);
