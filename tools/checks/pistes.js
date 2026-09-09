/* Els buits del tauler i la llista de peces són la mateixa palanca. */
module.exports = async function ({ page, check }) {
  const ghosts = () => page.evaluate(() =>
    [...new Set([...document.querySelectorAll('#lv-diagram [data-ghost]')].map(g => g.dataset.ghost))].sort());
  const lit = () => page.evaluate(() =>
    [...document.querySelectorAll('#lv-pieces .piece.is-shown')].map(p => p.dataset.piece).sort());
  const holes = () => page.$$eval('#lv-diagram [data-hole]', hs => hs.map(h => Number(h.dataset.hole)));
  const solved = () => page.waitForFunction(
    () => !document.querySelector('#hintnote').textContent.includes('Calculant'),
    // 60 s i no 25: el primer repte 3D pot passar del parell de segons quan la
    // màquina va carregada, i amb 25 s la tanda ha petat un parell de vegades
    // sense que hi haguera res trencat.
    null, { timeout: 60000 });
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
