# Mode daltònic i colors dels punts — pla d'implementació

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donar significat als punts de competició amb verd, roig i groc, i afegir un mode daltònic que canvia tots els colors semàntics de l'aplicació sense tocar els 12 colors de peça.

**Architecture:** Les variables CSS passen a ser l'única font de veritat del color. `:root` defineix colors semàntics (què vol dir el color, no quin és) i `html[data-palette="daltonic"]` els redefineix en bloc. Els llocs on el JS pinta SVG deixen d'escriure literals i llegeixen la variable amb un ajudant `cssVar()`. Els 12 colors de peça i `BEADS[]` no es toquen.

**Tech Stack:** HTML, CSS i JavaScript plans, sense build ni framework. Comprovacions amb `playwright-core` sobre Chromium, com a dependència de desenvolupament.

**Spec:** `docs/superpowers/specs/2026-09-08-mode-daltonic-design.md`

## Global Constraints

- **Cap dependència en temps d'execució.** El que es publica continua sent HTML, CSS i JS plans. `playwright-core` és només per desenvolupar.
- **Els 12 colors de peça no es toquen.** Ni `data/puzzles.json` ni `BEADS[]` a `js/app.js:231`. El diagrama ha de continuar corresponent-se amb la capsa física.
- **`--cyan` no canvia entre modes.** El blau es distingeix bé en totes dues visions i fa d'«acció» per tota la interfície.
- **Català a tota la interfície i als missatges de commit.** Els missatges de commit segueixen l'estil del repositori: assumpte en una línia amb l'efecte visible i cos explicant què fallava i què s'ha comprovat. **Cap línia d'atribució a cap eina.**
- **Segell del service worker.** Quan canvie qualsevol fitxer de la llista `ASSETS` de `sw.js`, cal executar `node tools/stamp-sw.js` abans del commit.
- **Aquesta màquina no dibuixa fotogrames.** Chromium hi arrenca però no entrega imatges: `page.screenshot()` i el `click()` accionable de Playwright s'hi pengen. Per això el banc de proves despatxa els clics amb `el.click()` i comprova a banda, amb `elementFromPoint`, que l'element no estiga tapat. **No canvieu això per `page.click()`.**

---

### Task 1: El banc de proves del navegador

Abans de tocar cap color, cal poder demostrar que no s'ha trencat res. El projecte no té cap comprovació de la interfície: `tools/solve-all.js` només mira el resolutor. Aquesta tasca crea el banc i hi tanca el comportament d'avui.

**Files:**
- Create: `package.json`
- Create: `tools/check-ui.js`
- Create: `tools/checks/competicio.js`
- Create: `tools/checks/pistes.js`
- Modify: `.gitignore` (afegir `node_modules/`)
- Modify: `README.md` (secció nova «Comprovar la interfície»)

**Interfaces:**
- Consumes: res.
- Produces: `tools/check-ui.js`, executable amb `node tools/check-ui.js`, que surt amb codi 1 si falla res. Exporta per a les tasques següents les funcions internes `check(nom, obtingut, esperat)`, `tap(page, selector)` i `seed(page, dades)`.

- [ ] **Step 1: Crear `package.json`**

El lloc publicat continua sense dependències; això és només per desenvolupar.

```json
{
  "name": "kanoodle-ultimate-champion",
  "private": true,
  "description": "Només dependències de desenvolupament: el lloc publicat és HTML, CSS i JS plans.",
  "scripts": {
    "check": "node tools/check-ui.js",
    "solve": "node tools/solve-all.js"
  },
  "devDependencies": {
    "playwright-core": "^1.49.0"
  }
}
```

- [ ] **Step 2: Instal·lar i comprovar que Chromium hi és**

```bash
npm install
npx playwright install chromium
```

Si `npx playwright install` falla perquè no hi ha xarxa, mireu si ja hi ha un Chromium a `~/.cache/ms-playwright/`: el banc el busca allí.

- [ ] **Step 3: Escriure el banc**

Crear `tools/check-ui.js`:

```js
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
```

- [ ] **Step 4: Escriure la tanda de competició**

Crear `tools/checks/competicio.js`. Tanca el comportament que ja hi ha: els quatre estats de punt, el filtre i els conjunts del diàleg de sessió.

