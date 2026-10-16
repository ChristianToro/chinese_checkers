import type { MarbleColor } from "@/components/board-art";
import { CELLS, CELL_MAP } from "../game/board";
import { reachableFrom } from "../game/rules";
import type { CellKey, MoveKind } from "../game/types";

/**
 * A scripted six-player game for the landing page: 60 marbles, computed once
 * at module load and replayed as a loop. Decoration only; real games are
 * two-player and go through lib/game/rules.ts on the server.
 */

export interface DemoSeat {
  color: MarbleColor;
  /** A made-up username for the move tracker. */
  name: string;
  home: ReadonlySet<CellKey>;
  target: ReadonlySet<CellKey>;
}

export interface DemoMove {
  /** 1-based, like real move history. */
  moveNumber: number;
  seat: number;
  marble: number;
  /** Every hole the marble visits, starting with its origin. */
  path: CellKey[];
  kind: MoveKind;
}

function point(test: (q: number, r: number, s: number) => boolean): ReadonlySet<CellKey> {
  return new Set(CELLS.filter(({ q, r }) => test(q, r, -q - r)).map((c) => c.key));
}

// The six star points, clockwise from the top. Top and bottom match the real
// game's Red (ruby) and Blue (sapphire).
const TOP = point((_q, r) => r <= -5);
const UPPER_RIGHT = point((q) => q >= 5);
const LOWER_RIGHT = point((_q, _r, s) => s <= -5);
const BOTTOM = point((_q, r) => r >= 5);
const LOWER_LEFT = point((q) => q <= -5);
const UPPER_LEFT = point((_q, _r, s) => s >= 5);

/** Seats in turn order; each races to the point opposite its home. */
export const DEMO_SEATS: readonly DemoSeat[] = [
  { color: "ruby", name: "mei", home: TOP, target: BOTTOM },
  { color: "topaz", name: "otto", home: UPPER_RIGHT, target: LOWER_LEFT },
  { color: "jade", name: "priya", home: LOWER_RIGHT, target: UPPER_LEFT },
  { color: "sapphire", name: "sol", home: BOTTOM, target: TOP },
  { color: "amethyst", name: "kenji", home: LOWER_LEFT, target: UPPER_RIGHT },
  { color: "pearl", name: "ada", home: UPPER_LEFT, target: LOWER_RIGHT },
];

/** Marble id → its seat. Ids are stable, so the renderer can animate them. */
export const MARBLE_SEATS: readonly number[] = DEMO_SEATS.flatMap((seat, i) =>
  [...seat.home].map(() => i),
);

/** Marble id → starting hole. */
export const START: readonly CellKey[] = DEMO_SEATS.flatMap((seat) => [...seat.home]);

const ROUNDS = 6;
const SEED = 20261015;

/** Small deterministic PRNG (mulberry32), so every visitor sees the same game. */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Straight-line distance on the drawn board. Hex-step distance would also
 * reward hops that look sideways or backwards on screen.
 */
function distance(a: CellKey, b: CellKey): number {
  const p = CELL_MAP.get(a)!;
  const q = CELL_MAP.get(b)!;
  return Math.hypot(p.x - q.x, p.y - q.y);
}

/** The target point's tip: the hole in it farthest from the centre. */
function apexOf(target: ReadonlySet<CellKey>): CellKey {
  return [...target].reduce((best, key) =>
    distance(key, "0,0") > distance(best, "0,0") ? key : best,
  );
}

/**
 * Each turn the seat makes the move that gains the most ground toward its
 * target's tip, breaking ties at random. Marbles inside their target stay
 * there, as in the real rules.
 */
function buildScript(): DemoMove[] {
  const random = rng(SEED);
  const positions = [...START];
  const occupied = new Set<CellKey>(positions);
  const script: DemoMove[] = [];

  for (let turn = 0; turn < ROUNDS * DEMO_SEATS.length; turn++) {
    const seat = turn % DEMO_SEATS.length;
    const { target } = DEMO_SEATS[seat];
    const apex = apexOf(target);

    let best: { marble: number; path: CellKey[]; kind: MoveKind; score: number } | null = null;
    for (const [marble, from] of positions.entries()) {
      if (MARBLE_SEATS[marble] !== seat) continue;
      const locked = target.has(from);
      const options = reachableFrom(
        (key) => occupied.has(key),
        from,
        (key) => !locked || target.has(key),
      );
      for (const { path, kind } of options.values()) {
        const score = distance(from, apex) - distance(path.at(-1)!, apex) + random() * 0.5;
        if (!best || score > best.score) best = { marble, path, kind, score };
      }
    }
    if (!best) continue;

    const { marble, path, kind } = best;
    occupied.delete(positions[marble]);
    positions[marble] = path.at(-1)!;
    occupied.add(positions[marble]);
    script.push({ moveNumber: script.length + 1, seat, marble, path, kind });
  }
  return script;
}

export const DEMO_SCRIPT: readonly DemoMove[] = buildScript();

/** Marble positions before each move; the last entry is the final position. */
const SNAPSHOTS: readonly (readonly CellKey[])[] = DEMO_SCRIPT.reduce<CellKey[][]>(
  (snaps, move) => {
    const next = [...snaps.at(-1)!];
    next[move.marble] = move.path.at(-1)!;
    snaps.push(next);
    return snaps;
  },
  [[...START]],
);

/**
 * Where every marble is once `moveIndex` moves are done and the next move's
 * marble has made `hop` hops along its path.
 */
export function positionsAt(moveIndex: number, hop = 0): readonly CellKey[] {
  const base = SNAPSHOTS[Math.min(moveIndex, SNAPSHOTS.length - 1)];
  const move = DEMO_SCRIPT[moveIndex];
  if (!move || hop <= 0) return base;
  const at = [...base];
  at[move.marble] = move.path[Math.min(hop, move.path.length - 1)];
  return at;
}
