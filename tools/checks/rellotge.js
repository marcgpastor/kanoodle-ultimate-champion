/* El rellotge i el que se'n pot perdre: el temps que es desa, l'objectiu del
   compte enrere i canviar de repte amb la volta en marxa. */
module.exports = async function ({ page, check }) {
  const URL = process.env.KANOODLE_URL || 'http://localhost:8123';
  const open = async n => {
    await page.goto(URL + '/#' + n);
    await page.waitForSelector('#lv-diagram svg');
  };
  const desats = () => page.evaluate(() =>
    JSON.parse(localStorage.getItem('kanoodle.times.v1') || '{}'));
  const manual = async txt => {
    await page.fill('#manualtime', txt);
    await page.$eval('#manualform button[type=submit]', b => b.click());
    await page.waitForTimeout(120);
  };
  /** confirm() no existeix de veres sense caps: el posem nosaltres i comptem */
  const confirms = async resposta => page.evaluate(r => {
    window.__confirms = 0;
    window.__confirmDeVeres = window.confirm;
    window.confirm = () => { window.__confirms++; return r; };
  }, resposta);
  const restore = () => page.evaluate(() => {
    window.confirm = window.__confirmDeVeres;
    delete window.__confirmDeVeres;
    return window.__confirms;
  });

  /* ---- el temps desat ha de passar els límits que posa l'API ---- */
  await page.goto(URL + '/');
  await page.evaluate(() => localStorage.clear());
  await open(1);
  await manual('1:23');
  check('un temps normal es desa', Object.keys(await desats()), ['1']);

  await manual('99:59:59');                       // ~100 h, per damunt del màxim
  check('un temps de més de 24 h no es desa',
    (await desats())['1'].map(r => r.t), [83000]);
  check('i ho diu', await page.textContent('#toast'),
    'El temps ha d’estar entre una mil·lèsima i 24 hores.');

  /* ---- canviar l'objectiu no ha de llançar la volta en marxa ---- */
  await page.evaluate(() => localStorage.clear());
  await open(2);
  await page.$eval('[data-mode="down"]', b => b.click());
  await page.$eval('#startstop', b => b.click());
  await page.waitForTimeout(400);
  await page.$eval('.clock__adjust button[data-delta="10"]', b => b.click());
  check('tocar +10 s no atura el compte enrere',
    await page.$eval('.clock', c => c.classList.contains('is-running')), true);
  await page.waitForTimeout(300);
  check('ni el posa a zero',
    await page.$eval('#clock', c => c.textContent.startsWith('00:00')), false);

  /* ---- i des de zero, l'objectiu sí que reinicia ---- */
  await page.$eval('#startstop', b => b.click());          // atura
  await page.$eval('#reset', b => b.click());
  await page.$eval('.clock__adjust button[data-delta="10"]', b => b.click());
  check('amb el rellotge a zero, l’objectiu el torna a posar sencer',
    await page.$eval('#clock', c => c.textContent.replace(/\s/g, '')),
    (await page.textContent('#targetlabel')) + '.0');

  /* ---- canviar de repte amb el rellotge en marxa pregunta ---- */
  await open(3);
  await page.$eval('#startstop', b => b.click());
  await page.waitForTimeout(1200);
  await confirms(false);
  await page.$eval('#next', b => b.click());
  await page.waitForTimeout(200);
  check('amb la volta en marxa, canviar de repte pregunta',
    await page.evaluate(() => window.__confirms), 1);
  check('i si dius que no, no et mou de lloc',
    await page.textContent('#lv-num'), '3');
  check('ni atura el rellotge',
    await page.$eval('.clock', c => c.classList.contains('is-running')), true);

  await page.evaluate(() => { window.confirm = () => { window.__confirms++; return true; }; });
  await page.$eval('#next', b => b.click());
  await page.waitForTimeout(250);
  check('i si dius que sí, hi va', await page.textContent('#lv-num'), '4');
  await restore();

  /* ---- amb el rellotge a zero no molesta ningú ---- */
  await confirms(false);
  await page.$eval('#next', b => b.click());
  await page.waitForTimeout(250);
  check('sense res a perdre, no pregunta res', await restore(), 0);
  check('i passa de llarg', await page.textContent('#lv-num'), '5');

  /* ---- una navegació, una pintada ---- */
  await page.evaluate(() => {
    window.__pintades = 0;
    new MutationObserver(() => window.__pintades++)
      .observe(document.querySelector('#lv-diagram'), { childList: true });
  });
  await page.$eval('#next', b => b.click());
  await page.waitForTimeout(350);
  check('el diagrama es pinta una vegada per navegació',
    await page.evaluate(() => window.__pintades), 1);

  await page.evaluate(() => localStorage.clear());
};
