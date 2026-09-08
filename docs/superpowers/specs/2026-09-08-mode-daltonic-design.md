# Mode daltònic i colors dels punts de competició

Disseny acordat el 8 de setembre de 2026.

## Per què

Els punts de competició de l'índex fan servir daurat, taronja i gris, que no
diuen res per si sols. Es volen colors amb significat —verd, roig i groc— i,
com que aquest és justament el parell que pitjor distingeix qui té daltonisme
roig-verd, cal una alternativa per a tota l'aplicació, no només per als punts.

De passada, els textos dels estats («Hi manes», «Em guanyen») són massa
col·loquials i s'han de tornar neutres.

## Què s'ha decidit

| Pregunta | Decisió |
|---|---|
| Abast del mode | Els colors semàntics de l'aplicació es recoloren. Els 12 colors de peça **no**: el diagrama ha de continuar corresponent-se amb la capsa física. A canvi, es reforça la lletra que cada boleta ja porta. |
| Variants | Un sol interruptor, pensat per al daltonisme roig-verd (deuteranopia i protanopia). Res de triar tipus. |
| Textos | Descriptius del fet, no de la competició. |
| Verd del mode normal | `#35C759`. |
| Arquitectura | Les variables CSS són l'única font de veritat; el JS les llig. |

## Arquitectura

Ara mateix el color es decideix a quatre llocs independents: `data/puzzles.json`
(els 12 colors de peça), `BEADS[]` a `js/app.js`, les variables `:root` de
`css/style.css` i una vintena de valors escrits a mà dins d'`app.js`. Un mode
que canvia la paleta necessita una sola font, o mitja aplicació es quedaria en
un mode i mitja en l'altre.

- `:root` defineix els colors **semàntics** (què vol dir el color, no quin és).
- `html[data-palette="daltonic"]` els redefineix en bloc.
- Els llocs on el JS pinta SVG deixen d'escriure literals i passen per un
  ajudant `cssVar(nom)`, que llig la variable amb `getComputedStyle` i en desa
  el resultat fins que canvia el mode.
- Els 12 colors de peça i `BEADS[]` **no** es toquen: no són semàntics, són el
  joc.

## La paleta

| Variable | Què pinta | Normal | Daltònic |
|---|---|---|---|
| `--rival-lead` | punt: el millor temps és teu | `#35C759` | `#56B4E9` blau cel |
| `--rival-behind` | punt: hi ha temps més ràpids | `#EF3338` | `#D55E00` vermelló |
| `--rival-open` | punt: encara no l'has jugat | `#F5C518` | `#C8C0B6` gris clar |
| `--dim-2d` | 2D a gràfics i llegendes | `#00ADEF` | `#56B4E9` blau cel |
| `--dim-3d` | 3D a gràfics i llegendes | `#F03BA6` | `#E69F00` taronja |
| `--good` | fet, rècord, calendari, barra de total | `#98D320` | `#F0E442` groc pàl·lid |
| `--chart` | barres del repartiment per durada | `#F0E406` | `#E69F00` taronja |

El tercer color és sempre el punt delicat: blau i taronja és el parell segur,
però quan n'hi ha d'haver tres alhora el tercer no pot ser cap to roig ni verd.
Als punts es resol amb gris, que no és un color i no es confon amb res; als
gràfics, amb groc pàl·lid, que es distingeix del taronja per claredat i no per
to.

### Les variables que ja hi ha

Repassant el CSS amb ulls nous apareix un buit que el disseny inicial no cobria:
`--lime`, `--cyan` i `--magenta` ja carreguen significat per tota la interfície,
i redefinir només les set variables noves deixaria mitja aplicació en verd i
magenta dins del mode daltònic.

| Variable | Què vol dir avui | Usos al CSS | Què cal fer |
|---|---|---|---|
| `--cyan` | acció: botons, focus, enllaços, estat actiu | 17 | **Res.** El blau es distingeix bé en totes dues visions. |
| `--lime` | fet, rècord, bo: millors temps, rellotge en marxa, corona, punts de sessió fets | 18 | Passa a `--good`, que canvia amb el mode. |
| `--magenta` | alerta, perill, favorit: temps passat, esborrar-ho tot, estrella, errata | 9 | Passa a `--alert`, que canvia amb el mode. |
| `--amber` | l'etiqueta beta | 1 | **Res.** És una pastilla plena amb text a dins; no depèn de distingir-la d'un altre color. |
| `--gold` | el punt d'ara | 1 | Desapareix: la substitueixen les tres `--rival-*`. |

Es defineixen `--good` i `--alert` com a variables semàntiques i s'hi apunten
els usos que porten significat; `--lime` i `--magenta` es queden com a entrades
de paleta per al que és decoratiu (l'accent de les tandes generades, per
exemple). Hi ha també cinc literals de la mateixa família escrits a mà que han
de seguir la variable que els toca:

- `#F55FBA` (`.fav` en passar-hi per damunt) i `#2B0016` (el text de dins)
- `#FFD9EC` i `rgba(240,59,166,.13)` (l'avís d'errata)
- `rgba(152,211,32,.12)` i `rgba(152,211,32,.28)` (el fons dels xips de rècord i
  la vora de les tandes generades)

Valors en mode daltònic: `--good` → `#F0E442` groc pàl·lid; `--alert` →
`#D55E00` vermelló.

**Això fa el canvi més gran del que semblava al disseny**: són una trentena de
llocs del CSS que canvien de nom de variable, tot i que cap d'ells canvia de
comportament. És feina mecànica, però convé saber-ho abans de començar.

### Llocs d'`app.js` que passen a `cssVar()`

