import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { setDb } from "./db";
import { GameError } from "./games-repo";
import { SESSION_COOKIE, endSession, getCurrentUser, requireUser, startSession } from "./session";
import { createUser } from "./users-repo";

// A stand-in for the request's cookie store, which `cookies()` normally reads.
const jar = vi.hoisted(() => new Map<string, { value: string; options?: Record<string, unknown> }>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)!.value } : undefined),
    set: (name: string, value: string, options?: Record<string, unknown>) => jar.set(name, { value, options }),
    delete: (name: string) => jar.delete(name),
  }),
}));
// Next aliases this marker package at build time; outside Next it doesn't resolve.
vi.mock("server-only", () => ({}));

const schema = fs.readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");

describe("session cookies", () => {
  let pg: PGlite;

  beforeAll(async () => {
    pg = new PGlite();
    await pg.exec(schema);
    setDb({ query: async (text, params) => (await pg.query(text, params)).rows as never });
  });

  beforeEach(async () => {
    await pg.exec("TRUNCATE users CASCADE");
    jar.clear();
  });

  async function signedUp() {
    return (await createUser({ username: "linus", password: "kernel-1991", avatar: "panda" }))!;
  }

  it("sets an httpOnly, lax, site-wide cookie that lasts as long as the session", async () => {
    const user = await signedUp();
    await startSession(user.id);
    const cookie = jar.get(SESSION_COOKIE);
    expect(cookie?.options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
    expect(await getCurrentUser()).toEqual(user);
  });

  it("treats a missing or unknown cookie as signed out", async () => {
    expect(await getCurrentUser()).toBeNull();
    jar.set(SESSION_COOKIE, { value: "forged" });
    expect(await getCurrentUser()).toBeNull();
    await expect(requireUser()).rejects.toBeInstanceOf(GameError);
    await expect(requireUser()).rejects.toMatchObject({ status: 401 });
  });

  it("revokes the session row as well as the cookie on sign-out", async () => {
    const user = await signedUp();
    await startSession(user.id);
    const token = jar.get(SESSION_COOKIE)!.value;

    await endSession();
    expect(jar.has(SESSION_COOKIE)).toBe(false);
    // A copy of the old cookie no longer works.
    jar.set(SESSION_COOKIE, { value: token });
    expect(await getCurrentUser()).toBeNull();
  });

  it("signs out cleanly with no cookie at all", async () => {
    await expect(endSession()).resolves.toBeUndefined();
  });
});
