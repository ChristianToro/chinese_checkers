import { randomUUID } from "node:crypto";
import { getDb } from "./db";
import { cellLabel, isOnBoard } from "./game/board";
import { applyMove, hasWon, initialBoard, legalMoves, nextPlayer } from "./game/rules";
import type { Board, CellKey, Game, GameStatus, Move, MoveKind, Player } from "./game/types";

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

function toGame(row: GameRow): Game {
  return {
    id: row.id,
    board: fromJson(row.board),
    currentPlayer: row.current_player,
    status: row.status,
    winner: row.winner,
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

async function selectGame(id: string): Promise<GameRow | undefined> {
  const rows = await getDb().query<GameRow>("SELECT * FROM games WHERE id = $1", [id]);
  return rows[0];
}

async function requireGame(id: string): Promise<Game> {
  const row = await selectGame(id);
  if (!row) throw new GameError(404, `Game ${id} not found`);
  return toGame(row);
}

export async function createGame(): Promise<Game> {
  const id = randomUUID().replaceAll("-", "").slice(0, 10);
  const now = new Date().toISOString();
  const [row] = await getDb().query<GameRow>(
    `INSERT INTO games (id, board, current_player, status, winner, move_count, created_at, updated_at)
     VALUES ($1, $2::jsonb, 'red', 'active', NULL, 0, $3, $3)
     RETURNING *`,
    [id, JSON.stringify(initialBoard()), now],
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

export async function resetGame(id: string): Promise<Game> {
  const [row] = await getDb().query<GameRow>(
    `WITH del AS (DELETE FROM moves WHERE game_id = $1)
     UPDATE games
     SET board = $2::jsonb, current_player = 'red', status = 'active', winner = NULL,
         move_count = 0, updated_at = $3
     WHERE id = $1
     RETURNING *`,
    [id, JSON.stringify(initialBoard()), new Date().toISOString()],
  );
  if (!row) throw new GameError(404, `Game ${id} not found`);
  return toGame(row);
}

export interface MoveInput {
  from: unknown;
  to: unknown;
  /** Optional seat check: reject if it isn't this player's turn. */
  player?: unknown;
  /** Optional optimistic-concurrency check against `game.moveCount`. */
  expectedMoveCount?: unknown;
}

function parseMoveInput(input: MoveInput) {
  const { from, to, player, expectedMoveCount } = input;
  if (!isOnBoard(from) || !isOnBoard(to)) {
    throw new GameError(400, "`from` and `to` must be board cells like \"0,-5\"");
  }
  if (player !== undefined && player !== "red" && player !== "blue") {
    throw new GameError(400, "`player` must be \"red\" or \"blue\"");
  }
  if (
    expectedMoveCount !== undefined &&
    !(Number.isInteger(expectedMoveCount) && (expectedMoveCount as number) >= 0)
  ) {
    throw new GameError(400, "`expectedMoveCount` must be a non-negative integer");
  }
  return {
    from,
    to,
    player: player as Player | undefined,
    expectedMoveCount: expectedMoveCount as number | undefined,
  };
}

const STALE_BOARD = "The board has changed since you loaded it; refresh and try again";

/**
 * Validates one move against the current game (turn order, marble ownership,
 * legality, win detection), then writes it with a single guarded statement:
 * the game update only matches if `move_count` is still what was read, and the
 * history insert rides along in a CTE. A concurrent writer leaves 0 rows → 409.
 */
export async function submitMove(
  id: string,
  input: MoveInput,
): Promise<{ game: Game; move: Move }> {
  const { from, to, player, expectedMoveCount } = parseMoveInput(input);
  const game = await requireGame(id);
  const mover = game.currentPlayer;

  if (game.status === "finished") {
    throw new GameError(409, `The game is over: ${game.winner} won`);
  }
  if (expectedMoveCount !== undefined && expectedMoveCount !== game.moveCount) {
    throw new GameError(409, STALE_BOARD);
  }
  if (player !== undefined && player !== mover) {
    throw new GameError(409, `It's ${mover}'s turn, not ${player}'s`);
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
     SELECT * FROM upd`,
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