```js
/* Els punts de competició de l'índex, el filtre i el diàleg de sessió. */
const BOARD = {
  at: Date.now(),
  players: [[1, 'Marc'], [2, 'Anna'], [3, 'Pau']],
  times: [
    [1, 1, 60000], [1, 2, 90000],      // 1: el millor és el teu
    [2, 1, 120000], [2, 2, 90000],     // 2: n'hi ha de més ràpids
    [3, 2, 90000], [3, 3, 95000],      // 3: no l'has jugat
    [4, 1, 60000],                     // 4: només tu -> sense punt
    [260, 2, 80000], [520, 2, 70000],
  ],
};
const TIMES = {
  1: [{ t: 60000, d: '2026-09-01T10:00:00.000Z' }],
  2: [{ t: 120000, d: '2026-09-01T10:00:00.000Z' }],
  4: [{ t: 60000, d: '2026-09-01T10:00:00.000Z' }],
};

module.exports = async function ({ page, check, tap, seed }) {
  await seed(page, {
    player: { token: 'fals', id: 1, name: 'Marc' }, times: TIMES, board: BOARD,
  });

  const dotOf = n => page.evaluate(num => {
    const b = document.querySelector(`.bead[data-n="${num}"]`);
    if (!b) return 'ABSENT';
    const d = b.querySelector('.rivaldot');
    return d ? [...d.classList].find(c => c.startsWith('is-')) : 'cap';
  }, n);

  check('punt: el millor temps és teu', await dotOf(1), 'is-lead');
  check('punt: hi ha temps més ràpids', await dotOf(2), 'is-behind');
  check('punt: encara no l’has jugat', await dotOf(3), 'is-open');
  check('sense punt quan només hi has jugat tu', await dotOf(4), 'cap');
  check('sense punt quan no hi ha jugat ningú', await dotOf(5), 'cap');
  check('la llegenda es veu amb compte', await page.isVisible('#dotkey'), true);
  check('el xip de competició es veu amb compte', await page.isVisible('[data-filter="rival"]'), true);

  await tap(page, '[data-filter="rival"]');
  const shown = await page.evaluate(() =>
    [...document.querySelectorAll('.bead')].map(b => Number(b.dataset.n)).sort((a, b) => a - b));
  check('el filtre deixa els reptes amb feina', shown, [2, 3, 260, 520]);

  await tap(page, '[data-filter="2d"]');
  await tap(page, '#startsession');
  const seeded = await page.evaluate(() => [
    document.querySelector('#sessiondim .is-on').dataset.dim,
    document.querySelector('#sessionorigin .is-on').dataset.origin,
  ]);
  check('els xips del diàleg se sembren des del filtre', seeded, ['2d', 'all']);
  const pool = () => page.evaluate(() => document.querySelector('#sessionpool b')?.textContent || null);
  check('conjunt 2D i tots', await pool(), '350');
  await tap(page, '#sessiondim [data-dim="3d"]');
  check('el diàleg mana sobre el filtre de l’índex', await pool(), '350');
  await tap(page, '#sessionorigin [data-origin="book"]');
  check('conjunt 3D i del quadern', await pool(), '250');
  await tap(page, '#sessionorigin [data-origin="gen"]');
  check('conjunt 3D i nous', await pool(), '100');
  await tap(page, '#sessiondim [data-dim="mix"]');
  await tap(page, '#sessionorigin [data-origin="all"]');
  check('conjunt mixt i tots', await pool(), '700');
  await tap(page, '#sessioncancel');

  // sense compte no ha de sortir res de competició, i els filtres de sempre
  // han de donar el mateix que abans de partir passes()
  await seed(page, {});
  const countWith = async f => {
    await tap(page, `[data-filter="${f}"]`);
    return page.$$eval('.bead', bs => bs.length);
  };
  check('sense filtre: 700', await countWith('all'), 700);
  check('2D: 350', await countWith('2d'), 350);
  check('3D: 350', await countWith('3d'), 350);
  check('del quadern: 500', await countWith('book'), 500);
  check('nous: 200', await countWith('gen'), 200);
  check('pendents sense cap temps: 700', await countWith('todo'), 700);
  check('fets sense cap temps: 0', await countWith('done'), 0);
  check('favorits: 0', await countWith('fav'), 0);
  check('sense compte, xip amagat', await page.isVisible('[data-filter="rival"]'), false);
  check('sense compte, llegenda amagada', await page.isVisible('#dotkey'), false);
  check('sense compte, cap punt', await page.$$eval('.bead .rivaldot', d => d.length), 0);
};
```

- [ ] **Step 5: Escriure la tanda de pistes**

Crear `tools/checks/pistes.js`.

```js
/* Els buits del tauler i la llista de peces són la mateixa palanca. */
module.exports = async function ({ page, check }) {
  const ghosts = () => page.evaluate(() =>
    [...new Set([...document.querySelectorAll('#lv-diagram [data-ghost]')].map(g => g.dataset.ghost))].sort());
  const lit = () => page.evaluate(() =>
    [...document.querySelectorAll('#lv-pieces .piece.is-shown')].map(p => p.dataset.piece).sort());
  const holes = () => page.$$eval('#lv-diagram [data-hole]', hs => hs.map(h => Number(h.dataset.hole)));
  const solved = () => page.waitForFunction(
    () => !document.querySelector('#hintnote').textContent.includes('Calculant'),
    null, { timeout: 25000 });
  const fire = sel => page.$eval(sel, e => e.dispatchEvent(new MouseEvent('click', { bubbles: true })));

  for (const [n, kind] of [[3, '2D'], [260, '3D']]) {
    await page.goto((process.env.KANOODLE_URL || 'http://localhost:8123') + '/#' + n);
    await page.waitForSelector('#lv-diagram svg');

    check(`${kind}: hi ha buits clicables`, (await holes()).length > 0, true);
    check(`${kind}: el títol d’un buit no diu cap lletra`,
      await page.$eval('#lv-diagram [data-hole] title', t => t.textContent),
      'Ensenya’m què va aquí');

    const target = (await holes())[0];
    await fire(`#lv-diagram [data-hole="${target}"]`);
    await solved();
    const g1 = await ghosts();
    check(`${kind}: ix una peça i prou`, g1.length, 1);
    check(`${kind}: la llista de baix s’encén igual`, await lit(), g1);
    check(`${kind}: ix la peça sencera, no una boleta`,
      await page.$$eval('#lv-diagram [data-ghost]', gs => gs.length) > 1, true);
    check(`${kind}: el buit tocat ja no és un buit`, (await holes()).includes(target), false);

    await fire('#lv-diagram [data-ghost]');
    await solved();
    check(`${kind}: el segon clic l’amaga`, await ghosts(), []);
    check(`${kind}: i la llista de baix s’apaga`, await lit(), []);
    check(`${kind}: el buit torna a ser-ho`, (await holes()).includes(target), true);

    const before = await ghosts();
    const hit = await page.evaluate(() => {
      const c = [...document.querySelectorAll('#lv-diagram circle')]
        .find(x => !x.closest('[data-hole]') && !x.closest('[data-ghost]'));
      if (!c) return false;
      c.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return true;
    });
    check(`${kind}: hi ha boletes impreses`, hit, true);
    check(`${kind}: clicar una boleta impresa no fa res`, await ghosts(), before);
  }
};
```

- [ ] **Step 6: Executar el banc contra el codi d'avui**

```bash
python3 -m http.server 8123 &
node tools/check-ui.js
```

Esperat: **0 fallades** (han de ser unes 48 comprovacions; el nombre exacte el diu el banc i no és el criteri). Si en falla alguna, el banc està mal escrit —el codi d'avui és el bo—; arregleu el banc, no l'aplicació.

- [ ] **Step 7: Documentar-ho al README**

Afegir després de la secció «Fer-la anar en local»:

```markdown
## Comprovar la interfície

