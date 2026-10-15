import { randomUUID } from "node:crypto";
import type { Avatar } from "./avatars";
import { getDb } from "./db";
import { cellLabel, isOnBoard } from "./game/board";
import { applyMove, hasWon, initialBoard, legalMoves, nextPlayer } from "./game/rules";
import { seatOf } from "./game/seats";
import type {
  Board,
  CellKey,
  Game,
  GameStatus,
  Move,
  MoveKind,
  Player,
  PlayerProfile,
} from "./game/types";

/** An error that maps directly onto an HTTP status for the API layer. */
export class GameError extends Error {
  constructor(
    public readonly status: 400 | 401 | 403 | 404 | 409,
    message: string,
  ) {
    super(message);
  }
}

// Drivers differ in how they hand back JSONB (object or string) and
// TIMESTAMPTZ (Date or string), so rows are normalized on the way out.
interface GameRow {
  id: string;
  board: Board | string;
  current_player: Player;
  status: GameStatus;
  winner: Player | null;
  move_count: number;
  created_at: Date | string;
  updated_at: Date | string;
  red_user_id: string | null;
  red_username: string | null;
  red_avatar: Avatar | null;
  blue_user_id: string | null;
  blue_username: string | null;
  blue_avatar: Avatar | null;
}

interface MoveRow {
  move_number: number;
  player: Player;
  from_cell: CellKey;
  to_cell: CellKey;
  path: CellKey[] | string;
  kind: MoveKind;
  created_at: Date | string;
}

function fromJson<T>(value: T | string): T {
  return typeof value === "string" ? (JSON.parse(value) as T) : value;
}

function toIso(value: Date | string): string {
  return new Date(value).toISOString();
}

function toProfile(
  id: string | null,
  username: string | null,
  avatar: Avatar | null,
): PlayerProfile | null {
  return id && username && avatar ? { id, username, avatar } : null;
}

