# Kanoodle Ultimate Champion — els 500 reptes

Web estàtica per jugar al **Kanoodle Ultimate Champion** sense haver de passar
fulls del quadern: mostra els 500 reptes (250 en 2D i 250 en 3D), té cronòmetre
integrat i guarda els teus temps al navegador.

## Què fa

- **Índex de 500 reptes** com un tauler de boletes. Quan en resols un, la boleta
  s'omple de color i mostra el teu millor temps.
- **Filtres** per 2D, 3D, pendents o fets, salt directe per número i botó
  *Repte a l'atzar*.
- **Diagrama de muntatge** dibuixat en SVG a partir del quadern original. Els
  reptes 3D es mostren capa per capa (1×1 a dalt, 5×5 a la base).
- **Peces que has de col·locar**: les que no surten al diagrama, amb la seva forma.
- **Favorits**: marca un repte amb l'estrella (o la tecla `F`) i filtra'ls després.
- **Cronòmetre** amb dècimes o **compte enrere** com el timer del joc: tries
  quant de temps et dones, i quan s'acaba sona una alarma. En compte enrere,
  el temps que es desa és el que has trigat, no el que quedava.
- **Entrada manual** del temps si has fet servir el cronòmetre del joc.
- **Historial** per repte amb el millor temps destacat i un minigràfic de com hi
  vas evolucionant, i exportació/importació en JSON.
- **Mode sessió**: 3, 5 o 10 reptes seguits triats a l'atzar d'entre els que
  tens filtrats, amb el total en marxa, l'opció de saltar-ne un i un resum al
  final que compara cada temps amb el teu rècord anterior. Si tanques la pàgina
  a mitges, la sessió t'espera.
- **Estadístiques**: progrés 2D/3D, activitat de les últimes 12 setmanes,
  tots els intents al llarg del temps, repartiment per durada i els reptes que
  se t'han donat millor i pitjor.
- **Dificultat**: cada repte porta comptades les peces que has de col·locar
  (d'1 a 10). A l'índex es veu com un anell més clar o més fosc a cada boleta,
  i es pot filtrar per trams.
- **Funciona sense connexió**: es pot instal·lar a la pantalla d'inici del
  mòbil i tira sense dades. Les tipografies també van des del repositori, així
  que la pàgina no fa cap petició a fora.

Els temps, els favorits, les sessions i les preferències del rellotge es desen
a `localStorage`: només viuen en aquest navegador i no s'envien enlloc.

## Tecles

| Tecla | Acció |
|---|---|
| `Espai` | Comença / atura el rellotge |
| `F` | Afegeix o treu dels favorits |
| `←` `→` | Repte anterior / següent |
| `Esc` | Torna a l'índex |

Les vistes tenen adreça pròpia: `#147` obre el repte 147, `#stats` les
estadístiques i `#sessio` el resum de l'última sessió.

## Fer-la anar en local

```bash
python3 -m http.server 8123
```

I obre <http://localhost:8123>. Cal servidor: la pàgina carrega `data/puzzles.json`
per `fetch`, i amb `file://` el navegador ho bloqueja.

## Fora de línia

Un service worker (`sw.js`) guarda a la memòria cau la pàgina, els estils, les
tipografies i `data/puzzles.json`. **Quan canviïs qualsevol d'aquests fitxers,
puja el número de `VERSION` a `sw.js`**; si no, els navegadors que ja hi han
entrat continuaran servint la versió antiga. Quan detecta que n'hi ha una de
nova, la pàgina t'avisa perquè recarreguis.

Mentre desenvolupes en local, val la pena tenir obertes les eines del navegador
amb *Disable cache*, o esborrar el service worker des de la pestanya
*Application*.

## Publicar-la a GitHub Pages

Puja el repositori a GitHub i, a *Settings → Pages*, tria **Deploy from a branch**,
branca `main` i carpeta `/ (root)`. No cal cap build: és HTML, CSS i JS plans.

## D'on surten les dades

`data/puzzles.json` s'ha generat a partir del PDF de la guia oficial
(`KanoodleUltimateChampionGuide.pdf`). Els scripts de `tools/` converteixen cada
pàgina a SVG amb `pdftocairo`, hi identifiquen les boletes pel color de farciment
i les lletres pels traços foscos, i reconstrueixen la graella de cada repte.

El PDF de la guia no es puja al repositori (`.gitignore`): és material de
l'editor del joc. Guarda'l a l'arrel si vols tornar a generar les dades.

Regenerar-ho (cal `poppler-utils`):

```bash
cd tools && python3 run.py && python3 shapes.py && python3 validate.py && python3 build_data.py
```

`validate.py` comprova que a cada repte cada peça hi surti amb el nombre exacte
de boletes i, en 2D, que les boletes d'una mateixa peça estiguin connectades.
Els 500 reptes passen la comprovació amb una excepció coneguda:

- **Repte 302**: el quadern imprès només hi dibuixa 1 boleta de la peça D (rosa
  clar) en comptes de 5. Sembla una errata de la guia; la web ho reprodueix tal
  com surt i ho avisa.

## Estructura

```
index.html          pàgina única
css/style.css       estils
css/fonts.css       declaracions @font-face
js/app.js           tota la lògica
data/puzzles.json   els 500 reptes, formes de les peces i geometria del 3D
fonts/              woff2 (SIL Open Font License 1.1, vegeu fonts/README.md)
icons/              icones de la instal·lació al mòbil
manifest.json       metadades de la instal·lació
sw.js               service worker (mode fora de línia)
tools/              extracció des del PDF
```
