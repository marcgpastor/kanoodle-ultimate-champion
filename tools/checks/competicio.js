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
  const URL = process.env.KANOODLE_URL || 'http://localhost:8123';
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

  // les estadístiques pinten amb el que diu el CSS: no n'hi ha prou que hi haja
  // color, cal que siga el color que toca a cada barra (bar() ve de cssVar())
  await seed(page, { times: TIMES });
  await page.goto((process.env.KANOODLE_URL || 'http://localhost:8123') + '/#stats');
  await page.waitForSelector('.stats .card');
  const barColor = label => page.evaluate(l => {
    const head = [...document.querySelectorAll('.bar__head')]
      .find(h => h.querySelector('span')?.textContent === l);
    return head ? getComputedStyle(head.nextElementSibling.querySelector('.bar__fill')).backgroundColor : null;
  }, label);
  check('barra "Reptes 2D": color del tauler pla', await barColor('Reptes 2D'), 'rgb(0, 173, 239)');
  check('barra "Reptes 3D": color de la piràmide', await barColor('Reptes 3D'), 'rgb(240, 59, 166)');
  check('barra "En total": color de «fet»', await barColor('En total'), 'rgb(152, 211, 32)');
  check('barra "1–2 min": color del gràfic per durada', await barColor('1–2 min'), 'rgb(240, 228, 6)');

  // La fitxa d'un jugador: la taula hi porta i el que hi surt ve del marcador.
  // Venim de '#stats', i seed() espera un '.bead': cal tornar a l'índex primer,
  // que route() només pinta la vista que digui l'URL.
  await page.goto(URL + '/');
  await seed(page, {
    player: { token: 'fals', id: 1, name: 'Marc' }, times: TIMES, board: BOARD,
  });
  await page.goto(URL + '/#classificacio');
  await page.waitForSelector('#boardbody table');
  check('els noms de la taula són clicables',
    await page.$$eval('#boardbody .playerlink', bs => bs.map(b => b.textContent).sort()),
    ['Anna', 'Marc', 'Pau']);

  // manen els «millors»: Anna en té 4 i jo 2, o siga que ella encapçala
  check('la taula ordena pels millors temps',
    await page.$$eval('#boardbody tbody .playerlink', bs => bs.map(b => b.textContent)),
    ['Anna', 'Marc', 'Pau']);

  await page.$eval('#boardbody tbody tr:nth-child(2) .playerlink', b => b.click());
  await page.waitForTimeout(200);
  check('obre la fitxa', await page.isVisible('#view-player'), true);
  check('i el hash la sap dir', await page.evaluate(() => location.hash), '#jugador=1');
  check('amb el nom al títol', await page.textContent('#playername'), 'Marc');
  check('la teva fitxa no es compara amb tu mateix',
    (await page.textContent('#playerbody')).includes('Cara a cara'), false);

  // Anna té temps als reptes 1, 2, 3, 260 i 520; jo tinc l'1, el 2 i el 4.
  // Coincidim en dos: el 2 me'l guanya (1:30 contra 2:00) i l'1 li'l guanye jo.
  await page.goto(URL + '/#jugador=2');
  await page.waitForSelector('#playerbody .card');
  check('la fitxa es pot obrir per URL', await page.textContent('#playername'), 'Anna');
  const resum = () => page.$$eval('#playerbody .summary__top div',
    ds => ds.map(d => [d.querySelector('dt').textContent, d.querySelector('dd').textContent]));
  check('reptes fets', (await resum()).find(r => r[0] === 'Reptes fets')[1], '5 / 700');
  check('millors de tots', (await resum()).find(r => r[0] === 'Millors de tots')[1], '4');
  check('mitjana dels seus temps', (await resum()).find(r => r[0] === 'Mitjana')[1], '01:24');
  check('cara a cara: hi ha targeta', (await page.textContent('#playerbody')).includes('Cara a cara'), true);
  check('i diu en quants coincidiu',
    (await page.textContent('#playerbody')).includes('Coincidiu en 2 reptes'), true);
  check('el teu temps primer i el seu després, als dos sentits',
    await page.$$eval('#playerbody .vs__t', ts => ts.map(t => t.textContent)),
    ['02:00.0', '01:30.0', '01:00.0', '01:30.0']);
  check('i la diferència, amb signe',
    await page.$$eval('#playerbody .summary__delta', ds => ds.map(d => [d.textContent, d.className])),
    [['+30,0 s', 'summary__delta down'], ['−30,0 s', 'summary__delta up']]);
  check('els que ha fet i tu no', (await page.textContent('#playerbody')).includes('Els que ha fet Anna i tu no · 3'), true);
  check('els que has fet tu i ella no', (await page.textContent('#playerbody')).includes('Els que has fet tu i Anna no · 1'), true);

  await page.$eval('#playerback', b => b.click());
  await page.waitForTimeout(200);
  check('des de la fitxa es torna a la classificació', await page.isVisible('#view-board'), true);

  // sense compte no hi ha fitxa que valga
  await page.goto(URL + '/');
  await seed(page, {});
  await page.goto(URL + '/#jugador=2');
  await page.waitForSelector('.bead');
  check('sense compte, la fitxa no s’obri', await page.isVisible('#view-player'), false);
};