```bash
npm install && npx playwright install chromium
python3 -m http.server 8123 &
node tools/check-ui.js
```

Obre la web en un Chromium i comprova el comportament de l'índex, els filtres,
el mode sessió i les pistes. És l'única dependència del projecte i només fa
falta per desenvolupar: el que es publica continua sent HTML, CSS i JS plans.
```

Afegir també `node_modules/` a `.gitignore`.

- [ ] **Step 8: Commit**

```bash
git add package.json .gitignore tools/check-ui.js tools/checks/ README.md
git commit -F - <<'MSG'
Un banc de proves per a la interfície

`tools/solve-all.js` comprova el resolutor, però de la interfície no en
comprovava res ningú: els filtres, el mode sessió i les pistes s'havien de
provar a mà cada vegada. Abans de posar-me a canviar colors per tota
l'aplicació, val més tenir el comportament d'avui tancat.

48 comprovacions sobre el lloc de veres en un Chromium: els quatre estats dels
punts de competició, que el filtre deixa exactament els reptes amb feina, els
conjunts del diàleg de sessió, els comptes de tots els filtres de sempre, i que
els buits del tauler i la llista de peces mouen la mateixa palanca en 2D i en
3D.

Els clics es despatxen en comptes de fer servir `page.click()`. En una màquina
sense pantalla Chromium arrenca però no entrega fotogrames, i l'espera
d'«element estable» de Playwright no s'acaba mai; la comprovació que de veres
importa —que el botó no estiga tapat— es fa amb `elementFromPoint`.

`playwright-core` és l'única dependència i és de desenvolupament: el que es
publica continua sense cap.
MSG
```

---

### Task 2: Variables semàntiques al CSS

Cap canvi de comportament: en acabar, la pàgina s'ha de veure exactament igual.

**Files:**
- Modify: `css/style.css:4-16` (bloc `:root`), i els 27 usos de `var(--lime)` i `var(--magenta)`

**Interfaces:**
- Consumes: res.
- Produces: les variables `--rival-lead`, `--rival-behind`, `--rival-open`, `--dim-2d`, `--dim-3d`, `--good`, `--alert`, `--chart`, definides a `:root`. Les tasques 3, 4 i 5 s'hi recolzen.

- [ ] **Step 1: Afegir les variables semàntiques a `:root`**

Deixar `--cyan`, `--lime`, `--magenta` i `--amber` on són —són entrades de paleta— i afegir a sota:

```css
  /* Colors semàntics: què vol dir el color, no quin és. Són els que canvien
     amb el mode daltònic; la paleta de dalt es queda quieta. */
  --good:#98D320;          /* fet, rècord, va bé */
  --alert:#F03BA6;         /* passat de temps, esborrar, errata */
  --dim-2d:#00ADEF;        /* el tauler pla, a gràfics i llegendes */
  --dim-3d:#F03BA6;        /* la piràmide, a gràfics i llegendes */
  --chart:#F0E406;         /* barres del repartiment per durada */
  --rival-lead:#F5C518;    /* el millor temps és teu */
  --rival-behind:#F79806;  /* hi ha temps més ràpids */
  --rival-open:#8A7F78;    /* encara no l'has jugat */
