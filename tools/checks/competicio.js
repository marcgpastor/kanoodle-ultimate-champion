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

  const dotColor = n => page.evaluate(num => {
    return getComputedStyle(document.querySelector(`.bead[data-n="${num}"] .rivaldot`)).backgroundColor;
  }, n);
  check('verd quan el millor temps és teu', await dotColor(1), 'rgb(53, 199, 89)');
  check('roig quan hi ha temps més ràpids', await dotColor(2), 'rgb(239, 51, 56)');
  check('groc quan encara no l’has jugat', await dotColor(3), 'rgb(245, 197, 24)');
  const dotSize = await page.evaluate(() => {
    const s = getComputedStyle(document.querySelector('.bead .rivaldot'));
    return [s.width, s.height];
  });
  check('el punt fa 9 píxels', dotSize, ['9px', '9px']);

  check('la llegenda es veu amb compte', await page.isVisible('#dotkey'), true);
  check('el xip de competició es veu amb compte', await page.isVisible('[data-filter="rival"]'), true);

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

  // les estadístiques pinten amb el que diu el CSS
  await seed(page, { times: TIMES });
  await page.goto((process.env.KANOODLE_URL || 'http://localhost:8123') + '/#stats');
  await page.waitForSelector('.stats .card');
  const barColors = await page.$$eval('.bar__fill', bs =>
    [...new Set(bs.map(b => getComputedStyle(b).backgroundColor))]);
  check('les barres surten pintades', barColors.length > 0, true);
  check('cap barra sense color', barColors.includes('rgba(0, 0, 0, 0)'), false);
};
