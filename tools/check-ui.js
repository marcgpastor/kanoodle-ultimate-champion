/* Comprovacions de la interfície, al navegador i sobre el lloc de veres.
   No és cap dependència del web: fa falta per desenvolupar, igual que el
   poppler dels scripts d'extracció.

     npm install && npx playwright install chromium
     python3 -m http.server 8123 &
     node tools/check-ui.js

   Els clics es despatxen amb `el.click()` i no amb `page.click()`. En una
   màquina sense pantalla Chromium arrenca però no entrega fotogrames, i
   l'espera d'«element estable» de Playwright no s'acaba mai. Per no perdre
   la comprovació que de veres importa —que el botó no estiga tapat per res—
   es mira amb `elementFromPoint` abans de clicar. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright-core');

const BASE = process.env.KANOODLE_URL || 'http://localhost:8123';

/** Chromium: el que instal·la Playwright, o el que digui KANOODLE_CHROME. */
function chromePath() {
  if (process.env.KANOODLE_CHROME) return process.env.KANOODLE_CHROME;
  const root = path.join(os.homedir(), '.cache', 'ms-playwright');
  if (!fs.existsSync(root)) return undefined;
  const dirs = fs.readdirSync(root).filter(d => d.startsWith('chromium')).sort().reverse();
  for (const d of dirs) {
    for (const rel of [
      ['chrome-linux64', 'chrome'],
      ['chrome-linux', 'chrome'],
      ['chrome-headless-shell-linux64', 'chrome-headless-shell'],
    ]) {
      const p = path.join(root, d, ...rel);
      if (fs.existsSync(p)) return p;
    }
  }
  return undefined;
}

const fails = [];
let count = 0;

function check(name, got, want) {
  count++;
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails.push(`${name}\n    esperava ${JSON.stringify(want)}\n    he trobat ${JSON.stringify(got)}`);
  console.log(`${ok ? 'ok  ' : 'FALLA'} ${name}`);
  return ok;
}

/** Clic despatxat, amb comprovació que l'element no estiga tapat. */
async function tap(page, selector) {
  const ok = await page.$eval(selector, e => {
    const r = e.getBoundingClientRect();
    const at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    e.click();
    return r.width > 0 && r.height > 0 && (at === e || e.contains(at));
  });
  if (!ok) fails.push(`${selector}: no es pot clicar (tapat o sense mida)`);
}

/** Deixa el navegador amb un compte i un marcador de mentida, i recarrega. */
async function seed(page, { player, times, board, favs, prefs }) {
  await page.evaluate(d => {
    localStorage.clear();
    if (d.player) localStorage.setItem('kanoodle.player.v1', JSON.stringify(d.player));
    if (d.times) localStorage.setItem('kanoodle.times.v1', JSON.stringify(d.times));
    if (d.board) localStorage.setItem('kanoodle.board.v1', JSON.stringify(d.board));
    if (d.favs) localStorage.setItem('kanoodle.favs.v1', JSON.stringify(d.favs));
    if (d.prefs) localStorage.setItem('kanoodle.prefs.v1', JSON.stringify(d.prefs));
  }, { player, times, board, favs, prefs });
  await page.reload();
  await page.waitForSelector('.bead');
}

async function main() {
  const exe = chromePath();
  if (!exe) {
    console.error('No trobe cap Chromium. Executeu `npx playwright install chromium`.');
    process.exit(2);
  }
  const browser = await chromium.launch({ executablePath: exe });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  // res no ha de sortir cap a la xarxa de veritat
  await ctx.route('**/*.workers.dev/**', r => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => {
    if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) errors.push(m.text());
  });
  await page.goto(BASE + '/');

  for (const suite of [require('./checks/competicio'), require('./checks/pistes')]) {
    await suite({ page, check, tap, seed });
  }

  check('cap error de consola', errors, []);
  await browser.close();

  console.log(`\n${count} comprovacions, ${fails.length} fallades.`);
  if (fails.length) {
    console.log('\n' + fails.join('\n'));
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
