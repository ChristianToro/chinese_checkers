import { describe, expect, it } from "vitest";
import { getDb } from "./db";
import { TARGET } from "./game/board";
import type { Board } from "./game/types";
import {
  GameError,
  createGame,
  getGame,
  listMoves,
  resetGame,
  submitMove,
} from "./games-repo";

function expectGameError(fn: () => unknown, status: number) {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(GameError);
    expect((err as GameError).status).toBe(status);
    return;
  }
  throw new Error(`expected GameError ${status}`);
}

describe("games repository", () => {
  it("creates a game with red to move", () => {
    const game = createGame();
    expect(game.currentPlayer).toBe("red");
    expect(game.status).toBe("active");
    expect(game.moveCount).toBe(0);
    expect(Object.keys(game.board)).toHaveLength(20);
    expect(getGame(game.id)).toEqual(game);
    expect(getGame("missing")).toBeNull();
  });

  it("applies a legal move, records it, and passes the turn", () => {
    const { id } = createGame();
    const { game, move } = submitMove(id, { from: "1,-5", to: "1,-4", player: "red" });
    expect(game.board["1,-5"]).toBeUndefined();
    expect(game.board["1,-4"]).toBe("red");
    expect(game.currentPlayer).toBe("blue");
    expect(game.moveCount).toBe(1);
    expect(move).toMatchObject({ moveNumber: 1, player: "red", kind: "step", path: ["1,-5", "1,-4"] });
    expect(listMoves(id)).toEqual([move]);
  });

  it("enforces turn order and marble ownership", () => {
    const { id } = createGame();
    expectGameError(() => submitMove(id, { from: "-1,5", to: "-1,4" }), 409);
    expectGameError(() => submitMove(id, { from: "1,-5", to: "1,-4", player: "blue" }), 409);
  });

  it("rejects illegal moves and malformed input", () => {
    const { id } = createGame();
    expectGameError(() => submitMove(id, { from: "1,-5", to: "1,-2" }), 400);
    expectGameError(() => submitMove(id, { from: "0,0", to: "1,0" }), 400);
    expectGameError(() => submitMove(id, { from: "9,9", to: "1,-4" }), 400);
    expectGameError(() => submitMove(id, { from: "1,-5", to: "1,-4", player: "green" }), 400);
    expect(listMoves(id)).toEqual([]);
  });

  it("rejects a stale expectedMoveCount", () => {
    const { id } = createGame();
    submitMove(id, { from: "1,-5", to: "1,-4", expectedMoveCount: 0 });
    expectGameError(() => submitMove(id, { from: "-1,5", to: "-1,4", expectedMoveCount: 0 }), 409);
    submitMove(id, { from: "-1,5", to: "-1,4", expectedMoveCount: 1 });
  });

  it("returns 404 for unknown games", () => {
    expectGameError(() => submitMove("missing", { from: "1,-5", to: "1,-4" }), 404);
    expectGameError(() => listMoves("missing"), 404);
    expectGameError(() => resetGame("missing"), 404);
  });

  it("keeps history in move order", () => {
    const { id } = createGame();
    submitMove(id, { from: "1,-5", to: "1,-4" });
    submitMove(id, { from: "-1,5", to: "-1,4" });
    submitMove(id, { from: "2,-5", to: "2,-4" });
    expect(listMoves(id).map((m) => [m.moveNumber, m.player])).toEqual([
      [1, "red"],
      [2, "blue"],
      [3, "red"],
    ]);
  });

  it("detects a win and then refuses further moves", () => {
    const { id } = createGame();
    const [last, ...rest] = [...TARGET.red];
    const board: Board = Object.fromEntries(rest.map((k) => [k, "red"]));
    // `last` is "-4,5"; put the tenth red marble right next to it.
    expect(last).toBe("-4,5");
    board["-3,4"] = "red";
    board["4,-8"] = "blue";
    getDb().prepare("UPDATE games SET board = ? WHERE id = ?").run(JSON.stringify(board), id);

    const { game } = submitMove(id, { from: "-3,4", to: "-4,5" });
    expect(game.status).toBe("finished");
    expect(game.winner).toBe("red");
    expectGameError(() => submitMove(id, { from: "4,-8", to: "4,-7" }), 409);
  });

  it("reset restores the opening position and clears history", () => {
    const { id } = createGame();
    submitMove(id, { from: "1,-5", to: "1,-4" });
    const game = resetGame(id);
    expect(game.moveCount).toBe(0);
    expect(game.currentPlayer).toBe("red");
    expect(game.board["1,-5"]).toBe("red");
    expect(listMoves(id)).toEqual([]);
  });
});
