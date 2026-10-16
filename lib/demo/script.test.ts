import { describe, expect, it, vi } from "vitest";
import { DIRECTIONS, neighbor } from "../game/board";
import type { CellKey } from "../game/types";
import { DEMO_SCRIPT, DEMO_SEATS, MARBLE_SEATS, START, positionsAt } from "./script";

describe("demo script", () => {
  it("starts with sixty marbles, ten in each of six disjoint points", () => {
    expect(START).toHaveLength(60);
    expect(new Set(START).size).toBe(60);
    for (const [i, seat] of DEMO_SEATS.entries()) {
      expect(seat.home.size).toBe(10);
      expect(START.filter((_, m) => MARBLE_SEATS[m] === i).every((k) => seat.home.has(k))).toBe(true);
    }
    // Each seat's target is another seat's home, and every home is someone's target.
    const homes = DEMO_SEATS.map((s) => s.home);
    expect(new Set(DEMO_SEATS.map((s) => homes.indexOf(s.target))).size).toBe(6);
    expect(DEMO_SEATS.every((s) => s.target !== s.home)).toBe(true);
  });

  it("is six full rounds, taken in seat order", () => {
    expect(DEMO_SCRIPT).toHaveLength(36);
    DEMO_SCRIPT.forEach((move, i) => {
      expect(move.moveNumber).toBe(i + 1);
      expect(move.seat).toBe(i % 6);
      expect(MARBLE_SEATS[move.marble]).toBe(move.seat);
    });
  });

  it("only makes legal steps and hops, and never stacks two marbles", () => {
    DEMO_SCRIPT.forEach((move, i) => {
      const before = positionsAt(i);
      const occupied = new Set<CellKey>(before);
      expect(occupied.size).toBe(60);
      expect(before[move.marble]).toBe(move.path[0]);
      occupied.delete(move.path[0]);

      if (move.kind === "step") {
        expect(move.path).toHaveLength(2);
        const [from, to] = move.path;
        expect(DIRECTIONS.some((d) => neighbor(from, d) === to)).toBe(true);
        expect(occupied.has(to)).toBe(false);
      } else {
        for (let h = 1; h < move.path.length; h++) {
          const from = move.path[h - 1];
          const to = move.path[h];
          const dir = DIRECTIONS.find((d) => neighbor(from, d, 2) === to);
          expect(dir, `hop ${from} → ${to} in move ${move.moveNumber}`).toBeDefined();
          expect(occupied.has(neighbor(from, dir!)!)).toBe(true);
          expect(occupied.has(to)).toBe(false);
        }
      }
    });
    expect(new Set(positionsAt(DEMO_SCRIPT.length)).size).toBe(60);
  });

  it("moves the marble one hole per hop mid-move", () => {
    const i = DEMO_SCRIPT.findIndex((m) => m.path.length > 2);
    expect(i).toBeGreaterThanOrEqual(0);
    const move = DEMO_SCRIPT[i];
    expect(positionsAt(i, 1)[move.marble]).toBe(move.path[1]);
    expect(positionsAt(i, 99)[move.marble]).toBe(move.path.at(-1));
    expect(positionsAt(i + 1)[move.marble]).toBe(move.path.at(-1));
  });

  it("is deterministic", async () => {
    vi.resetModules();
    const again = await import("./script");
    expect(again.DEMO_SCRIPT).toEqual(DEMO_SCRIPT);
  });
});
