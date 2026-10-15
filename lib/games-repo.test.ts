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
  joinGame,
  listGamesForUser,
  listMoves,
  resetGame,
  submitMove,
} from "./games-repo";

async function expectGameError(promise: Promise<unknown>, status: number) {
  await expect(promise).rejects.toBeInstanceOf(GameError);
  await expect(promise).rejects.toMatchObject({ status });
}

const schema = fs.readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");

// Seeded straight into the table: these tests are about games, not passwords.
const RED = "user-red";
const BLUE = "user-blue";
const EVE = "user-eve";

describe("games repository", () => {
  let pg: PGlite;

  beforeAll(async () => {
    pg = new PGlite();
    await pg.exec(schema);
    setDb({ query: async (text, params) => (await pg.query(text, params)).rows as never });
  });

  beforeEach(async () => {
    await pg.exec("TRUNCATE games, users CASCADE");
    await pg.exec(`
      INSERT INTO users (id, username, password_hash, avatar, created_at) VALUES
        ('${RED}', 'rosa', 'x', 'red_panda', now()),
        ('${BLUE}', 'bill', 'x', 'turtle', now()),
        ('${EVE}', 'eve', 'x', 'tiger', now())`);
  });

  /** A game with both seats filled, ready for moves. */
  async function startGame() {
    const { id } = await createGame(RED);
    return joinGame(id, BLUE);
  }

  it("creates a game with its creator in the red seat", async () => {
    const game = await createGame(RED);
    expect(game.currentPlayer).toBe("red");
    expect(game.status).toBe("active");
    expect(game.moveCount).toBe(0);
    expect(Object.keys(game.board)).toHaveLength(20);
    expect(game.red).toEqual({ id: RED, username: "rosa", avatar: "red_panda" });
    expect(game.blue).toBeNull();
    expect(await getGame(game.id)).toEqual(game);
    expect(await getGame("missing")).toBeNull();
  });

  it("seats a second player in blue and bumps updatedAt for pollers", async () => {
    const created = await createGame(RED);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const game = await joinGame(created.id, BLUE);
    expect(game.blue).toEqual({ id: BLUE, username: "bill", avatar: "turtle" });
    expect(game.updatedAt > created.updatedAt).toBe(true);
  });

  it("refuses a third player and keeps rejoining a no-op", async () => {
    const { id } = await startGame();
    await expectGameError(joinGame(id, EVE), 409);
    expect((await joinGame(id, RED)).red?.id).toBe(RED);
    expect((await joinGame(id, BLUE)).blue?.id).toBe(BLUE);
    await expectGameError(joinGame("missing", EVE), 404);
  });

  it("won't let the creator take both seats", async () => {
    const { id } = await createGame(RED);
    const game = await joinGame(id, RED);
    expect(game.blue).toBeNull();
  });

  it("fills an ownerless game's red seat first", async () => {
    const { id } = await createGame(RED);
    await getDb().query("UPDATE games SET red_user_id = NULL WHERE id = $1", [id]);
    expect((await joinGame(id, EVE)).red?.id).toBe(EVE);
    expect((await joinGame(id, BLUE)).blue?.id).toBe(BLUE);
  });

  it("gives only one of two racing joiners the last seat", async () => {
    const { id } = await createGame(RED);
    const results = await Promise.allSettled([joinGame(id, BLUE), joinGame(id, EVE)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await getGame(id))?.blue?.id).toMatch(/^user-(blue|eve)$/);
  });

  it("applies a legal move, records it, and passes the turn", async () => {
    const { id } = await startGame();
    const { game, move } = await submitMove(id, RED, { from: "1,-5", to: "1,-4" });
    expect(game.board["1,-5"]).toBeUndefined();
    expect(game.board["1,-4"]).toBe("red");
    expect(game.currentPlayer).toBe("blue");
    expect(game.moveCount).toBe(1);
    expect(game.blue?.id).toBe(BLUE);
    expect(move).toMatchObject({ moveNumber: 1, player: "red", kind: "step", path: ["1,-5", "1,-4"] });
    expect(await listMoves(id)).toEqual([move]);
  });

  it("waits for an opponent before the first move", async () => {
    const { id } = await createGame(RED);
    await expectGameError(submitMove(id, RED, { from: "1,-5", to: "1,-4" }), 409);
  });

  it("lets only the player whose turn it is move", async () => {
    const { id } = await startGame();
    await expectGameError(submitMove(id, EVE, { from: "1,-5", to: "1,-4" }), 403);
    await expectGameError(submitMove(id, BLUE, { from: "-1,5", to: "-1,4" }), 409);
    await submitMove(id, RED, { from: "1,-5", to: "1,-4" });
    await expectGameError(submitMove(id, RED, { from: "2,-5", to: "2,-4" }), 409);
  });

  it("enforces marble ownership", async () => {
    const { id } = await startGame();
    await expectGameError(submitMove(id, RED, { from: "-1,5", to: "-1,4" }), 409);
  });

  it("rejects illegal moves and malformed input", async () => {
    const { id } = await startGame();
    await expectGameError(submitMove(id, RED, { from: "1,-5", to: "1,-2" }), 400);
    await expectGameError(submitMove(id, RED, { from: "0,0", to: "1,0" }), 400);
    await expectGameError(submitMove(id, RED, { from: "9,9", to: "1,-4" }), 400);
    await expectGameError(submitMove(id, RED, { from: "1,-5", to: "1,-4", expectedMoveCount: -1 }), 400);
    expect(await listMoves(id)).toEqual([]);
  });

  it("rejects a stale expectedMoveCount", async () => {
    const { id } = await startGame();
    await submitMove(id, RED, { from: "1,-5", to: "1,-4", expectedMoveCount: 0 });
    await expectGameError(submitMove(id, BLUE, { from: "-1,5", to: "-1,4", expectedMoveCount: 0 }), 409);
    await submitMove(id, BLUE, { from: "-1,5", to: "-1,4", expectedMoveCount: 1 });
  });

  it("returns 404 for unknown games", async () => {
    await expectGameError(submitMove("missing", RED, { from: "1,-5", to: "1,-4" }), 404);
    await expectGameError(listMoves("missing"), 404);
    await expectGameError(resetGame("missing", RED), 404);
  });

  it("keeps history in move order", async () => {
    const { id } = await startGame();
    await submitMove(id, RED, { from: "1,-5", to: "1,-4" });
    await submitMove(id, BLUE, { from: "-1,5", to: "-1,4" });
    await submitMove(id, RED, { from: "2,-5", to: "2,-4" });
    expect((await listMoves(id)).map((m) => [m.moveNumber, m.player])).toEqual([
      [1, "red"],
      [2, "blue"],
      [3, "red"],
    ]);
  });

  async function finishGame(id: string) {
    const [last, ...rest] = [...TARGET.red];
    const board: Board = Object.fromEntries(rest.map((k) => [k, "red"]));
    // `last` is "-4,5"; put the tenth red marble right next to it.
    expect(last).toBe("-4,5");
    board["-3,4"] = "red";
    board["4,-8"] = "blue";
    await getDb().query("UPDATE games SET board = $1::jsonb WHERE id = $2", [JSON.stringify(board), id]);
    return submitMove(id, RED, { from: "-3,4", to: "-4,5" });
  }

  it("detects a win and then refuses further moves", async () => {
    const { id } = await startGame();
    const { game } = await finishGame(id);
    expect(game.status).toBe("finished");
    expect(game.winner).toBe("red");
    await expectGameError(submitMove(id, BLUE, { from: "4,-8", to: "4,-7" }), 409);
  });

  it("lets a player reset an active game, restoring the opening and clearing history", async () => {
    const { id } = await startGame();
    await submitMove(id, RED, { from: "1,-5", to: "1,-4" });
    const game = await resetGame(id, BLUE);
    expect(game.moveCount).toBe(0);
    expect(game.currentPlayer).toBe("red");
    expect(game.board["1,-5"]).toBe("red");
    expect(game.blue?.id).toBe(BLUE);
    expect(await listMoves(id)).toEqual([]);
  });

  it("keeps non-players and finished games out of reset", async () => {
    const { id } = await startGame();
    await expectGameError(resetGame(id, EVE), 403);
    await finishGame(id);
    await expectGameError(resetGame(id, RED), 409);
    expect(await listMoves(id)).toHaveLength(1);
  });

  it("lists a user's games in either seat, newest first", async () => {
    const first = await startGame();
    const second = await createGame(BLUE);
    await submitMove(first.id, RED, { from: "1,-5", to: "1,-4" });

    const blues = await listGamesForUser(BLUE);
    expect(blues.map(({ game, myColor }) => [game.id, myColor])).toEqual([
      [first.id, "blue"],
      [second.id, "red"],
    ]);
    expect(blues[0].game.red?.username).toBe("rosa");
    expect((await listGamesForUser(RED)).map(({ game }) => game.id)).toEqual([first.id]);
    expect(await listGamesForUser(EVE)).toEqual([]);
  });

  it("lets only one of two concurrent identical moves through", async () => {
    const { id } = await startGame();
    const results = await Promise.allSettled([
      submitMove(id, RED, { from: "1,-5", to: "1,-4" }),
      submitMove(id, RED, { from: "1,-5", to: "1,-4" }),
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
