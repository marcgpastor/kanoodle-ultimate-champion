# API de la classificació

Cloudflare Worker + D1. Guarda els jugadors convidats i el millor temps de
cadascun a cada repte. **Només s'hi entra amb invitació**: no hi ha cap
formulari de registre obert, i sense un testimoni vàlid no es pot ni llegir la
classificació.

## Posar-la en marxa

```bash
cd api
npx wrangler login
npx wrangler d1 create kanoodle
```

Copia l'`database_id` que et doni a `wrangler.toml`. Després:

```bash
npx wrangler d1 execute kanoodle --remote --file=schema.sql
npx wrangler secret put ADMIN_KEY
npx wrangler deploy
```

`ADMIN_KEY` és la contrasenya que et demanarà la pàgina d'invitacions. Fes-la
llarga i aleatòria; per exemple:

```bash
openssl rand -base64 24
```

El `deploy` t'imprimirà la URL del Worker. Enganxa-la a `BASE`, a dalt de
`js/api.js`, executa `node tools/stamp-sw.js` i puja-ho tot. Si la teua pàgina
no és `marcgpastor.github.io`, canvia també `ALLOWED_ORIGINS` a `wrangler.toml`.

## Provar-ho en local

```bash
cd api
npx wrangler d1 execute kanoodle --local --file=schema.sql
npx wrangler dev --local --port 8787 --var ADMIN_KEY:la-que-vulguis
```

I posa `BASE = 'http://127.0.0.1:8787'` mentre proves.

## Què hi ha

| Ruta | Qui hi pot | Què fa |
|---|---|---|
| `POST /join` | qualsevol amb un testimoni | activa la invitació i tria el nom |
| `GET /me` | jugador | qui ets |
| `POST /times` | jugador | puja temps; només es guarda si millora el que hi havia |
| `GET /board` | jugador | tots els jugadors i els seus millors temps |
| `POST /admin/invite` | `X-Admin-Key` | crea una invitació i torna el testimoni |
| `GET /admin/players` | `X-Admin-Key` | qui has convidat i com va |
| `POST /admin/revoke` | `X-Admin-Key` | treu o torna l'accés a algú |
| `POST /admin/delete` | `X-Admin-Key` | esborra un jugador i tots els seus temps |

Els testimonis són 24 bytes aleatoris. A la base només se'n guarda el resum
SHA-256, de manera que ni tu mateix pots recuperar un enllaç d'invitació: si
algú el perd, li'n crees un de nou i revoques l'antic.

## Què costa

El pla gratuït de Cloudflare dona 100.000 peticions al dia i 5 milions de files
llegides. Una colla d'amics no s'hi acostarà mai. D1 no es pausa per
inactivitat.
