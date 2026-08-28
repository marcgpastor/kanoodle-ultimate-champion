# Kanoodle Ultimate Champion — 700 reptes

Web estàtica per jugar al **Kanoodle Ultimate Champion** sense haver de passar
fulls del quadern: mostra els 500 reptes del quadern (250 en 2D i 250 en 3D) i
200 més de generats, té cronòmetre integrat i guarda els teus temps.

## Què fa

- **Índex de 700 reptes** com un tauler de boletes, en quatre tandes: les dues
  del quadern i les dues de generades, marcades amb l'etiqueta **beta**. Quan
  en resols un, la boleta s'omple de color i mostra el teu millor temps.
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
- **Pistes**: si t'encalles, toca una peça i te la dibuixa al lloc que li toca,
  amb contorn de punts perquè no la confonguis amb el diagrama original. També
  pots demanar-ne una i prou (comença per les peces amb menys llocs possibles)
  o la solució sencera.
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
a `localStorage`. Si no configures la classificació (mireu més avall), no
s'envia res enlloc i la web no fa cap petició fora del seu propi domini.

## Tecles

| Tecla | Acció |
|---|---|
| `Espai` | Comença / atura el rellotge |
| `F` | Afegeix o treu dels favorits |
| `P` | Demana una pista |
| `←` `→` | Repte anterior / següent |
| `Esc` | Torna a l'índex |

Les vistes tenen adreça pròpia: `#147` obre el repte 147, `#stats` les
estadístiques, `#sessio` el resum de l'última sessió, `#classificacio` la de la
colla i `#invitacions` el panell per convidar gent.

## Fer-la anar en local

```bash
python3 -m http.server 8123
```

I obre <http://localhost:8123>. Cal servidor: la pàgina carrega `data/puzzles.json`
per `fetch`, i amb `file://` el navegador ho bloqueja.

## Comptes: els teus temps et segueixen

Opcional i apagat per defecte. Mentre `BASE` estigui buit a dalt de
`js/api.js`, tot això queda amagat i la web es comporta exactament com si no
existís.

Si l'engegues, cada jugador té un compte i **les seves dades el segueixen d'un
navegador a un altre**: temps (tots els intents, no només el millor), favorits
i sessions. Obres el mateix enllaç al mòbil i hi trobes el que tenies a
l'ordinador; el que facis en qualsevol dels dos acaba als altres.

Com que cada intent es distingeix per la seva data, els navegadors es fusionen
sols: no hi ha conflictes a resoldre ni s'esborra res per haver jugat en dos
llocs. Si esborres un temps, s'esborra a tot arreu.

De propina, hi ha una classificació compartida amb el millor temps de cada
jugador a cada repte, tant a la vista general com al costat de cada repte.

