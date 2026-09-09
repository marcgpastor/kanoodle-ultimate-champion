/* La fusió amb el servidor. Ací la xarxa està tallada a posta (check-ui.js
   avorta tot el que va cap al Worker), així que fem que `KanoodleAPI.sync`
   torne el que volem i mirem què en fa la pàgina. */
module.exports = async function ({ page, check, seed }) {
  const URL = process.env.KANOODLE_URL || 'http://localhost:8123';
  const JO = { token: 'fals', id: 1, name: 'Marc' };
  const temps = () => page.evaluate(() => JSON.parse(localStorage.getItem('kanoodle.times.v1') || '{}'));
  const claus = async () => Object.keys(await temps()).sort((a, b) => a - b);

  await page.goto(URL + '/');
  await seed(page, {
    player: JO,
    times: {
      1: [{ t: 60000, d: '2026-09-01T10:00:00.000Z' }],   // el servidor també el té
      2: [{ t: 90000, d: '2026-09-02T10:00:00.000Z' }],   // esborrat des d'un altre navegador
    },
  });

  // el servidor mana: el 2 ha de marxar i el 7 ha d'arribar
  await page.evaluate(() => {
    window.__crides = 0;
    KanoodleAPI.sync = async () => {
      window.__crides++;
      return {
        sentAt: new Date().toISOString(),
        runs: [[1, 60000, '2026-09-01T10:00:00.000Z'], [7, 45000, '2026-08-30T09:00:00.000Z']],
        favs: [5], sessions: [], board: { players: [[1, 'Marc']], times: [[1, 1, 60000]] },
      };
    };
  });
  await page.evaluate(() => document.querySelector('#toboard').click());
  await page.waitForTimeout(500);

  check('un temps esborrat des d’un altre navegador desapareix d’aquí', await claus(), ['1', '7']);
  check('i el que hi han afegit hi arriba', (await temps())['7'][0].t, 45000);
  check('els favorits també vénen del servidor',
    await page.evaluate(() => JSON.parse(localStorage.getItem('kanoodle.favs.v1'))), [5]);
  check('obrir la classificació sincronitza una vegada, no dues',
    await page.evaluate(() => window.__crides), 1);

  // el que apuntes mentre la petició és en vol encara no hi pot ser: no s'ha de perdre
  await page.goto(URL + '/');
  await seed(page, { player: JO, times: {} });
  await page.goto(URL + '/#1');
  await page.waitForSelector('#lv-diagram svg');
  await page.evaluate(() => {
    KanoodleAPI.sync = () => new Promise(resol => {
      const sentAt = new Date().toISOString();
      setTimeout(() => resol({
        sentAt, runs: [], favs: [], sessions: [], board: { players: [], times: [] },
      }), 500);
    });
  });
  await page.evaluate(() => document.querySelector('#boardsync').click());
  await page.waitForTimeout(80);
  await page.fill('#manualtime', '42');
  await page.$eval('#manualform button[type=submit]', b => b.click());
  await page.waitForTimeout(900);
  check('el temps apuntat mentre la petició era en vol es queda', await claus(), ['1']);

  // un temps que ve del servidor amb mala pinta no ha d'entrar
  await page.goto(URL + '/');
  await seed(page, { player: JO, times: {} });
  await page.evaluate(() => {
    KanoodleAPI.sync = async () => ({
      sentAt: new Date().toISOString(),
      runs: [[1, 60000, '2026-09-01T10:00:00.000Z'], [9999, 5000, '2026-09-01T10:00:00.000Z'],
             [3, 999999999, '2026-09-01T10:00:00.000Z'], [4, 5000, 'ahir']],
      favs: [2, 9999], sessions: [{ mal: 1 }], board: { players: [], times: [] },
    });
  });
  await page.evaluate(() => document.querySelector('#toboard').click());
  await page.waitForTimeout(500);
  check('el que ve del servidor passa els mateixos filtres que un import', await claus(), ['1']);
  check('i els favorits també',
    await page.evaluate(() => JSON.parse(localStorage.getItem('kanoodle.favs.v1'))), [2]);
  check('i les sessions',
    await page.evaluate(() => JSON.parse(localStorage.getItem('kanoodle.sessions.v1') || '[]')), []);

  await page.goto(URL + '/');
  await page.evaluate(() => localStorage.clear());
};
