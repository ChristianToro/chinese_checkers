import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDb, setDb } from "./db";
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

async function expectGameError(promise: Promise<unknown>, status: number) {
  await expect(promise).rejects.toBeInstanceOf(GameError);
  await expect(promise).rejects.toMatchObject({ status });
}

const schema = fs.readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");

describe("games repository", () => {
  let pg: PGlite;

  beforeAll(async () => {
    pg = new PGlite();
    await pg.exec(schema);
    setDb({ query: async (text, params) => (await pg.query(text, params)).rows as never });
  });

  beforeEach(async () => {
    await pg.exec("TRUNCATE games CASCADE");
  });

  it("creates a game with red to move", async () => {
    const game = await createGame();
    expect(game.currentPlayer).toBe("red");
    expect(game.status).toBe("active");
    expect(game.moveCount).toBe(0);
    expect(Object.keys(game.board)).toHaveLength(20);
    expect(await getGame(game.id)).toEqual(game);
    expect(await getGame("missing")).toBeNull();
  });

  it("applies a legal move, records it, and passes the turn", async () => {
    const { id } = await createGame();
    const { game, move } = await submitMove(id, { from: "1,-5", to: "1,-4", player: "red" });
    expect(game.board["1,-5"]).toBeUndefined();
    expect(game.board["1,-4"]).toBe("red");
    expect(game.currentPlayer).toBe("blue");
    expect(game.moveCount).toBe(1);
    expect(move).toMatchObject({ moveNumber: 1, player: "red", kind: "step", path: ["1,-5", "1,-4"] });
    expect(await listMoves(id)).toEqual([move]);
  });

  it("enforces turn order and marble ownership", async () => {
    const { id } = await createGame();
    await expectGameError(submitMove(id, { from: "-1,5", to: "-1,4" }), 409);
    await expectGameError(submitMove(id, { from: "1,-5", to: "1,-4", player: "blue" }), 409);
  });

  it("rejects illegal moves and malformed input", async () => {
    const { id } = await createGame();
    await expectGameError(submitMove(id, { from: "1,-5", to: "1,-2" }), 400);
    await expectGameError(submitMove(id, { from: "0,0", to: "1,0" }), 400);
    await expectGameError(submitMove(id, { from: "9,9", to: "1,-4" }), 400);
    await expectGameError(submitMove(id, { from: "1,-5", to: "1,-4", player: "green" }), 400);
    expect(await listMoves(id)).toEqual([]);
  });

  it("rejects a stale expectedMoveCount", async () => {
    const { id } = await createGame();
    await submitMove(id, { from: "1,-5", to: "1,-4", expectedMoveCount: 0 });
    await expectGameError(submitMove(id, { from: "-1,5", to: "-1,4", expectedMoveCount: 0 }), 409);
    await submitMove(id, { from: "-1,5", to: "-1,4", expectedMoveCount: 1 });
  });

  it("returns 404 for unknown games", async () => {
    await expectGameError(submitMove("missing", { from: "1,-5", to: "1,-4" }), 404);
    await expectGameError(listMoves("missing"), 404);
    await expectGameError(resetGame("missing"), 404);
  });

  it("keeps history in move order", async () => {
    const { id } = await createGame();
    await submitMove(id, { from: "1,-5", to: "1,-4" });
    await submitMove(id, { from: "-1,5", to: "-1,4" });
    await submitMove(id, { from: "2,-5", to: "2,-4" });
    expect((await listMoves(id)).map((m) => [m.moveNumber, m.player])).toEqual([
      [1, "red"],
      [2, "blue"],
      [3, "red"],
    ]);
  });

  it("detects a win and then refuses further moves", async () => {
    const { id } = await createGame();
    const [last, ...rest] = [...TARGET.red];
    const board: Board = Object.fromEntries(rest.map((k) => [k, "red"]));
    // `last` is "-4,5"; put the tenth red marble right next to it.
    expect(last).toBe("-4,5");
    board["-3,4"] = "red";
    board["4,-8"] = "blue";
    await getDb().query("UPDATE games SET board = $1::jsonb WHERE id = $2", [JSON.stringify(board), id]);

    const { game } = await submitMove(id, { from: "-3,4", to: "-4,5" });
    expect(game.status).toBe("finished");
    expect(game.winner).toBe("red");
    await expectGameError(submitMove(id, { from: "4,-8", to: "4,-7" }), 409);
  });

  it("reset restores the opening position and clears history", async () => {
    const { id } = await createGame();
    await submitMove(id, { from: "1,-5", to: "1,-4" });
    const game = await resetGame(id);
    expect(game.moveCount).toBe(0);
    expect(game.currentPlayer).toBe("red");
    expect(game.board["1,-5"]).toBe("red");
    expect(await listMoves(id)).toEqual([]);
  });

  it("lets only one of two concurrent identical moves through", async () => {
    const { id } = await createGame();
    const results = await Promise.allSettled([
      submitMove(id, { from: "1,-5", to: "1,-4" }),
      submitMove(id, { from: "1,-5", to: "1,-4" }),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(GameError);
    expect((rejected[0].reason as GameError).status).toBe(409);
    expect(await listMoves(id)).toHaveLength(1);
    expect((await getGame(id))?.moveCount).toBe(1);
  });
});
