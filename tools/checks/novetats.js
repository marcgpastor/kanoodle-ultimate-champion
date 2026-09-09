/* El repte del dia, la pista d'una boleta, l'avís de solució múltiple i la
   ratxa de les estadístiques. */
const D = require('../../data/puzzles.json');

module.exports = async function ({ page, check }) {
  const URL = process.env.KANOODLE_URL || 'http://localhost:8123';
  const fantasmes = () => page.$$eval('#lv-diagram [data-ghost]', gs => gs.length);
  const resolt = () => page.waitForFunction(
    () => !document.querySelector('#hintnote').textContent.includes('Calculant'),
    null, { timeout: 60000 });
  const clic = sel => page.$eval(sel, e => e.click());

  /* ---- «Esborra-ho tot» ja no hi és ---- */
  await page.goto(URL + '/');
  await page.waitForSelector('.bead');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.bead');
  check('el peu ja no porta cap botó d’esborrar-ho tot',
    await page.$$('#wipe'), []);
  check('però continua deixant exportar i importar',
    await page.$$eval('.colophon__actions button', bs => bs.map(b => b.id)), ['export', 'import']);

  /* ---- el repte del dia ---- */
  check('la capçalera el porta', await page.isVisible('#daily'), true);
  check('i el diu pel seu nom', await page.textContent('#daily .daily__tag'), 'Repte del dia');
  const avui = await page.$eval('#daily .daily__n', e => Number(e.textContent.replace(/\D/g, '')));
  check('amb un número que existeix', avui >= 1 && avui <= 700, true);
  check('i encara pendent', await page.textContent('#daily .daily__t'), 'pendent');

  await clic('#daily');
  await page.waitForSelector('#lv-diagram svg');
  check('tocar-lo obre el repte que toca', await page.textContent('#lv-num'), String(avui));
  check('i el repte du l’etiqueta', await page.isVisible('#lv-daily'), true);
  check('amb el mateix nom', await page.textContent('#lv-daily'), 'repte del dia');

  await page.goto(URL + '/#avui');
  await page.waitForSelector('#lv-diagram svg');
  check('la drecera #avui hi porta igual', await page.textContent('#lv-num'), String(avui));
  check('i deixa el número al hash, no la drecera',
    await page.evaluate(() => location.hash), '#' + avui);

  await page.goto(URL + '/#atzar');
  await page.waitForSelector('#lv-diagram svg');
  const atzar = await page.evaluate(() => location.hash);
  check('la drecera #atzar obre un repte qualsevol', /^#\d+$/.test(atzar), true);

  /* ---- l'avís dels que tenen més d'una solució ---- */
  const multi = D.multi[0];
  const unic = [...Array(250).keys()].map(i => i + 1).find(n => !D.multi.includes(n));
  await page.goto(URL + '/#' + multi);
  await page.waitForSelector('#lv-diagram svg');
  check(`el repte ${multi} avisa que admet més d’una solució`,
    await page.isVisible('#lv-multi'), true);
  await page.goto(URL + '/#' + unic);
  await page.waitForSelector('#lv-diagram svg');
  check(`el ${unic}, que en té una de sola, no diu res`,
    await page.isVisible('#lv-multi'), false);

  /* ---- la pista més petita ---- */
  await page.goto(URL + '/#3');
  await page.waitForSelector('#lv-diagram svg');
  check('hi ha el botó de la boleta', await page.isVisible('#hintone'), true);
  await clic('#hintone');
  await resolt();
  check('una pista petita és una boleta i prou', await fantasmes(), 1);
  check('i cap peça de la llista no s’encén',
    await page.$$eval('#lv-pieces .piece.is-shown', ps => ps.length), 0);
  check('el text ho diu', (await page.textContent('#hintnote')).includes('1 boleta solta'), true);

  await clic('#hintone');
  await resolt();
  check('una altra n’afegeix una segona', await fantasmes(), 2);

  // tocar la boleta revelada acaba d'ensenyar la peça sencera
  await page.$eval('#lv-diagram [data-ghost]', g => g.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await resolt();
  check('tocar-la ensenya la peça sencera', await fantasmes() > 2, true);
  check('i ara sí que s’encén a la llista',
    await page.$$eval('#lv-pieces .piece.is-shown', ps => ps.length), 1);

  await clic('#hinthide');
  await resolt();
  check('amagar-ho tot se les emporta totes', await fantasmes(), 0);
  check('i el botó d’amagar desapareix', await page.isVisible('#hinthide'), false);

  /* ---- la ratxa ---- */
  const ahir = new Date(Date.now() - 864e5).toISOString();
  const avuiIso = new Date().toISOString();
  await page.evaluate(d => localStorage.setItem('kanoodle.times.v1', JSON.stringify({
    1: [{ t: 60000, d: d[0] }], 2: [{ t: 70000, d: d[1] }],
  })), [ahir, avuiIso]);
  // canviar només el hash no recarrega el document i l'app no rellegeix
  // localStorage: cal un reload de veres perquè els temps sembrats hi entrin
  await page.goto(URL + '/#stats');
  await page.reload();
  await page.waitForSelector('.stats .card');
  check('les estadístiques diuen la ratxa',
    (await page.textContent('#stats')).includes('Ratxa actual: 2 dies seguits'), true);

  await page.goto(URL + '/');
  await page.evaluate(() => localStorage.clear());
};
