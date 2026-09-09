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

  // El peu (amb «Esborra-ho tot») ara es veu des de qualsevol vista, no només
  // des de l'índex: cal que el clic hi repinti el que hi hagi obert en aquell
  // moment, no només l'índex de sota. #wipe usa confirm(), que en un navegador
  // sense caps no té cap diàleg real: l'ignora i torna false. Substituïm
  // window.confirm només per aquest clic i el desfem tot seguit, perquè no se'l
  // mengin les properes tandes.
  const URL = process.env.KANOODLE_URL || 'http://localhost:8123';
  const acceptConfirms = () => page.evaluate(() => {
    window.__confirmDeVeres = window.confirm;
    window.confirm = () => true;
  });
  const restoreConfirms = () => page.evaluate(() => {
    window.confirm = window.__confirmDeVeres;
    delete window.__confirmDeVeres;
  });

  // venim de '#stats': cal tornar a l'índex abans de seed(), perquè el reload
  // no torna a cridar renderIndex() (route() només pinta la vista de l'URL)
  // i el «.bead» que espera seed() no hi arribaria mai.
  await page.goto(URL + '/');
  await seed(page, {
    times: { 1: [{ t: 60000, d: '2026-09-01T10:00:00.000Z' }, { t: 50000, d: '2026-09-02T10:00:00.000Z' }] },
  });
  // canviar només el hash no recarrega el document (el navegador ho tracta com
  // a navegació dins la mateixa pàgina), i llavors app.js no rellegeix res de
  // localStorage: cal fixar el hash i fer un reload de veres perquè arrenqui
  // amb la sessió ja present.
  await page.evaluate(() => {
    localStorage.setItem('kanoodle.session.v1', JSON.stringify({
      ids: [1, 2], idx: 0, results: [], startedAt: new Date().toISOString(),
    }));
    location.hash = '#1';
  });
  await page.reload();
  await page.waitForSelector('#lv-times li');
  check('abans d’esborrar: hi ha temps al nivell obert',
    await page.$$eval('#lv-times li', li => li.length), 2);
  check('abans d’esborrar: la sessió es veu',
    await page.isVisible('#sessionbar'), true);
  check('abans d’esborrar: comptador de sessió',
    await page.textContent('#sessioncounter'), '1 de 2');

  await acceptConfirms();
  await tap(page, '#wipe');
  await restoreConfirms();

  check('esborrar buida la llista de temps sense navegar enlloc',
    await page.$$eval('#lv-times li', li => li.map(x => x.textContent)),
    ['Cap temps desat encara.']);
  check('esborrar treu el gràfic d’evolució del nivell obert',
    await page.$$('#lv-spark polyline'), []);
  check('esborrar amaga la barra de sessió perquè ja no n’hi ha',
    await page.isVisible('#sessionbar'), false);
  check('esborrar torna a mostrar la barra normal del nivell',
    await page.isVisible('#levelbar'), true);

  // el mateix, però amb la classificació oberta: esborrar tanca la sessió amb
  // el servidor (API.logout()) i, si no repintem, la taula es queda ensenyant
  // algú que ja no ha entrat enlloc
  await page.goto(URL + '/');   // venim de '#1': mateix motiu que abans
  await seed(page, {
    player: { token: 'fals', id: 1, name: 'Marc' }, times: TIMES, board: BOARD,
  });
  await page.goto(URL + '/#classificacio');
  await page.waitForSelector('#boardbody table');
  check('abans d’esborrar: hi surts a la classificació',
    (await page.textContent('#boardbody')).includes('Marc'), true);

  await acceptConfirms();
  await tap(page, '#wipe');
  await restoreConfirms();

  const boardTxt = await page.textContent('#boardbody');
  check('esborrar treu la classificació de sobre: ja no hi ets',
    boardTxt.includes('Encara no hi ets'), true);
  check('esborrar no deixa ningú a la taula, encara que sigui vella',
    boardTxt.includes('Marc'), false);

  // i des de l'índex: esborrar tanca la sessió, així que la capçalera no pot
  // continuar dient «Jugues com a», ni quedar-se el xip ni la llegenda
  await page.goto(URL + '/');
  await seed(page, {
    player: { token: 'fals', id: 1, name: 'Marc' }, times: TIMES, board: BOARD,
  });
  check('abans d’esborrar: la capçalera diu qui ets',
    (await page.textContent('#whoami')).includes('Jugues com a'), true);
  check('abans d’esborrar: el xip de competició es veu',
    await page.isVisible('[data-filter="rival"]'), true);

  await acceptConfirms();
  await tap(page, '#wipe');
  await restoreConfirms();

  check('esborrar ho diu també a la capçalera',
    (await page.textContent('#whoami')).includes('Jugues com a'), false);
  check('esborrar amaga el xip de competició',
    await page.isVisible('[data-filter="rival"]'), false);
  check('esborrar amaga la llegenda dels punts',
    await page.isVisible('#dotkey'), false);
};