```

Els tres `--rival-*` conserven de moment els colors d'avui: els canvia la tasca 3.

- [ ] **Step 2: Apuntar els usos amb significat a les variables noves**

> Els números de línia són d'abans del pas 1, que n'afegeix nou a `:root`.
> **Manen els selectors**, no els números.

`var(--lime)` → `var(--good)` a: `.scoreboard dd b` (69), `.sessionbar__total` (228), `.dots i.is-done` (236, dues vegades), `.summary__delta.up` (259), `.clock__presets button.is-best` i `.is-best.is-on` (347, 351, 352), `.clock.is-running .clock__time` (364), `.times__best` i `.times__best .times__val` (414, 415), `.whoami b` (423), `.rivals__list li.is-first .rivals__t` (440), `.standings .crown` (453), `.toplist__bar` (465).

`var(--magenta)` → `var(--alert)` a: `.bead.is-fav::after` (163), `.dots i.is-skip` (237), `.fav[aria-pressed="true"]` (279), `.level__note` (291), `.clock.is-over .clock__time` (366), `.times__del:hover` (417), `.whoami button:hover` (428), `.link--danger` (513).

Es queden amb `var(--lime)` perquè són decoració de la tanda generada, no significat: `.rack--gen .rack__head b` (189) i `.rack--gen .bead:not(.is-done):hover` (190).

- [ ] **Step 3: Els literals de la mateixa família**

Aquests estan escrits a mà i han de seguir la variable que els toca. Fer-los derivats amb `color-mix` perquè canvien sols:

```css
/* 279-280 */
.fav[aria-pressed="true"]{color:#2B0016;border-color:var(--alert);background:var(--alert)}
.fav[aria-pressed="true"]:hover{
  color:#2B0016;
  border-color:color-mix(in srgb, var(--alert) 78%, #fff);
  background:color-mix(in srgb, var(--alert) 78%, #fff)
}
/* 291 */
.level__note{
  color:color-mix(in srgb, var(--alert) 28%, #fff);
  background:color-mix(in srgb, var(--alert) 13%, transparent);
  border-left:3px solid var(--alert);
```

```css
/* 347 */
  background:color-mix(in srgb, var(--good) 12%, transparent);
  border-color:var(--good);color:var(--good)
```

`rgba(152,211,32,.28)` de `.rack--gen` (188) es queda: és la decoració verda de les tandes generades, que no canvia amb el mode.

- [ ] **Step 4: Comprovar que no s'ha mogut res**

```bash
node tools/check-ui.js
```

Esperat: **0 fallades.**

- [ ] **Step 5: Commit**

```bash
node tools/stamp-sw.js
git add css/style.css sw.js
git commit -F - <<'MSG'
Els colors amb significat es diuen pel que volen dir

`--lime` i `--magenta` no eren dos colors de la paleta: carregaven significat
per tota la interfície —millors temps, rellotge en marxa, corona, estrella de
favorit, «Esborra-ho tot», l'avís d'errata—, 27 usos entre les dues. Amb noms
de color no es pot canviar la paleta sense que el CSS quede mentint.

Ara hi ha `--good` i `--alert`, més `--dim-2d`, `--dim-3d`, `--chart` i els tres
`--rival-*`. Els usos que porten significat hi apunten; `--lime` es queda on és
decoració de la tanda generada i prou. Els cinc literals de la mateixa família
que hi havia escrits a mà passen a derivar-se amb `color-mix`, de manera que
seguiran la variable soles.

Cap canvi de comportament ni d'aspecte: els mateixos colors, dits d'una altra
manera. Les 48 comprovacions no es mouen.
MSG
```

---

### Task 3: El JS llig el color del CSS

**Files:**
- Modify: `js/app.js` — ajudant nou, i les línies 492, 496, 662, 664, 739, 747, 778, 787, 806

**Interfaces:**
- Consumes: les variables de la tasca 2.
- Produces: `cssVar(nom)` retorna el valor calculat de la variable com a text (per exemple `'#98D320'`), amb memòria; i `forgetColors()` la buida.

- [ ] **Step 1: Escriure l'ajudant**

Just després de `const el = ...` (línia 14):

```js
// El color viu al CSS i el JS l'hi va a buscar: així el mode daltònic el canvia
// en un sol lloc. `getComputedStyle` no és gratis i els gràfics en demanen uns
// quants per pintada, o siga que es desa fins que canvia el mode.
const colorMemo = new Map();
const cssVar = name => {
  if (!colorMemo.has(name))
    colorMemo.set(name, getComputedStyle(document.documentElement).getPropertyValue(name).trim());
  return colorMemo.get(name);
};
const forgetColors = () => colorMemo.clear();
```

- [ ] **Step 2: Substituir els literals**

| Línia | Ara | Nou |
|---|---|---|
| 492 | `stroke: '#00ADEF'` | `stroke: cssVar('--dim-2d')` |
| 496 | `p.t === min ? '#98D320' : '#00ADEF'` | `p.t === min ? cssVar('--good') : cssVar('--dim-2d')` |
| 662 | `s.dim === 3 ? '#F03BA6' : '#00ADEF'` | `s.dim === 3 ? cssVar('--dim-3d') : cssVar('--dim-2d')` |
| 664 | `'#98D320'` | `cssVar('--good')` |
| 739 | `color-mix(in srgb, #98D320 ...` | `` `color-mix(in srgb, ${cssVar('--good')} ...` `` |
| 747 | `color-mix(in srgb, #98D320 ...` | `` `color-mix(in srgb, ${cssVar('--good')} ...` `` |
| 778 | `is3D(r.n) ? '#F03BA6' : '#00ADEF'` | `is3D(r.n) ? cssVar('--dim-3d') : cssVar('--dim-2d')` |
| 787 | `[['#00ADEF', '2D'], ['#F03BA6', '3D']]` | `[[cssVar('--dim-2d'), '2D'], [cssVar('--dim-3d'), '3D']]` |
| 806 | `'#F0E406'` | `cssVar('--chart')` |

Els grisos d'eixos i graella (`#6E635E` a 179, 771 i 781; `#2C2522` a 739, 747 i 770) i `ringColor()` (227) no es toquen: ja són neutres i valen per als dos modes.

- [ ] **Step 3: Afegir la comprovació que els gràfics no han canviat de color**

A `tools/checks/competicio.js`, al final:

```js
  // les estadístiques pinten amb el que diu el CSS
  await page.goto((process.env.KANOODLE_URL || 'http://localhost:8123') + '/#stats');
  await page.waitForSelector('.stats .card');
  const barColors = await page.$$eval('.bar__fill', bs =>
    [...new Set(bs.map(b => getComputedStyle(b).backgroundColor))]);
  check('les barres surten pintades', barColors.length > 0, true);
  check('cap barra sense color', barColors.includes('rgba(0, 0, 0, 0)'), false);
```

- [ ] **Step 4: Executar el banc**

```bash
node tools/check-ui.js
```

Esperat: **0 fallades**, amb dues comprovacions més que abans.

- [ ] **Step 5: Commit**

```bash
node tools/stamp-sw.js
git add js/app.js tools/checks/competicio.js sw.js
git commit -F - <<'MSG'
Els gràfics agafen el color del full d'estils

Hi havia una vintena de colors escrits a mà dins d'`app.js` per pintar les
barres de progrés, el calendari d'activitat, el minigràfic de cada repte i la
dispersió d'intents. Amb el color repartit entre el CSS i el JS, canviar la
paleta volia dir canviar-la en dos llocs i confiar que no se te'n descuidara
cap.

Ara el JS demana el color al CSS amb `cssVar()`, que el desa fins que canvia el
mode: `getComputedStyle` no és gratis i els gràfics en demanen uns quants per
pintada. Els grisos d'eixos i graella es queden escrits, que són neutres i
valen igual per a tots dos modes.

Mateixos colors que abans. Les 48 comprovacions de sempre no es mouen, i n'hi
ha dues de noves que miren que les barres de les estadístiques surten pintades
de veres.
MSG
```

---

### Task 4: Els colors i la mida nous dels punts

**Files:**
- Modify: `css/style.css` (les tres `--rival-*` i el bloc `.rivaldot`)
- Modify: `tools/checks/competicio.js`

**Interfaces:**
- Consumes: les variables de la tasca 2.
- Produces: res de nou.

- [ ] **Step 1: Escriure la comprovació que ha de fallar**

A `tools/checks/competicio.js`, després de les comprovacions dels quatre estats:

```js
  const dotColor = n => page.evaluate(num =>
    getComputedStyle(document.querySelector(`.bead[data-n="${num}"] .rivaldot`)).backgroundColor, n);
  check('verd quan el millor temps és teu', await dotColor(1), 'rgb(53, 199, 89)');
  check('roig quan hi ha temps més ràpids', await dotColor(2), 'rgb(239, 51, 56)');
  check('groc quan encara no l’has jugat', await dotColor(3), 'rgb(245, 197, 24)');
  const dotSize = await page.evaluate(() => {
    const s = getComputedStyle(document.querySelector('.bead .rivaldot'));
    return [s.width, s.height];
  });
  check('el punt fa 9 píxels', dotSize, ['9px', '9px']);
```

- [ ] **Step 2: Executar el banc i veure-les fallar**

```bash
node tools/check-ui.js
```

Esperat: **FALLA**, amb `rgb(245, 197, 24)` on s'esperava el verd i `7px` on s'esperaven 9.

- [ ] **Step 3: Canviar els colors i la mida**

A `:root`:

```css
  --rival-lead:#35C759;    /* el millor temps és teu */
  --rival-behind:#EF3338;  /* hi ha temps més ràpids */
  --rival-open:#F5C518;    /* encara no l'has jugat */
```

I al bloc `.rivaldot`, amb les variables en comptes de `--gold`/`--amber`, més grans i amb més vora:

```css
.rivaldot{
  width:9px;height:9px;border-radius:50%;display:inline-block;flex:none;
  box-shadow:0 0 0 2px var(--ink)
}
.rivaldot.is-lead{background:var(--rival-lead)}
.rivaldot.is-behind{background:var(--rival-behind)}
.rivaldot.is-open{background:var(--rival-open)}
```

Esborrar `--gold` de `:root`: ja no la fa servir ningú.

- [ ] **Step 4: Executar el banc**

```bash
node tools/check-ui.js
```

Esperat: **0 fallades**, amb quatre comprovacions més que abans.

- [ ] **Step 5: Commit**

```bash
node tools/stamp-sw.js
git add css/style.css tools/checks/competicio.js sw.js
git commit -F - <<'MSG'
Els punts de l'índex passen a verd, roig i groc

Eren daurat, taronja i gris, que no diuen res per si sols: calia mirar la
llegenda cada vegada per recordar quin volia dir què. Ara verd si el millor
temps és el teu, roig si n'hi ha de més ràpids i groc si encara no l'has jugat,
que és el que espera qualsevol sense haver de llegir res.

De 7 a 9 píxels, amb la vora fosca de 1,5 a 2. En fer-los més grans cal més
separació: una boleta feta es pinta amb un color de peça, i els tres colors dels
punts també són colors de peça.

Verd i roig és justament el parell que pitjor distingeix qui té daltonisme
roig-verd. El mode que ho resol ve a la tasca següent; mentrestant el significat
també va escrit al títol emergent, a l'`aria-label` de cada boleta i a la
llegenda.
MSG
```

---

### Task 5: El mode daltònic

**Files:**
- Modify: `css/style.css` (bloc `[data-palette="daltonic"]`)
- Modify: `index.html` (botó al peu)
- Modify: `js/app.js` (aplicació primerenca, `prefs.cb`, cablejat)
- Modify: `tools/checks/` — fitxer nou `tools/checks/daltonic.js`
- Modify: `tools/check-ui.js` (carregar la tanda nova)

**Interfaces:**
- Consumes: totes les variables de les tasques 2 i 4, i `forgetColors()` de la tasca 3.
- Produces: `prefs.cb` (booleà), `setPalette(on)`, i l'atribut `document.documentElement.dataset.palette === 'daltonic'`.

- [ ] **Step 1: Escriure la tanda que ha de fallar**

Crear `tools/checks/daltonic.js`:

```js
/* El mode daltònic canvia tots els colors semàntics, i cap altre. */
const URL = process.env.KANOODLE_URL || 'http://localhost:8123';
const vars = ['--rival-lead', '--rival-behind', '--rival-open',
              '--dim-2d', '--dim-3d', '--good', '--chart', '--alert', '--cyan'];

module.exports = async function ({ page, check, tap, seed }) {
  await seed(page, {});

  const palette = () => page.evaluate(names => {
    const s = getComputedStyle(document.documentElement);
    return Object.fromEntries(names.map(n => [n, s.getPropertyValue(n).trim().toUpperCase()]));
  }, vars);

  check('l’interruptor és al peu', await page.isVisible('#cbmode'), true);
  check('comença apagat', await page.getAttribute('#cbmode', 'aria-pressed'), 'false');

  const normal = await palette();
  check('normal: el punt de dalt és verd', normal['--rival-lead'], '#35C759');
  check('normal: el de baix és roig', normal['--rival-behind'], '#EF3338');

  await tap(page, '#cbmode');
  check('l’interruptor queda encés', await page.getAttribute('#cbmode', 'aria-pressed'), 'true');
  check('l’atribut hi és', await page.getAttribute('html', 'data-palette'), 'daltonic');

  const cb = await palette();
  check('daltònic: blau cel', cb['--rival-lead'], '#56B4E9');
  check('daltònic: vermelló', cb['--rival-behind'], '#D55E00');
  check('daltònic: gris', cb['--rival-open'], '#C8C0B6');
  check('daltònic: la piràmide passa a taronja', cb['--dim-3d'], '#E69F00');
  check('daltònic: «va bé» passa a groc pàl·lid', cb['--good'], '#F0E442');
  check('daltònic: l’alerta passa a vermelló', cb['--alert'], '#D55E00');
  check('el cian d’acció no es mou', cb['--cyan'], normal['--cyan']);

  // el que importa: que arribe al que es pinta, no només a les variables
  await seed(page, {
    prefs: { cb: true },
    player: { token: 'fals', id: 1, name: 'Marc' },
    times: { 1: [{ t: 60000, d: '2026-09-01T10:00:00.000Z' }] },
    board: { at: Date.now(), players: [[1, 'Marc'], [2, 'Anna']], times: [[1, 1, 60000], [1, 2, 90000]] },
  });
  check('la preferència sobreviu a recarregar',
    await page.getAttribute('#cbmode', 'aria-pressed'), 'true');
  check('sense parpelleig: l’atribut hi és des del principi',
    await page.getAttribute('html', 'data-palette'), 'daltonic');
  check('el punt surt pintat de blau cel',
    await page.evaluate(() =>
      getComputedStyle(document.querySelector('.bead[data-n="1"] .rivaldot')).backgroundColor),
    'rgb(86, 180, 233)');

  await page.goto(URL + '/#stats');
  await page.waitForSelector('.stats .card');
  check('als gràfics no queda cap verd ni cap magenta',
    await page.evaluate(() => {
      const mals = ['rgb(152, 211, 32)', 'rgb(240, 59, 166)'];
      return [...document.querySelectorAll('.stats *')]
        .flatMap(e => { const s = getComputedStyle(e); return [s.backgroundColor, s.color, s.fill]; })
        .filter(c => mals.includes(c)).length;
    }), 0);

  await page.goto(URL + '/');
  await page.waitForSelector('.bead');
  await tap(page, '#cbmode');
  check('es pot tornar arrere', await page.getAttribute('html', 'data-palette'), null);
};
```

Carregar-la a `tools/check-ui.js`:

```js
  for (const suite of [require('./checks/competicio'),
                       require('./checks/pistes'),
                       require('./checks/daltonic')]) {
```

- [ ] **Step 2: Executar-la i veure-la fallar**

```bash
node tools/check-ui.js
```

Esperat: **FALLA** a la primera, «l'interruptor és al peu»: encara no existeix `#cbmode`.

- [ ] **Step 3: El bloc de la paleta daltònica**

A `css/style.css`, just després del bloc `:root`:

```css
/* Mode daltònic, pensat per al roig-verd (deuteranopia i protanopia). Blau i
   taronja és el parell que millor s'hi distingeix; quan n'hi ha d'haver tres
   alhora, el tercer és neutre o es diferencia per claredat i no per to. Els 12
   colors de peça no hi entren: el diagrama s'ha de continuar assemblant a la
   capsa que tens damunt la taula. */
html[data-palette="daltonic"]{
  --good:#F0E442;
  --alert:#D55E00;
  --dim-2d:#56B4E9;
  --dim-3d:#E69F00;
  --chart:#E69F00;
  --rival-lead:#56B4E9;
  --rival-behind:#D55E00;
  --rival-open:#C8C0B6;
}
```

- [ ] **Step 4: El botó al peu**

A `index.html`, dins de `.colophon__actions`, després del botó d'esborrar:

```html
      <button type="button" id="cbmode" class="link" aria-pressed="false">Mode daltònic</button>
```

- [ ] **Step 5: Aplicar la preferència abans que arribe cap dada**

A dalt de tot de `js/app.js`, just després de `'use strict';`:

```js
// Abans que res: si no, qui té el mode encés veuria els colors normals mentre
// es baixa puzzles.json, que és quan es llig `prefs`. localStorage és síncron.
try {
  const saved = JSON.parse(localStorage.getItem('kanoodle.prefs.v1') || '{}');
  if (saved && saved.cb) document.documentElement.dataset.palette = 'daltonic';
} catch {}
```

- [ ] **Step 6: La preferència i el cablejat**

Afegir `cb: false` al valor per defecte de `prefs` (línia 35 i la còpia de l'arrencada):

```js
let prefs = { mode: 'up', target: 180000, sound: true, autoTarget: true, cb: false };
```

Una funció que aplica el mode i repinta el que estiga a la vista, al costat de `paintWhoami()`:

```js
/** encén o apaga el mode daltònic i torna a pintar el que es veja */
function setPalette(on) {
  if (on) document.documentElement.dataset.palette = 'daltonic';
  else delete document.documentElement.dataset.palette;
  $('#cbmode').setAttribute('aria-pressed', String(!!on));
  forgetColors();                       // el JS té colors desats que ja no valen
  if (!$('#view-index').hidden) renderIndex();
  if (!$('#view-stats').hidden) renderStats();
  if (current !== null) paintHints();   // el diagrama i la llista de peces
}
```

A `wire()`:

```js
  $('#cbmode').onclick = () => {
    prefs.cb = !prefs.cb;
    savePrefs();
    setPalette(prefs.cb);
  };
```

I a l'arrencada, al costat d'on es pinta el botó del so:

```js
    setPalette(prefs.cb);
```

- [ ] **Step 7: Executar el banc**

```bash
node tools/check-ui.js
```

Esperat: **0 fallades**, amb divuit comprovacions més que abans.

- [ ] **Step 8: Commit**

```bash
node tools/stamp-sw.js
git add css/style.css index.html js/app.js tools/check-ui.js tools/checks/daltonic.js sw.js
git commit -F - <<'MSG'
Un mode daltònic per a tota l'aplicació

Els punts nous són verd i roig, que és justament el parell que no distingeix qui
té daltonisme roig-verd —el 8% dels homes—. I no eren només els punts: el 2D i
el 3D es diferenciaven per cian i magenta a totes les estadístiques, i el verd
de «va bé» contra el magenta d'alerta apareixia al rellotge, als millors temps i
a la corona de la classificació.

Un interruptor al peu, al costat d'Exporta i Importa, posa
`data-palette="daltonic"` a l'arrel i redefineix els vuit colors semàntics de
cop: blau cel i vermelló, que és el parell que millor s'hi distingeix, i quan
n'hi ha d'haver tres alhora el tercer és neutre o es diferencia per claredat i
no per to. El cian d'acció no es mou: el blau ja es distingeix bé.

Els 12 colors de peça no hi entren. El diagrama ha de continuar assemblant-se a
la capsa que tens damunt la taula, que és tot el sentit que té.

La preferència es desa com el so i el compte enrere, però s'aplica al principi
del guió i no en llegir `prefs`: aquest es llig dins del `then` del `fetch` de
`puzzles.json`, i esperar-hi hauria fet parpellejar els colors normals durant
un instant a qui té el mode encés.

18 comprovacions noves: que els vuit colors canvien i el cian no, que arriba al
que es pinta de veres i no només a les variables, que la preferència sobreviu a
recarregar, que l'atribut ja hi és abans que es pinte res, i que amb el mode
encés no queda cap verd ni cap magenta enlloc de les estadístiques.
MSG
```

---

### Task 6: La lletra de les peces

**Files:**
- Modify: `js/app.js:141-148` (el text dins de `ball()`)
- Modify: `tools/checks/daltonic.js`

**Interfaces:**
- Consumes: `document.documentElement.dataset.palette` de la tasca 5.
- Produces: `luma(hex)` retorna la lluminància relativa (0 a 1) d'un color `#RRGGBB`.

- [ ] **Step 1: Escriure les comprovacions que han de fallar**

Al final de `tools/checks/daltonic.js`:

```js
  // La lletra de la peça és el canal que no depèn del color.
  const letterOn = (n, piece) => page.evaluate(([num, L]) => {
    const t = [...document.querySelectorAll('#lv-pieces svg text')]
      .find(x => x.textContent === L);
    if (!t) return null;
    const s = getComputedStyle(t);
    return { fill: t.getAttribute('fill'), weight: s.fontWeight };
  }, [n, piece]);

  await page.goto(URL + '/#1');
  await page.waitForSelector('#lv-pieces svg');
  const clara = await letterOn(1, 'C');     // peça C, blau cel: lletra fosca
  check('sobre una peça clara, lletra fosca', clara && clara.fill, '#16110F');
  const fosca = await letterOn(1, 'J');     // peça J, indi: lletra clara
  check('sobre una peça fosca, lletra clara', fosca && fosca.fill, '#F4EFE9');
  check('en mode daltònic la lletra va en negreta', fosca && fosca.weight, '700');
```

- [ ] **Step 2: Executar el banc i veure-les fallar**

```bash
node tools/check-ui.js
```

Esperat: **FALLA** a «sobre una peça fosca, lletra clara»: ara la lletra és sempre `#16110F`.

- [ ] **Step 3: La regla de lluminositat**

Just abans de `function ball(...)`, a `js/app.js`:

```js
// Lluminància relativa d'un color de peça, per triar si la lletra hi va fosca
// o clara. Les 12 peces són gairebé totes clares, però l'indi de la J no ho és
// i amb lletra fosca no s'hi llegia res.
function luma(hex) {
  const v = i => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4);
  };
  return .2126 * v(1) + .7152 * v(3) + .0722 * v(5);
}

// El punt on el contrast de la lletra fosca i el de la clara s'igualen. Amb un
// llindar de 0,5 passarien a lletra clara sis de les dotze peces, que és un
// canvi gros i no volgut; amb 0,18 només hi cau l'indi de la J, que és el que
// es volia arreglar.
const LLINDAR_LLETRA = .18;
```

Lluminàncies de les dotze peces, per si cal comprovar-ho: A 0,42 · B 0,21 ·
C 0,36 · D 0,45 · E 0,53 · F 1,00 · G 0,58 · H 0,24 · I 0,74 · J **0,12** ·
K 0,78 · L 0,53.

- [ ] **Step 4: Fer-la servir al text de `ball()`**

Substituir el bloc del text (línies 141-148) per:

```js
  const dark = luma(DATA.colors[letter]) > LLINDAR_LLETRA;   // peça clara -> lletra fosca
  const cb = document.documentElement.dataset.palette === 'daltonic';
  const t = svgEl('text', {
    x: cx, y: cy, fill: ghost ? DATA.colors[letter] : (dark ? '#16110F' : '#F4EFE9'),
    'fill-opacity': ghost ? .95 : 1,
    'text-anchor': 'middle', 'dominant-baseline': 'central',
    'font-family': 'IBM Plex Sans, sans-serif',
    'font-weight': cb ? '700' : '600',
    'font-size': r * (cb ? 1.35 : 1.15)
  });
  // en mode daltònic la lletra és el que distingeix la peça: que no es perda
  // contra cap color, per fosc o clar que siga
  if (cb && !ghost) {
    t.setAttribute('stroke', dark ? '#F4EFE9' : '#16110F');
    t.setAttribute('stroke-width', r * .07);
    t.setAttribute('stroke-opacity', '.55');
    t.setAttribute('paint-order', 'stroke');
  }
```

- [ ] **Step 5: Executar el banc**

```bash
node tools/check-ui.js
```

Esperat: **0 fallades**, amb tres comprovacions més que abans.

- [ ] **Step 6: Commit**

```bash
node tools/stamp-sw.js
git add js/app.js tools/checks/daltonic.js sw.js
git commit -F - <<'MSG'
La lletra de cada peça s'hi llig sempre

Les peces no canvien de color amb el mode daltònic —el diagrama ha de continuar
assemblant-se a la capsa que tens damunt la taula—, o siga que qui no distingeix
el roig del verd ha de poder tirar de la lletra que cada boleta ja porta. El
problema és que la lletra es pintava sempre fosca (`#16110F`), i sobre l'indi de
la peça J no s'hi llegia res. És un defecte que ja hi era; el mode només el
posava en evidència.

Ara la lletra es pinta fosca o clara segons la lluminància relativa de la peça,
sempre i no només en mode daltònic. I amb el mode encés creix de `r*1.15` a
`r*1.35`, passa a pes 700 i guanya un contorn del color contrari amb
`paint-order: stroke`, que és el que la fa aguantar contra qualsevol dels 12
colors.

Comprovat que sobre la peça I (groga) la lletra queda fosca, sobre la J (indi)
queda clara, i que amb el mode encés va en negreta.
MSG
```

---

### Task 7: Els textos neutres

**Files:**
- Modify: `index.html:52, 73-75`
- Modify: `js/app.js:313, 857, 882, 887-888, 1587`
- Modify: `tools/checks/competicio.js`

**Interfaces:** cap de nova.

- [ ] **Step 1: Escriure la comprovació que ha de fallar**

A `tools/checks/competicio.js`, després de les comprovacions dels punts:

```js
  const vells = ['Hi manes', 'Et guanyen', 'Em guanyen', 'hi tens el millor temps',
                 'et guanyen', 'No et guanyen enlloc'];
  check('cap text vell enlloc del DOM', await page.evaluate(mots => {
    const tot = document.body.innerHTML;
    return mots.filter(m => tot.includes(m));
  }, vells), []);
  check('la llegenda es diu pel fet', await page.$$eval('#dotkey span', ss => ss.map(s => s.textContent)),
    ['El millor temps és teu', 'Hi ha temps més ràpids', 'Encara no l’has jugat']);
  check('el xip diu què en pots fer',
    await page.$eval('[data-filter="rival"]', b => b.textContent), 'Per millorar');
```

- [ ] **Step 2: Executar el banc i veure-la fallar**

```bash
node tools/check-ui.js
```

Esperat: **FALLA**, amb la llista de textos vells trobats al DOM.

- [ ] **Step 3: Canviar-los**

`index.html`:

```html
      <button type="button" data-filter="rival" aria-pressed="false" hidden>Per millorar</button>
```

```html
    <p class="dotkey" id="dotkey" hidden>
      <span><i class="rivaldot is-lead"></i>El millor temps és teu</span>
      <span><i class="rivaldot is-behind"></i>Hi ha temps més ràpids</span>
      <span><i class="rivaldot is-open"></i>Encara no l'has jugat</span>
    </p>
```

`js/app.js:313`:

```js
      : filter === 'rival'
        ? 'No hi ha cap repte amb un temps més ràpid que el teu.'
```

`js/app.js:857`, el comentari de `rivalState()`:

```js
 *   'lead'    el millor temps de tots és el teu
 *   'behind'  l'has jugat, però n'hi ha de més ràpids
```

`js/app.js:882-888`, dins de `rivalNote()`:

```js
  if (st === 'lead') return ', el millor temps és el teu';
  const idx = boardIndex();
  const [pid, ms] = idx.byPuzzle.get(n)[0];
  const who = idx.names.get(pid) || 'algú';
  return st === 'open'
    ? `, encara no l’has jugat; el d’${who} és ${fmt(ms)}`
    : `, el temps més ràpid és d’${who}: ${fmt(ms)}`;
```

`js/app.js:1587`, dins de `REST_NAME`:

```js
                      fav: 'els favorits', rival: 'aquells amb un temps més ràpid que el teu' };
```

- [ ] **Step 4: Executar el banc**

```bash
node tools/check-ui.js
```

Esperat: **0 fallades**, amb tres comprovacions més que abans.

- [ ] **Step 5: Commit**

```bash
node tools/stamp-sw.js
git add index.html js/app.js tools/checks/competicio.js sw.js
git commit -F - <<'MSG'
Els estats es diuen pel que passa, no per qui guanya

«Hi manes» i «Et guanyen» sonaven a pati d'escola i, a més, descrivien una
posició en comptes del fet. Ara la llegenda diu «El millor temps és teu», «Hi ha
temps més ràpids» i «Encara no l'has jugat», i el xip del filtre passa a dir
«Per millorar», que a més diu què en pots fer en comptes de com vas.

El mateix als títols emergents, als `aria-label` de cada boleta, al missatge de
llista buida i a l'avís del diàleg de sessió.

Comprovat que cap dels sis textos vells queda enlloc del DOM.
MSG
```

---

### Task 8: Documentar-ho

**Files:**
- Modify: `README.md`

**Interfaces:** cap.

- [ ] **Step 1: Documentar el mode**

A la llista de «Què fa», després del punt de «Com vas contra els altres»:

```markdown
- **Mode daltònic**: un interruptor al peu canvia tots els colors que s'inventa
  la web —els punts de competició, el 2D i el 3D dels gràfics, el verd de «fet»
  i el magenta d'alerta— per una paleta de blau i taronja, que és la que millor
  es distingeix amb daltonisme roig-verd. Els 12 colors de les peces no es
  toquen: el diagrama s'ha de continuar assemblant a la capsa que tens damunt la
  taula. A canvi, la lletra de cada boleta es fa més gran i amb més contrast.
```

Actualitzar també el punt de «Com vas contra els altres», que parla de daurat,
taronja i gris, perquè diga verd, roig i groc, i el filtre passa a dir-se
«Per millorar».

- [ ] **Step 2: Executar el banc una última vegada**

```bash
node tools/check-ui.js
```

Esperat: **0 fallades**, amb tres comprovacions més que abans.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -F - <<'MSG'
Documenta el mode daltònic

El README encara deia que els punts de l'índex eren daurats, taronges i grisos,
i del mode daltònic no en deia res.
MSG
```

---

## Self-review

**Cobertura de l'especificació.** Cada secció té tasca: l'arquitectura de
variables (2 i 3), la taula de la paleta (2, 4 i 5), les variables que ja hi
havia (2), els llocs d'`app.js` (3), l'interruptor i el «sense parpelleig» (5),
les peces (6), els textos (7), la mida dels punts (4), la verificació (1, i
cada tasca hi afegeix la seua), la documentació (8).

**Comptes de comprovacions.** 53 en acabar la tasca 1; +2 a la 3 (55); +4 a la
4 (59); +18 a la 5 (77); +3 a la 6 (80); +3 a la 7 (83).

**Noms.** `cssVar()`, `forgetColors()`, `setPalette()`, `luma()`, `prefs.cb`,
`data-palette="daltonic"` i les vuit variables (`--good`, `--alert`, `--dim-2d`,
`--dim-3d`, `--chart`, `--rival-lead`, `--rival-behind`, `--rival-open`) es
diuen igual a totes les tasques on surten.

**Fora d'especificació, decidit ací.** L'especificació demanava comprovar al
navegador però no deia amb què. La tasca 1 hi posa `package.json` amb
`playwright-core` com a única dependència de desenvolupament. Això toca el
«sense dependències» del projecte, encara que només per a qui desenvolupa i no
per a qui hi juga. **Si no es vol, cal dir-ho abans de començar la tasca 1** i
les comprovacions es quedaran fora del repositori.
