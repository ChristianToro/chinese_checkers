import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS games (
  id             TEXT PRIMARY KEY,
  board          TEXT NOT NULL,
  current_player TEXT NOT NULL,
  status         TEXT NOT NULL,
  winner         TEXT,
  move_count     INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS moves (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id     TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  move_number INTEGER NOT NULL,
  player      TEXT NOT NULL,
  from_cell   TEXT NOT NULL,
  to_cell     TEXT NOT NULL,
  path        TEXT NOT NULL,
  kind        TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  UNIQUE (game_id, move_number)
);
`;

// Cached on globalThis so dev-mode hot reloads reuse one connection.
const globalForDb = globalThis as unknown as { __chineseCheckersDb?: Database.Database };

export function getDb(): Database.Database {
  if (!globalForDb.__chineseCheckersDb) {
    const file =
      process.env.DB_PATH ?? path.join(process.cwd(), "data", "chinese-checkers.db");
    if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });

    const db = new Database(file);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    db.exec(SCHEMA);
    globalForDb.__chineseCheckersDb = db;
  }
  return globalForDb.__chineseCheckersDb;
}