| Línia | Ara | Variable |
|---|---|---|
| 492 | `stroke: '#00ADEF'` (minigràfic) | `--dim-2d` |
| 496 | `'#98D320'` / `'#00ADEF'` (punts del minigràfic) | `--good` / `--dim-2d` |
| 662 | `'#F03BA6'` / `'#00ADEF'` (barres 2D/3D) | `--dim-3d` / `--dim-2d` |
| 664 | `'#98D320'` (barra de total) | `--good` |
| 739, 747 | `'#98D320'` dins de `color-mix` (calendari) | `--good` |
| 778 | `'#F03BA6'` / `'#00ADEF'` (dispersió d'intents) | `--dim-3d` / `--dim-2d` |
| 787 | `['#00ADEF', '2D']`, `['#F03BA6', '3D']` (llegenda) | `--dim-2d` / `--dim-3d` |
| 806 | `'#F0E406'` (histograma) | `--chart` |

Els grisos d'eixos i graella (`#6E635E`, `#2C2522`, `#3D3532`) i `ringColor()`
no canvien: ja són neutres i funcionen en tots dos modes.

## L'interruptor

Un botó al peu, dins de `.colophon__actions`, al costat d'Exporta i Importa:

```html
<button type="button" id="cbmode" class="link" aria-pressed="false">Mode daltònic</button>
```

Segueix el patró que ja fa servir `#sound`: `aria-pressed` i el text com a
etiqueta. Es desa a `prefs.cb` (per defecte `false`) amb `savePrefs()`, com el
so i el compte enrere.

**Sense parpelleig.** `prefs` es llig dins del `.then()` del `fetch` de
`puzzles.json`. Si s'espera fins allí per posar l'atribut, qui tinga el mode
encés veurà els colors normals durant un instant. Com que `localStorage` és
síncron, l'atribut s'ha d'aplicar al principi del guió, abans que arribe cap
dada:

```js
try {
  const p = JSON.parse(localStorage.getItem('kanoodle.prefs.v1') || '{}');
  if (p && p.cb) document.documentElement.dataset.palette = 'daltonic';
} catch {}
```

En canviar el mode cal buidar la memòria de `cssVar()` i tornar a pintar el que
estiga a la vista (índex, repte o estadístiques).

## Les peces

No canvien de color. El que es reforça és la lletra de cada boleta, a `ball()`.

**Sempre**, no només en mode daltònic: la lletra es pinta fosca o clara segons
la lluminositat de la peça. Ara és sempre `#16110F`, i sobre l'indi de la peça J
(`#5E54AE`) es llig malament. És un defecte que ja hi és, i el mode daltònic
només el fa més visible.

Regla: lluminància relativa de la peça per damunt de 0,5 → lletra fosca
(`#16110F`); per davall → lletra clara (`#F4EFE9`).

**Només en mode daltònic**: la lletra passa de `r * 1.15` a `r * 1.35`, de pes
600 a 700, i guanya un contorn del color del fons amb `paint-order: stroke`
perquè no es perda contra cap color de peça.

Això val per al diagrama i per a la llista de peces, que fan servir la mateixa
funció.

## Els textos

| On | Ara | Nou |
|---|---|---|
| `index.html:52` xip del filtre | Em guanyen | **Per millorar** |
| `index.html:73` llegenda | Hi manes | **El millor temps és teu** |
| `index.html:74` llegenda | Et guanyen | **Hi ha temps més ràpids** |
| `index.html:75` llegenda | No l'has jugat | **Encara no l'has jugat** |
| `app.js:313` llista buida | No et guanyen enlloc: tens el millor temps de tots els reptes que ha jugat algú altre. | **No hi ha cap repte amb un temps més ràpid que el teu.** |
| `app.js:882` títol | , hi tens el millor temps | **, el millor temps és el teu** |
| `app.js:887` títol | , encara no l'has jugat i X el té en T | **, encara no l'has jugat; el d'X és T** |
| `app.js:888` títol | , el més ràpid és X amb T | **, el temps més ràpid és d'X: T** |
| `app.js:1587` avís del diàleg | aquells on et guanyen | **aquells amb un temps més ràpid que el teu** |

El comentari de `rivalState()` (`app.js:857`) s'actualitza igual.

## Mida dels punts

De 7 a 9 px, amb la vora fosca de 1,5 a 2 px. En fer-los més grans cal més
separació, perquè una boleta feta es pinta amb un color de peça i els colors
dels punts també són colors de peça. La llegenda fa servir la mateixa classe i
creix sola.

## Què queda fora

- Els 12 colors de peça i `BEADS[]`.
- Triar el tipus de daltonisme: un sol mode.
- Cap canvi a `api/`, ni d'esquema ni de desplegament.
- El mode no es sincronitza entre navegadors: és una preferència local, com el
  so.

## Verificació

Al guió del navegador, sobre l'aplicació de veres:

1. Amb el mode apagat, els set colors semàntics calculats són els de la columna
   normal —comprovats sobre el que acaba pintat als SVG, no només a les
   variables.
2. En encendre'l, els set canvien als de la columna daltònica.
3. La preferència sobreviu a recarregar.
4. Arrencant amb el mode encés, l'atribut ja hi és abans que es pinte res: no
   hi ha parpelleig.
5. La lletra de la peça J passa a clara; la d'una peça clara es queda fosca.
6. En mode daltònic la lletra és més gran i porta contorn.
7. Cap dels textos vells queda enlloc del DOM.
8. Amb el mode daltònic encés no queda cap verd ni cap magenta pintat enlloc
   de la interfície: es comprova recorrent els estils calculats de la pàgina.
9. Les 53 comprovacions que ja hi ha no es mouen.

## Fitxers

`css/style.css`, `js/app.js`, `index.html`, `README.md` i el segell de `sw.js`.
