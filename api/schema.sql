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

-- Només el millor temps de cada jugador a cada repte: és tot el que necessita
-- una classificació, i manté la base minúscula.
CREATE TABLE IF NOT EXISTS times (
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  puzzle    INTEGER NOT NULL,
  ms        INTEGER NOT NULL,
  at        TEXT    NOT NULL,
  PRIMARY KEY (player_id, puzzle)
);

CREATE INDEX IF NOT EXISTS times_puzzle ON times(puzzle);
