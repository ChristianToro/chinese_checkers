import type { CellKey, Player } from "./types";

/**
 * The 121-hole star, in axial hex coordinates (q, r) with s = -q - r.
 *
 * The star is the union of two large triangles: {q, r, s >= -4} and
 * {q, r, s <= 4}. Each has 91 cells and they overlap in the 61-cell central
 * hexagon, giving 91 + 91 - 61 = 121.
 */

export const DIRECTIONS = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
] as const;

export type Direction = (typeof DIRECTIONS)[number];

export interface Cell {
  key: CellKey;
  q: number;
  r: number;
  /** Layout position in hex-size units (pointy-top). */
  x: number;
  y: number;
  /** 1-based, top to bottom. */
  row: number;
  /** 1-based, left to right within the row. */
  col: number;
  /** Human-readable `row-col`, used in move history. */
  label: string;
}

export function toKey(q: number, r: number): CellKey {
  // Template literals render -0 as "0", so keys stay canonical.
  return `${q},${r}`;
}

export function parseKey(key: CellKey): [number, number] {
  const [q, r] = key.split(",").map(Number);
  return [q, r];
}

function isStarCell(q: number, r: number): boolean {
  const s = -q - r;
  return (q >= -4 && r >= -4 && s >= -4) || (q <= 4 && r <= 4 && s <= 4);
}

function buildCells(): Cell[] {
  const cells: Cell[] = [];
  for (let r = -8; r <= 8; r++) {
    const row: Cell[] = [];
    for (let q = -8; q <= 8; q++) {
      if (!isStarCell(q, r)) continue;
      row.push({
        key: toKey(q, r),
        q,
        r,
        x: Math.sqrt(3) * (q + r / 2),
        y: 1.5 * r,
        row: r + 9,
        col: 0,
        label: "",
      });
    }
    row.forEach((cell, i) => {
      cell.col = i + 1;
      cell.label = `${cell.row}-${cell.col}`;
    });
    cells.push(...row);
  }
  return cells;
}

export const CELLS: readonly Cell[] = buildCells();

export const CELL_MAP: ReadonlyMap<CellKey, Cell> = new Map(
  CELLS.map((c) => [c.key, c]),
);

export function isOnBoard(key: unknown): key is CellKey {
  return typeof key === "string" && CELL_MAP.has(key as CellKey);
}

/** The cell `distance` steps from `key` in `dir`, or null if off the board. */
export function neighbor(
  key: CellKey,
  dir: Direction,
  distance = 1,
): CellKey | null {
  const [q, r] = parseKey(key);
  const next = toKey(q + dir[0] * distance, r + dir[1] * distance);
  return CELL_MAP.has(next) ? next : null;
}

export function cellLabel(key: CellKey): string {
  return CELL_MAP.get(key)?.label ?? key;
}

/** Red starts in the top point, Blue in the bottom point. */
export const HOME: Readonly<Record<Player, ReadonlySet<CellKey>>> = {
  red: new Set(CELLS.filter((c) => c.r <= -5).map((c) => c.key)),
  blue: new Set(CELLS.filter((c) => c.r >= 5).map((c) => c.key)),
};

/** Each player races to the opposite point: the opponent's home. */
export const TARGET: Readonly<Record<Player, ReadonlySet<CellKey>>> = {
  red: HOME.blue,
  blue: HOME.red,
};

export const PLAYERS: readonly Player[] = ["red", "blue"];

export function opponent(player: Player): Player {
  return player === "red" ? "blue" : "red";
}
