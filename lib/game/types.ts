export type Player = "red" | "blue";

/** Axial hex coordinate encoded as `"q,r"`. */
export type CellKey = `${number},${number}`;

/** Occupied cells only; an absent key is an empty hole. */
export type Board = Partial<Record<CellKey, Player>>;

export type MoveKind = "step" | "jump";

export interface MoveOption {
  /** Every cell the marble visits, starting with its origin. */
  path: CellKey[];
  kind: MoveKind;
}

export type GameStatus = "active" | "finished";

export interface Game {
  id: string;
  board: Board;
  currentPlayer: Player;
  status: GameStatus;
  winner: Player | null;
  moveCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Move {
  moveNumber: number;
  player: Player;
  from: CellKey;
  to: CellKey;
  path: CellKey[];
  kind: MoveKind;
  createdAt: string;
}