**S'hi entra només amb invitació.** No hi ha cap formulari de registre: tu
crees una invitació des de `#invitacions` (que et demana la clau
d'administració), et dona un enllaç amb un testimoni i el passes a qui vulguis.
Qui l'obre tria el nom i queda registrat; el mateix enllaç serveix per entrar
des de qualsevol altre dispositiu, i des de `#classificacio` cadascú es pot
tornar a copiar el seu. Pots revocar o esborrar qualsevol jugador quan vulguis.
Ningú que no tingui un enllaç pot entrar ni veure res.

El servidor és un Cloudflare Worker amb una base D1; les instruccions per
posar-lo en marxa són a [`api/README.md`](api/README.md).

Un avís honest: **no hi ha manera de comprovar que un temps sigui real**.
Qualsevol pot escriure'l a mà. Entre amics és qüestió de confiança.

Tot continua funcionant sense connexió: els temps es desen igualment al
navegador i es pugen sols quan torna la xarxa.

## Fora de línia

Un service worker (`sw.js`) guarda a la memòria cau la pàgina, els estils, les
tipografies i `data/puzzles.json`. Quan canviïs qualsevol d'aquests fitxers cal
canviar la `VERSION` de `sw.js`; si no, els navegadors que ja hi han entrat
continuaran servint la versió antiga. Perquè no se t'oblidi, abans de cada
commit:

```bash
node tools/stamp-sw.js
```

Calcula un resum del contingut dels fitxers guardats i el posa com a versió. Si
no ha canviat res, no toca res. Quan la pàgina detecta que n'hi ha una de nova,
t'avisa perquè recarreguis.

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
  com surt i ho avisa. El resolutor sap detectar-ho: torna la D a la reserva i
  troba on anava de debò, tot mantenint la boleta que sí que surt impresa.

## Els 200 reptes nous

Les tandes 501–600 (2D) i 601–700 (3D) no surten del quadern: les fabrica
`tools/generate.js` amb el mateix resolutor. Es busca un encaix sencer de les 12
peces, se'n deixen unes quantes al tauler i s'amaga la resta, que és exactament
el que fa el quadern.

Tres diferències a favor:

- **Tenen una única solució.** Dels 500 del quadern, només 197 dels 250 en 2D i
  152 dels 249 en 3D en tenen una de sola; els altres n'admeten més d'una. Els
  generats la tenen sempre, comprovada un a un.
- **Van de fàcil a difícil.** Dins de cada tanda estan ordenats per peces a
  col·locar, de 2 a 10, amb una corba pensada perquè n'hi hagi de tots els
  gustos. El quadern es concentra a 4–6 peces i no segueix cap ordre.
- **Els 3D es paren drets.** Cap bola del diagrama no queda penjada a l'aire.

Van marcades amb una etiqueta **beta** taronja, tant al bloc de l'índex com
dins del repte: les ha comprovades el resolutor una a una, però no les ha jugat
ningú, i el criteri per triar-les és nostre i no del fabricant. Si te'n trobes
cap de rara, ja saps d'on ve.

La tercera cal explicar-la. La piràmide té gravetat: una peça a les capes de
dalt no s'aguanta si no hi ha res a sota, i un diagrama que demani sostenir-la
amb el dit mentre en poses una altra no es pot ni parar per començar a jugar.
La regla que hi apliquem és la mateixa que segueix el quadern sense dir-la:
**cada bola dibuixada ha de tocar-ne alguna de les quatre de sota**, o ser a la
base. Com que val per a totes, cada bola acaba tenint una cadena de suports
fins a terra. El quadern la compleix en 243 dels seus 250 reptes 3D; la primera
tanda generada, en canvi, només en 28 de 100, i per això es va refer.

La part cara és trobar l'encaix (14 ms en 2D, 0,7 s en 3D); un cop trobat, cada
repte que se'n deriva costa menys de 2 ms, així que d'un sol encaix en surten
desenes. Les 200 es fabriquen en 7 segons.

És determinista: amb la mateixa llavor surten sempre els mateixos reptes.

```bash
node tools/generate.js --seed 20260827 --count 100
```

## El resolutor

`js/solver.js` resol qualsevol dels 500 reptes com un problema de cobertura
exacta: cal omplir els 55 forats amb les peces que queden, cadascuna una vegada.
La cerca ataca sempre el forat amb menys col·locacions possibles i descarta de
seguida les bosses d'aire massa petites per a cap peça. Va en un `Worker`
(`js/worker.js`) perquè la pàgina no s'encalli mentre calcula.

En 2D la cosa és senzilla: cada peça té 8 orientacions sobre una graella d'11x5.

En 3D no tant. La piràmide són 55 boles apilades en cúbic centrat a les cares.
Amb la capa `k = 0` a la base i `k = 4` al cim, el centre de la bola `(k, i, j)`
cau a `(i + k/2, j + k/2, k/√2)`; multiplicant per 2 les dues primeres
coordenades queda la xarxa d'enters `(2i + k, 2j + k, k)`, on les 12 direccions
entre boles que es toquen són `(±2,0,0)`, `(0,±2,0)` i `(±1,±1,±1)`. Com que les
peces són planes, només es poden posar en plans generats per dos vectors
unitaris perpendiculars: en surten 24 parells, és a dir **tres plans** —
l'horitzontal i dos de diagonals— amb les 8 simetries de cadascun.

Que els 500 reptes es resolguin amb aquest model és la millor comprovació que
l'extracció del PDF és correcta: si la geometria de la piràmide fos una altra,
gairebé cap dels 250 reptes 3D no tindria solució.

```bash
cd tools && node solve-all.js
```

comprova els 700 i verifica cada solució de manera independent: que cap peça se
solapi, que es cobreixin els 55 forats i que cada peça col·locada sigui una
posició legal de la seva forma. Als generats hi comprova, a més, que la solució
sigui única, i als 3D que el diagrama es pugui parar dret.

## Estructura

```
index.html          pàgina única
css/style.css       estils
css/fonts.css       declaracions @font-face
js/app.js           tota la lògica de la interfície
js/solver.js        resolutor de cobertura exacta (2D i 3D)
js/worker.js        el resolutor en un fil a part
js/api.js           client de la classificació (apagat si BASE és buit)
api/                Cloudflare Worker + D1: usuaris i temps compartits
data/puzzles.json   els 700 reptes, formes de les peces i geometria del 3D
tools/generate.js   fabrica les dues tandes de reptes nous
fonts/              woff2 (SIL Open Font License 1.1, vegeu fonts/README.md)
icons/              icones de la instal·lació al mòbil
manifest.json       metadades de la instal·lació
sw.js               service worker (mode fora de línia)
tools/              extracció des del PDF
```
