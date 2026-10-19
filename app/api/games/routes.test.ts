import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { setDb } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/session";
import { createSession, createUser } from "@/lib/users-repo";
import * as gameRoute from "./[id]/route";
import * as joinRoute from "./[id]/join/route";
import * as movesRoute from "./[id]/moves/route";
import * as resetRoute from "./[id]/reset/route";
import * as gamesRoute from "./route";

// The real session code runs; only the request's cookie store is faked.
const jar = vi.hoisted(() => ({ token: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "cc_session" && jar.token ? { name, value: jar.token } : undefined),
  }),
}));
vi.mock("server-only", () => ({}));

const schema = fs.readFileSync(new URL("../../../db/schema.sql", import.meta.url), "utf8");

const ctx = (id: string) => ({ params: Promise.resolve({ id }) }) as never;
const post = (body?: unknown) =>
  new Request("http://localhost/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

async function json(res: Response | Promise<Response>) {
  const r = await res;
  return { status: r.status, body: await r.json() };
}

describe("games API with sessions", () => {
  let pg: PGlite;
  const tokens: Record<"red" | "blue" | "eve", string> = { red: "", blue: "", eve: "" };
  const as = (who: keyof typeof tokens | null) => {
    jar.token = who ? tokens[who] : undefined;
  };

  beforeAll(async () => {
    pg = new PGlite();
    await pg.exec(schema);
    setDb({ query: async (text, params) => (await pg.query(text, params)).rows as never });
  });

  beforeEach(async () => {
    await pg.exec("TRUNCATE games, users CASCADE");
    for (const [who, avatar] of [["red", "tiger"], ["blue", "rabbit"], ["eve", "turtle"]] as const) {
      const user = await createUser({ username: who, password: "password-1", avatar });
      tokens[who] = await createSession(user!.id);
    }
    as(null);
  });

  it("names the cookie the proxy checks", () => {
    expect(SESSION_COOKIE).toBe("cc_session");
  });

  it("rejects every endpoint without a valid session", async () => {
    for (const token of [undefined, "forged"]) {
      jar.token = token;
      expect(await json(gamesRoute.POST())).toEqual({ status: 401, body: { error: "Sign in to play" } });
      expect((await gameRoute.GET(post(), ctx("x"))).status).toBe(401);
      expect((await movesRoute.GET(post(), ctx("x"))).status).toBe(401);
      expect((await movesRoute.POST(post({}), ctx("x"))).status).toBe(401);
      expect((await joinRoute.POST(post(), ctx("x"))).status).toBe(401);
      expect((await resetRoute.POST(post(), ctx("x"))).status).toBe(401);
    }
  });

  it("plays a game between two signed-in accounts", async () => {
    as("red");
    const created = await json(gamesRoute.POST());
    expect(created.status).toBe(201);
    const id: string = created.body.game.id;
    expect(created.body.game.red).toMatchObject({ username: "red", avatar: "tiger" });

    as("blue");
    const joined = await json(joinRoute.POST(post(), ctx(id)));
    expect(joined.body.game.blue).toMatchObject({ username: "blue", avatar: "rabbit" });

    // A client-sent `player` is ignored: the seat comes from the session.
    as("red");
    const moved = await json(movesRoute.POST(post({ from: "1,-5", to: "1,-4", player: "blue" }), ctx(id)));
    expect(moved.status).toBe(200);
    expect(moved.body.move.player).toBe("red");

    as("eve");
    expect((await json(joinRoute.POST(post(), ctx(id)))).status).toBe(409);
    expect((await json(movesRoute.POST(post({ from: "-1,5", to: "-1,4" }), ctx(id)))).status).toBe(403);
    expect((await json(resetRoute.POST(post(), ctx(id)))).status).toBe(403);
    // Spectators can still follow along.
    expect((await json(movesRoute.GET(post(), ctx(id)))).body.moves).toHaveLength(1);
    expect((await json(gameRoute.GET(post(), ctx(id)))).body.game.moveCount).toBe(1);
  });
});
