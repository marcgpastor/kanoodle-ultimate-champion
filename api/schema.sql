-- Jugadors. Cada convidat rep un testimoni; a la base només en guardem el resum
-- SHA-256, així que ni tan sols des d'aquí es poden recuperar els enllaços.
CREATE TABLE IF NOT EXISTS players (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  token_hash TEXT    NOT NULL UNIQUE,
  created_at TEXT    NOT NULL,
  joined_at  TEXT,
  revoked    INTEGER NOT NULL DEFAULT 0
);

-- Cada intent cronometrat, no només el millor: així en canviar de navegador
-- recuperes l'historial sencer. La data fa d'identificador de l'intent, cosa
-- que permet fusionar dos navegadors sense haver de resoldre cap conflicte.
CREATE TABLE IF NOT EXISTS runs (
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  puzzle    INTEGER NOT NULL,
  ms        INTEGER NOT NULL,
  at        TEXT    NOT NULL,
  PRIMARY KEY (player_id, puzzle, at)
);

CREATE INDEX IF NOT EXISTS runs_puzzle ON runs(puzzle);
CREATE INDEX IF NOT EXISTS runs_player ON runs(player_id);

CREATE TABLE IF NOT EXISTS favs (
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  puzzle    INTEGER NOT NULL,
  PRIMARY KEY (player_id, puzzle)
);

-- Les sessions acabades, una fila cadascuna perquè es fusionin soles.
CREATE TABLE IF NOT EXISTS sessions (
  player_id  INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  started_at TEXT    NOT NULL,
  data       TEXT    NOT NULL,
  PRIMARY KEY (player_id, started_at)
);