function toGame(row: GameRow): Game {
  return {
    id: row.id,
    board: fromJson(row.board),
    currentPlayer: row.current_player,
    status: row.status,
    winner: row.winner,
    red: toProfile(row.red_user_id, row.red_username, row.red_avatar),
    blue: toProfile(row.blue_user_id, row.blue_username, row.blue_avatar),
    moveCount: row.move_count,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function toMove(row: MoveRow): Move {
  return {
    moveNumber: row.move_number,
    player: row.player,
    from: row.from_cell,
    to: row.to_cell,
    path: fromJson(row.path),
    kind: row.kind,
    createdAt: toIso(row.created_at),
  };
}

/**
 * Selects game rows from `source` (the table, or a CTE of written rows) with
 * both players' profiles joined in, so every read and write returns a full Game.
 */
function withPlayers(source: string): string {
  return `SELECT g.*,
            ru.username AS red_username, ru.avatar AS red_avatar,
            bu.username AS blue_username, bu.avatar AS blue_avatar
          FROM ${source} g
          LEFT JOIN users ru ON ru.id = g.red_user_id
          LEFT JOIN users bu ON bu.id = g.blue_user_id`;
}

async function selectGame(id: string): Promise<GameRow | undefined> {
  const rows = await getDb().query<GameRow>(`${withPlayers("games")} WHERE g.id = $1`, [id]);
  return rows[0];
}

async function requireGame(id: string): Promise<Game> {
  const row = await selectGame(id);
  if (!row) throw new GameError(404, `Game ${id} not found`);
  return toGame(row);
}

/** Starts a game with its creator in the red seat; blue stays open until someone joins. */
export async function createGame(userId: string): Promise<Game> {
  const id = randomUUID().replaceAll("-", "").slice(0, 10);
  const now = new Date().toISOString();
  const [row] = await getDb().query<GameRow>(
    `WITH ins AS (
       INSERT INTO games (id, board, current_player, status, winner, move_count, created_at, updated_at, red_user_id)
       VALUES ($1, $2::jsonb, 'red', 'active', NULL, 0, $3, $3, $4)
       RETURNING *
     )
     ${withPlayers("ins")}`,
    [id, JSON.stringify(initialBoard()), now, userId],
  );
  return toGame(row);
}

export async function getGame(id: string): Promise<Game | null> {
  const row = await selectGame(id);
  return row ? toGame(row) : null;
}

export async function listMoves(id: string): Promise<Move[]> {
  await requireGame(id);
  const rows = await getDb().query<MoveRow>(
    "SELECT * FROM moves WHERE game_id = $1 ORDER BY move_number",
    [id],
  );
  return rows.map(toMove);
}

/**
 * Seats the user in the game's open seat (red first, for games created before
 * accounts existed). One guarded statement, so two people racing for the last
 * seat can't both get it. Joining a game you already play in is a no-op.
 */
export async function joinGame(id: string, userId: string): Promise<Game> {
  const [row] = await getDb().query<GameRow>(
    `WITH upd AS (
       UPDATE games
       SET red_user_id = COALESCE(red_user_id, $2),
           blue_user_id = CASE WHEN red_user_id IS NOT NULL AND blue_user_id IS NULL
                               THEN $2 ELSE blue_user_id END,
           updated_at = $3
       WHERE id = $1
         AND (red_user_id IS NULL OR blue_user_id IS NULL)
         AND red_user_id IS DISTINCT FROM $2
         AND blue_user_id IS DISTINCT FROM $2
       RETURNING *
     )
     ${withPlayers("upd")}`,
    [id, userId, new Date().toISOString()],
  );
  if (row) return toGame(row);

  const game = await requireGame(id);
  if (seatOf(game, userId)) return game;
  throw new GameError(409, "Both seats in this game are taken");
}

/**
 * Restarts an unfinished game. Only its players may, and a finished game is
 * left alone so its result stays in both players' history.
 */
export async function resetGame(id: string, userId: string): Promise<Game> {
  const game = await requireGame(id);
  if (!seatOf(game, userId)) throw new GameError(403, "Only this game's players can restart it");
  if (game.status === "finished") {
    throw new GameError(409, "This game is finished; start a new one");
  }

  // The move history is only deleted if the guarded update matched.
  const [row] = await getDb().query<GameRow>(
    `WITH upd AS (
       UPDATE games
       SET board = $2::jsonb, current_player = 'red', status = 'active', winner = NULL,
           move_count = 0, updated_at = $3
       WHERE id = $1 AND status = 'active'
       RETURNING *
     ), del AS (
       DELETE FROM moves WHERE game_id IN (SELECT id FROM upd)
     )
     ${withPlayers("upd")}`,
    [id, JSON.stringify(initialBoard()), new Date().toISOString()],
  );
  if (!row) throw new GameError(409, "This game is finished; start a new one");
  return toGame(row);
}

export interface MoveInput {
  from: unknown;
  to: unknown;
  /** Optional optimistic-concurrency check against `game.moveCount`. */
  expectedMoveCount?: unknown;
}

function parseMoveInput(input: MoveInput) {
  const { from, to, expectedMoveCount } = input;
  if (!isOnBoard(from) || !isOnBoard(to)) {
    throw new GameError(400, "`from` and `to` must be board cells like \"0,-5\"");
  }
  if (
    expectedMoveCount !== undefined &&
    !(Number.isInteger(expectedMoveCount) && (expectedMoveCount as number) >= 0)
  ) {
    throw new GameError(400, "`expectedMoveCount` must be a non-negative integer");
  }
  return { from, to, expectedMoveCount: expectedMoveCount as number | undefined };
}

const STALE_BOARD = "The board has changed since you loaded it; refresh and try again";

/**
 * Validates one move by `userId` against the current game (seat, turn order,
 * marble ownership, legality, win detection), then writes it with a single
 * guarded statement: the game update only matches if `move_count` is still
 * what was read, and the history insert rides along in a CTE. A concurrent
 * writer leaves 0 rows → 409.
 */
export async function submitMove(
  id: string,
  userId: string,
  input: MoveInput,
): Promise<{ game: Game; move: Move }> {
  const { from, to, expectedMoveCount } = parseMoveInput(input);
  const game = await requireGame(id);
  const mover = game.currentPlayer;
  const seat = seatOf(game, userId);

  if (!seat) throw new GameError(403, "You're not playing in this game");
  if (game.status === "finished") {
    throw new GameError(409, `The game is over: ${game.winner} won`);
  }
  if (!game.red || !game.blue) {
    throw new GameError(409, "Waiting for an opponent to join");
  }
  if (expectedMoveCount !== undefined && expectedMoveCount !== game.moveCount) {
    throw new GameError(409, STALE_BOARD);
  }
  if (seat !== mover) {
    throw new GameError(409, `It's ${mover}'s turn, not ${seat}'s`);
  }

  const owner = game.board[from];
  if (!owner) throw new GameError(400, `There is no marble at ${cellLabel(from)}`);
  if (owner !== mover) {
    throw new GameError(409, `That's a ${owner} marble, and it's ${mover}'s turn`);
  }

  const option = legalMoves(game.board, from).get(to);
  if (!option) {
    throw new GameError(400, `Illegal move from ${cellLabel(from)} to ${cellLabel(to)}`);
  }

  const board = applyMove(game.board, from, to);
  const won = hasWon(board, mover);
  const now = new Date().toISOString();

  const [row] = await getDb().query<GameRow>(
    `WITH upd AS (
       UPDATE games
       SET board = $3::jsonb, current_player = $4, status = $5, winner = $6,
           move_count = move_count + 1, updated_at = $7
       WHERE id = $1 AND move_count = $2 AND status = 'active'
       RETURNING *
     ), ins AS (
       INSERT INTO moves (game_id, move_number, player, from_cell, to_cell, path, kind, created_at)
       SELECT id, move_count, $8, $9, $10, $11::jsonb, $12, $7 FROM upd
     )
     ${withPlayers("upd")}`,
    [
      id,
      game.moveCount,
      JSON.stringify(board),
      won ? mover : nextPlayer(board, mover),
      won ? "finished" : "active",
      won ? mover : null,
      now,
      mover,
      from,
      to,
      JSON.stringify(option.path),
      option.kind,
    ],
  );
  if (!row) throw new GameError(409, STALE_BOARD);

  const move: Move = {
    moveNumber: game.moveCount + 1,
    player: mover,
    from,
    to,
    path: option.path,
    kind: option.kind,
    createdAt: now,
  };
  return { game: toGame(row), move };
}

export interface GameSummary {
  game: Game;
  myColor: Player;
}

/** The user's games in either seat, most recently active first. */
export async function listGamesForUser(userId: string, limit = 20): Promise<GameSummary[]> {
  const rows = await getDb().query<GameRow>(
    `${withPlayers("games")}
     WHERE $1 IN (g.red_user_id, g.blue_user_id)
     ORDER BY g.updated_at DESC
     LIMIT $2`,
    [userId, limit],
  );
  return rows.map((row) => {
    const game = toGame(row);
    // The WHERE clause guarantees a seat.
    return { game, myColor: seatOf(game, userId)! };
  });
}
