CREATE TABLE IF NOT EXISTS games (
  id             TEXT PRIMARY KEY,
  board          JSONB NOT NULL,
  current_player TEXT NOT NULL CHECK (current_player IN ('red', 'blue')),
  status         TEXT NOT NULL CHECK (status IN ('active', 'finished')),
  winner         TEXT CHECK (winner IN ('red', 'blue')),
  move_count     INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL,
  updated_at     TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS moves (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  game_id     TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  move_number INTEGER NOT NULL,
  player      TEXT NOT NULL CHECK (player IN ('red', 'blue')),
  from_cell   TEXT NOT NULL,
  to_cell     TEXT NOT NULL,
  path        JSONB NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('step', 'jump')),
  created_at  TIMESTAMPTZ NOT NULL,
  UNIQUE (game_id, move_number)
);
