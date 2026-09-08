/* El mode daltònic canvia tots els colors semàntics, i cap altre. */
const URL = process.env.KANOODLE_URL || 'http://localhost:8123';
const vars = ['--rival-lead', '--rival-behind', '--rival-open',
              '--dim-2d', '--dim-3d', '--good', '--chart', '--alert', '--cyan'];

module.exports = async function ({ page, check, tap, seed }) {
  // la tanda de pistes deixa el navegador a un nivell (p. ex. #260); si no
  // tornem a l'índex abans, el reload de seed() hi manté la vista de nivell
  // amagada i mai no apareix cap .bead.
  await page.goto(URL + '/');
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

  await page.$eval('#cbmode', e => e.scrollIntoView()); // al peu de pàgina: cal que hi siga per no tapar-lo res
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
  await page.$eval('#cbmode', e => e.scrollIntoView());
  await tap(page, '#cbmode');
  check('es pot tornar arrere', await page.getAttribute('html', 'data-palette'), null);
};
