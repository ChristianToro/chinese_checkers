import { randomUUID } from "node:crypto";
import { getDb } from "./db";
import { cellLabel, isOnBoard } from "./game/board";
import { applyMove, hasWon, initialBoard, legalMoves, nextPlayer } from "./game/rules";
import type { Board, CellKey, Game, GameStatus, Move, MoveKind, Player } from "./game/types";

/** An error that maps directly onto an HTTP status for the API layer. */
export class GameError extends Error {
  constructor(
    public readonly status: 400 | 404 | 409,
    message: string,
  ) {
    super(message);
  }
}

interface GameRow {
  id: string;
  board: string;
  current_player: Player;
  status: GameStatus;
  winner: Player | null;
  move_count: number;
  created_at: string;
  updated_at: string;
}

interface MoveRow {
  move_number: number;
  player: Player;
  from_cell: CellKey;
  to_cell: CellKey;
  path: string;
  kind: MoveKind;
  created_at: string;
}

function toGame(row: GameRow): Game {
  return {
    id: row.id,
    board: JSON.parse(row.board) as Board,
    currentPlayer: row.current_player,
    status: row.status,
    winner: row.winner,
    moveCount: row.move_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toMove(row: MoveRow): Move {
  return {
    moveNumber: row.move_number,
    player: row.player,
    from: row.from_cell,
    to: row.to_cell,
    path: JSON.parse(row.path) as CellKey[],
    kind: row.kind,
    createdAt: row.created_at,
  };
}

function selectGame(id: string): GameRow | undefined {
  return getDb().prepare("SELECT * FROM games WHERE id = ?").get(id) as
    | GameRow
    | undefined;
}

function requireGame(id: string): Game {
  const row = selectGame(id);
  if (!row) throw new GameError(404, `Game ${id} not found`);
  return toGame(row);
}

export function createGame(): Game {
  const id = randomUUID().replaceAll("-", "").slice(0, 10);
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO games (id, board, current_player, status, winner, move_count, created_at, updated_at)
       VALUES (?, ?, 'red', 'active', NULL, 0, ?, ?)`,
    )
    .run(id, JSON.stringify(initialBoard()), now, now);
  return requireGame(id);
}

export function getGame(id: string): Game | null {
  const row = selectGame(id);
  return row ? toGame(row) : null;
}

export function listMoves(id: string): Move[] {
  requireGame(id);
  const rows = getDb()
    .prepare("SELECT * FROM moves WHERE game_id = ? ORDER BY move_number")
    .all(id) as MoveRow[];
  return rows.map(toMove);
}

export function resetGame(id: string): Game {
  const db = getDb();
  db.transaction(() => {
    requireGame(id);
    db.prepare("DELETE FROM moves WHERE game_id = ?").run(id);
    db.prepare(
      `UPDATE games
       SET board = ?, current_player = 'red', status = 'active', winner = NULL,
           move_count = 0, updated_at = ?
       WHERE id = ?`,
    ).run(JSON.stringify(initialBoard()), new Date().toISOString(), id);
  })();
  return requireGame(id);
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

/**
 * Validates and applies one move atomically: turn order, marble ownership,
 * move legality, win detection, and the move-history record all happen in a
 * single SQLite transaction.
 */
export function submitMove(id: string, input: MoveInput): { game: Game; move: Move } {
  const { from, to, player, expectedMoveCount } = parseMoveInput(input);
  const db = getDb();

  return db.transaction(() => {
    const game = requireGame(id);
    const mover = game.currentPlayer;

    if (game.status === "finished") {
      throw new GameError(409, `The game is over: ${game.winner} won`);
    }
    if (expectedMoveCount !== undefined && expectedMoveCount !== game.moveCount) {
      throw new GameError(409, "The board has changed since you loaded it; refresh and try again");
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
    const moveNumber = game.moveCount + 1;

    db.prepare(
      `INSERT INTO moves (game_id, move_number, player, from_cell, to_cell, path, kind, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, moveNumber, mover, from, to, JSON.stringify(option.path), option.kind, now);

    db.prepare(
      `UPDATE games
       SET board = ?, current_player = ?, status = ?, winner = ?, move_count = ?, updated_at = ?
       WHERE id = ?`,
    ).run(
      JSON.stringify(board),
      won ? mover : nextPlayer(board, mover),
      won ? "finished" : "active",
      won ? mover : null,
      moveNumber,
      now,
      id,
    );

    const move: Move = {
      moveNumber,
      player: mover,
      from,
      to,
      path: option.path,
      kind: option.kind,
      createdAt: now,
    };
    return { game: requireGame(id), move };
  })();
}
