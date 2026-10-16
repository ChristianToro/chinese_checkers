import { DIRECTIONS, HOME, TARGET, neighbor, opponent } from "./board";
import type { Board, CellKey, MoveOption, Player } from "./types";

export function initialBoard(): Board {
  const board: Board = {};
  for (const player of ["red", "blue"] as const) {
    for (const key of HOME[player]) board[key] = player;
  }
  return board;
}

/**
 * Every destination the marble on `from` can reach this turn, with the path
 * taken. A turn is either one step to an adjacent empty hole, or a chain of
 * one or more hops, each over an adjacent marble (any colour) onto the empty
 * hole directly beyond. The chain may change direction and may stop after
 * any hop. A marble already inside its target triangle may not leave it.
 */
export function legalMoves(
  board: Board,
  from: CellKey,
): Map<CellKey, MoveOption> {
  const player = board[from];
  if (!player) return new Map();

  const target = TARGET[player];
  const locked = target.has(from);
  return reachableFrom(
    (key) => !!board[key],
    from,
    (key) => !locked || target.has(key),
  );
}

/**
 * The step and hop search behind `legalMoves`, blind to colour and players:
 * `isOccupied` says which holes hold a marble and `allowed` filters where the
 * marble may stop or land. The moving marble's own hole counts as empty, since
 * it has left it and can't be hopped over.
 */
export function reachableFrom(
  isOccupied: (key: CellKey) => boolean,
  from: CellKey,
  allowed: (key: CellKey) => boolean = () => true,
): Map<CellKey, MoveOption> {
  const moves = new Map<CellKey, MoveOption>();
  const occupied = (key: CellKey) => key !== from && isOccupied(key);

  for (const dir of DIRECTIONS) {
    const to = neighbor(from, dir);
    if (to && !occupied(to) && allowed(to)) {
      moves.set(to, { path: [from, to], kind: "step" });
    }
  }

  const parent = new Map<CellKey, CellKey>();
  const visited = new Set<CellKey>([from]);
  const queue: CellKey[] = [from];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const dir of DIRECTIONS) {
      const over = neighbor(current, dir);
      const land = neighbor(current, dir, 2);
      if (!over || !land || !occupied(over) || occupied(land)) continue;
      if (visited.has(land) || !allowed(land)) continue;
      visited.add(land);
      parent.set(land, current);
      queue.push(land);
    }
  }

  for (const land of parent.keys()) {
    if (moves.has(land)) continue;
    const path: CellKey[] = [land];
    for (let k = land; k !== from; ) {
      k = parent.get(k)!;
      path.unshift(k);
    }
    moves.set(land, { path, kind: "jump" });
  }

  return moves;
}

export function applyMove(board: Board, from: CellKey, to: CellKey): Board {
  const next: Board = { ...board };
  next[to] = next[from];
  delete next[from];
  return next;
}

/**
 * A player wins once every hole of their target triangle is filled and at
 * least one of those marbles is theirs. With all ten of their own marbles that
 * is the normal win; the "at least one" clause is the standard anti-spoiling
 * rule, so an opponent can't block a win by never leaving home.
 */
export function hasWon(board: Board, player: Player): boolean {
  let own = 0;
  for (const key of TARGET[player]) {
    const occupant = board[key];
    if (!occupant) return false;
    if (occupant === player) own++;
  }
  return own > 0;
}

export function hasAnyMove(board: Board, player: Player): boolean {
  for (const [key, occupant] of Object.entries(board)) {
    if (occupant === player && legalMoves(board, key as CellKey).size > 0) {
      return true;
    }
  }
  return false;
}

/** Whose turn follows `mover`: normally the opponent, unless they're stuck. */
export function nextPlayer(board: Board, mover: Player): Player {
  const other = opponent(mover);
  return hasAnyMove(board, other) ? other : mover;
}
