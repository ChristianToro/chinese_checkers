import { describe, expect, it } from "vitest";
import { CELLS, HOME, TARGET, isOnBoard } from "./board";
import {
  applyMove,
  hasAnyMove,
  hasWon,
  initialBoard,
  legalMoves,
  nextPlayer,
} from "./rules";
import type { Board, CellKey } from "./types";

const board = (entries: Record<string, "red" | "blue">): Board =>
  entries as Board;

describe("board", () => {
  it("has 121 holes laid out in the classic star rows", () => {
    expect(CELLS).toHaveLength(121);
    const rowLengths = Array.from(
      { length: 17 },
      (_, i) => CELLS.filter((c) => c.row === i + 1).length,
    );
    expect(rowLengths).toEqual([
      1, 2, 3, 4, 13, 12, 11, 10, 9, 10, 11, 12, 13, 4, 3, 2, 1,
    ]);
  });

  it("has disjoint 10-hole homes, each the other's target", () => {
    expect(HOME.red.size).toBe(10);
    expect(HOME.blue.size).toBe(10);
    expect([...HOME.red].some((k) => HOME.blue.has(k))).toBe(false);
    expect(TARGET.red).toBe(HOME.blue);
    expect(TARGET.blue).toBe(HOME.red);
  });

  it("rejects keys that aren't holes", () => {
    expect(isOnBoard("0,0")).toBe(true);
    expect(isOnBoard("0,5")).toBe(false);
    expect(isOnBoard("nope")).toBe(false);
    expect(isOnBoard(42)).toBe(false);
  });
});

describe("initialBoard", () => {
  it("places 10 red marbles at the top and 10 blue at the bottom", () => {
    const b = initialBoard();
    const entries = Object.entries(b) as [CellKey, string][];
    expect(entries.filter(([, p]) => p === "red")).toHaveLength(10);
    expect(entries.filter(([, p]) => p === "blue")).toHaveLength(10);
    for (const [key, p] of entries) expect(HOME[p as "red"].has(key)).toBe(true);
  });
});

describe("legalMoves", () => {
  it("steps to any empty adjacent hole", () => {
    const moves = legalMoves(board({ "0,0": "red" }), "0,0");
    expect([...moves.keys()].sort()).toEqual(
      ["1,0", "1,-1", "0,-1", "-1,0", "-1,1", "0,1"].sort(),
    );
    for (const m of moves.values()) expect(m.kind).toBe("step");
  });

  it("returns nothing for an empty hole", () => {
    expect(legalMoves({}, "0,0").size).toBe(0);
  });

  it("hops over an adjacent marble of either colour", () => {
    const moves = legalMoves(board({ "0,0": "red", "1,0": "blue" }), "0,0");
    expect(moves.get("2,0")).toEqual({ path: ["0,0", "2,0"], kind: "jump" });
    expect(moves.has("1,0")).toBe(false);

    const own = legalMoves(board({ "0,0": "red", "1,0": "red" }), "0,0");
    expect(own.get("2,0")?.kind).toBe("jump");
  });

  it("chains hops and allows changing direction", () => {
    const b = board({ "0,0": "red", "1,0": "blue", "2,-1": "blue" });
    const moves = legalMoves(b, "0,0");
    expect(moves.get("2,0")?.path).toEqual(["0,0", "2,0"]);
    expect(moves.get("2,-2")).toEqual({
      path: ["0,0", "2,0", "2,-2"],
      kind: "jump",
    });
  });

  it("won't hop over an empty hole or onto an occupied one", () => {
    expect(legalMoves(board({ "0,0": "red" }), "0,0").has("2,0")).toBe(false);
    const blocked = legalMoves(
      board({ "0,0": "red", "1,0": "blue", "2,0": "blue" }),
      "0,0",
    );
    expect(blocked.has("2,0")).toBe(false);
    expect(blocked.has("3,0")).toBe(false);
  });

  it("never leaves the board", () => {
    // Bottom tip, surrounded by marbles: any hop would land off the star.
    const b = board({ "-4,8": "blue", "-3,7": "red", "-4,7": "red" });
    for (const key of legalMoves(b, "-4,8").keys()) {
      expect(isOnBoard(key)).toBe(true);
    }
  });

  it("terminates on hop loops and never returns to the origin", () => {
    // 0,0 -> 2,0 -> 2,-2 -> 0,-2 -> back to 0,0 is a closed loop.
    const b = board({
      "0,0": "red",
      "1,0": "blue",
      "2,-1": "blue",
      "1,-2": "blue",
      "0,-1": "blue",
    });
    const moves = legalMoves(b, "0,0");
    expect(moves.has("0,0")).toBe(false);
    // Shortest path wins: 0,-2 is a single hop over 0,-1.
    expect(moves.get("0,-2")?.path).toEqual(["0,0", "0,-2"]);
    expect(moves.get("2,-2")?.path).toHaveLength(3);
  });

  it("keeps a marble inside its target triangle once it has arrived", () => {
    const moves = legalMoves(board({ "-1,5": "red" }), "-1,5");
    expect([...moves.keys()].sort()).toEqual(["-2,5", "-2,6"]);
    for (const key of moves.keys()) expect(TARGET.red.has(key)).toBe(true);
  });

  it("lets a marble enter its target triangle from outside", () => {
    const moves = legalMoves(board({ "-1,4": "red" }), "-1,4");
    expect(moves.has("-1,5")).toBe(true);
    expect(moves.has("-1,3")).toBe(true);
  });

  it("only applies the lock to the marble's own target", () => {
    // A red marble sitting in its own home may leave freely.
    const moves = legalMoves(board({ "1,-5": "red" }), "1,-5");
    expect(moves.has("1,-4")).toBe(true);
  });
});

describe("applyMove", () => {
  it("moves the marble without mutating the input", () => {
    const before = board({ "0,0": "red" });
    const after = applyMove(before, "0,0", "1,0");
    expect(after).toEqual({ "1,0": "red" });
    expect(before).toEqual({ "0,0": "red" });
  });
});

describe("hasWon", () => {
  const fill = (cells: Iterable<CellKey>, p: "red" | "blue") =>
    Object.fromEntries([...cells].map((k) => [k, p])) as Board;

  it("is false at the start", () => {
    expect(hasWon(initialBoard(), "red")).toBe(false);
    expect(hasWon(initialBoard(), "blue")).toBe(false);
  });

  it("is true when all ten target holes hold the player's marbles", () => {
    expect(hasWon(fill(TARGET.red, "red"), "red")).toBe(true);
  });

  it("is false while a target hole is still empty", () => {
    const [first, ...rest] = [...TARGET.red];
    const b = fill(rest, "red");
    expect(b[first]).toBeUndefined();
    expect(hasWon(b, "red")).toBe(false);
  });

  it("counts a target blocked by opponent marbles as a win (anti-spoiling)", () => {
    const [first, ...rest] = [...TARGET.red];
    const b = { ...fill(rest, "blue"), [first]: "red" } as Board;
    expect(hasWon(b, "red")).toBe(true);
  });
});

describe("turn order", () => {
  it("passes to the opponent normally", () => {
    expect(nextPlayer(initialBoard(), "red")).toBe("blue");
  });

  it("gives the mover another turn if the opponent is stuck", () => {
    const b = board({
      "-4,8": "blue",
      "-3,7": "red",
      "-4,7": "red",
      "-2,6": "red",
      "-4,6": "red",
    });
    expect(hasAnyMove(b, "blue")).toBe(false);
    expect(nextPlayer(b, "red")).toBe("red");
  });
});
