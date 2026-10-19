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

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  avatar        TEXT NOT NULL CHECK (avatar IN ('panda', 'rabbit', 'red_panda', 'tiger', 'turtle')),
  created_at    TIMESTAMPTZ NOT NULL
);

-- Usernames are unique regardless of case ("Alice" blocks "alice").
CREATE UNIQUE INDEX IF NOT EXISTS users_username_key ON users (lower(username));

-- The cookie holds a random token. Only its SHA-256 is stored here.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

-- Seats are nullable: games created before accounts existed have no owners,
-- and an open seat is filled by the next player to join.
ALTER TABLE games ADD COLUMN IF NOT EXISTS red_user_id TEXT REFERENCES users(id);
ALTER TABLE games ADD COLUMN IF NOT EXISTS blue_user_id TEXT REFERENCES users(id);
CREATE INDEX IF NOT EXISTS games_red_user_idx ON games (red_user_id);
CREATE INDEX IF NOT EXISTS games_blue_user_idx ON games (blue_user_id);
