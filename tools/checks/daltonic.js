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
  check('normal: el 2D és cian', normal['--dim-2d'], '#00ADEF');
  check('normal: la piràmide és magenta', normal['--dim-3d'], '#F03BA6');
  check('normal: «va bé» és verd llima', normal['--good'], '#98D320');
  check('normal: el gràfic de barres és groc', normal['--chart'], '#F0E406');
  check('normal: l’alerta és magenta', normal['--alert'], '#F03BA6');
  check('normal: el cian d’acció és el de sempre', normal['--cyan'], '#00ADEF');

  await tap(page, '#cbmode');
  check('l’interruptor queda encés', await page.getAttribute('#cbmode', 'aria-pressed'), 'true');
  check('l’atribut hi és', await page.getAttribute('html', 'data-palette'), 'daltonic');

  const cb = await palette();
  check('daltònic: blau cel', cb['--rival-lead'], '#56B4E9');
  check('daltònic: vermelló', cb['--rival-behind'], '#D55E00');
  check('daltònic: gris', cb['--rival-open'], '#C8C0B6');
  check('daltònic: el 2D passa a blau cel', cb['--dim-2d'], '#56B4E9');
  check('daltònic: la piràmide passa a taronja', cb['--dim-3d'], '#E69F00');
  check('daltònic: «va bé» passa a groc pàl·lid', cb['--good'], '#F0E442');
  check('daltònic: el gràfic de barres passa a taronja', cb['--chart'], '#E69F00');
  check('daltònic: l’alerta passa a vermelló', cb['--alert'], '#D55E00');
  check('el cian d’acció no es mou en mode daltònic', cb['--cyan'], '#00ADEF');

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

  // el sparkline de temps del nivell (sparkline() a app.js): setPalette() l'ha
  // de repintar en calent, no només quan renderTimes() es crida per una altra via.
  // Calia tornar a '/' abans: veníem de '#stats' i el reload de seed() hi hauria
  // deixat la vista d'estadístiques oberta, amb `.bead` present però amagat.
  await page.goto(URL + '/');
  await seed(page, {
    times: { 1: [{ t: 60000, d: '2026-09-01T10:00:00.000Z' }, { t: 50000, d: '2026-09-02T10:00:00.000Z' }] },
  });
  await page.goto(URL + '/#1');
  await page.waitForSelector('#lv-spark polyline');
  check('sparkline: color normal abans de canviar de mode',
    await page.$eval('#lv-spark polyline', e => e.getAttribute('stroke').toUpperCase()), '#00ADEF');

  // La lletra de la peça és el canal que no depèn del color.
  const letterOn = piece => page.evaluate(L => {
    const t = [...document.querySelectorAll('#lv-pieces svg text')]
      .find(x => x.textContent === L);
    if (!t) return null;
    const s = getComputedStyle(t);
    return {
      fill: t.getAttribute('fill'), weight: s.fontWeight,
      stroke: t.getAttribute('stroke'), paintOrder: t.getAttribute('paint-order'),
    };
  }, piece);

  // encara en mode normal: la negreta i el contorn només han d'aparèixer en
  // mode daltònic, no sempre
  const normalC = await letterOn('C');
  check('normal: la lletra no va en negreta', normalC && normalC.weight, '600');
  check('normal: sense stroke ni paint-order',
    normalC && [normalC.stroke, normalC.paintOrder], [null, null]);

  // El peu viu fora de les .view, o siga que #cbmode es pot clicar de veres
  // encara que hi haja un nivell obert: és exactament l'escenari que calia
  // cobrir, que `setPalette()` es cride amb `current !== null`.
  await tap(page, '#cbmode');
  check('sparkline: es repinta en calent quan s’encén el mode',
    await page.$eval('#lv-spark polyline', e => e.getAttribute('stroke').toUpperCase()), '#56B4E9');

  await page.goto(URL + '/');
  await page.waitForSelector('.bead');
  await tap(page, '#cbmode');
  check('es pot tornar arrere', await page.getAttribute('html', 'data-palette'), null);

  // sense parpelleig de veres: cap comprovació de dalt ho pot detectar perquè
  // totes esperen `.bead`, que només apareix quan puzzles.json ja s'ha
  // resolt —moment en què l'arrencada ja ha cridat setPalette(prefs.cb) igualment.
  // Aquí, en canvi, mirem l'atribut MENTRE la petició encara està pendent.
  //
  // `page.route()` per si sol no basta: `sw.js` ja té l'origen en caché (les
  // altres tandes ja han passat per ací) i respon puzzles.json des del Service
  // Worker sense tocar mai la xarxa, així que la ruta de Playwright no s'arriba
  // a cridar i la comprovació passaria encara que el fragment no hi fos. Cal
  // forçar-ho per CDP: xarxa sense caché i sense Service Worker.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.setBypassServiceWorker', { bypass: true });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('kanoodle.prefs.v1', JSON.stringify({ cb: true }));
  });
  await page.route('**/data/puzzles.json', async route => {
    await new Promise(r => setTimeout(r, 1000));
    await route.continue();
  });
  await page.goto(URL + '/');
  check('sense parpelleig: l’atribut ja hi és mentre puzzles.json encara està pendent',
    await page.getAttribute('html', 'data-palette'), 'daltonic');
  await page.waitForSelector('.bead');   // deixa acabar la petició abans de plegar
  await page.unroute('**/data/puzzles.json');
  await cdp.send('Network.setBypassServiceWorker', { bypass: false });
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: false });
  await cdp.detach();

  await page.goto(URL + '/#1');
  await page.waitForSelector('#lv-pieces svg');
  const clara = await letterOn('C');     // peça C, blau cel: lletra fosca
  check('sobre una peça clara, lletra fosca', clara && clara.fill, '#16110F');
  const fosca = await letterOn('J');     // peça J, indi: lletra clara
  check('sobre una peça fosca, lletra clara', fosca && fosca.fill, '#F4EFE9');
  check('en mode daltònic la lletra va en negreta', fosca && fosca.weight, '700');
  check('en mode daltònic hi ha contorn: paint-order', fosca && fosca.paintOrder, 'stroke');
  check('en mode daltònic el contorn és el contrari del farciment',
    fosca && fosca.stroke, '#16110F');

  // L'interruptor va fix a la cantonada i per damunt de la barra de filtres,
  // que està enganxada a dalt. El perill és que li quede a sobre justament
  // quan has fet scroll, que és quan la barra puja. Es comprova amb la pàgina
  // desplaçada i a dues amplàries: ampla i estreta, on l'etiqueta es plega.
  const marca = () => page.evaluate(() =>
    getComputedStyle(document.querySelector('.cbswitch__knob'), '::after')
      .content.replace(/["']/g, ''));

  const noTapat = async ample => {
    await page.setViewportSize({ width: ample, height: 800 });
    await page.goto(URL + '/');
    await page.waitForSelector('.bead');
    await page.evaluate(() => window.scrollTo(0, 600));
    return page.evaluate(() => {
      const sw = document.querySelector('#cbmode');
      const r = sw.getBoundingClientRect();
      const sota = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      const solapa = ['#random', '#startsession', '#jump', '.segmented']
        .map(s => document.querySelector(s))
        .filter(Boolean)
        .filter(e => {
          const b = e.getBoundingClientRect();
          return !(r.right <= b.left || r.left >= b.right ||
                   r.bottom <= b.top || r.top >= b.bottom);
        }).length;
      return { tocable: !!sota && (sota === sw || sw.contains(sota)), solapa };
    });
  };

  check('amb la finestra ampla i la pàgina avall, l’interruptor és tocable',
    await noTapat(1280), { tocable: true, solapa: 0 });
  check('amb la finestra estreta i la pàgina avall, també',
    await noTapat(390), { tocable: true, solapa: 0 });

  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(URL + '/');
  await seed(page, {});
  check('apagat, l’interruptor marca O', await marca(), 'O');
  await tap(page, '#cbmode');
  check('encés, marca I', await marca(), 'I');
  check('i el mode s’ha encés de veres',
    await page.getAttribute('html', 'data-palette'), 'daltonic');
  await tap(page, '#cbmode');
  check('tornar-lo a tocar el torna a O', await marca(), 'O');
};
