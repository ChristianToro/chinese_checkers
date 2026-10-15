import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { setDb } from "@/lib/db";
import { createUser } from "@/lib/users-repo";
import { login, logout, signup } from "./auth";

// Cookies and redirects belong to the Next request; stand in for both.
const session = vi.hoisted(() => ({ startSession: vi.fn(), endSession: vi.fn() }));
vi.mock("@/lib/session", () => session);

class Redirect extends Error {
  constructor(public readonly to: string) {
    super(`redirect ${to}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Redirect(to);
  },
}));

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

async function redirectOf(promise: Promise<unknown>): Promise<string> {
  const err = await promise.catch((e: unknown) => e);
  expect(err).toBeInstanceOf(Redirect);
  return (err as Redirect).to;
}

const schema = fs.readFileSync(new URL("../../db/schema.sql", import.meta.url), "utf8");

describe("auth actions", () => {
  let pg: PGlite;

  beforeAll(async () => {
    pg = new PGlite();
    await pg.exec(schema);
    setDb({ query: async (text, params) => (await pg.query(text, params)).rows as never });
  });

  beforeEach(async () => {
    await pg.exec("TRUNCATE users CASCADE");
    vi.clearAllMocks();
  });

  const grace = { username: "grace", password: "cobol1959", avatar: "turtle" };

  it("signs up, starts a session, and returns to `next`", async () => {
    const to = await redirectOf(signup({}, form({ ...grace, next: "/games/abc" })));
    expect(to).toBe("/games/abc");
    const { rows } = await pg.query<{ id: string }>("SELECT id FROM users");
    expect(session.startSession).toHaveBeenCalledWith(rows[0].id);
  });

  it("refuses an off-site `next`", async () => {
    expect(await redirectOf(signup({}, form({ ...grace, next: "//evil.example" })))).toBe("/");
  });

  it("returns field errors and echoes the input without starting a session", async () => {
    const state = await signup({}, form({ username: "g", password: "short", avatar: "turtle" }));
    expect(state.errors).toMatchObject({ username: expect.any(String), password: expect.any(String) });
    expect(state.values).toEqual({ username: "g", avatar: "turtle" });
    expect(session.startSession).not.toHaveBeenCalled();
  });

  it("reports a taken username", async () => {
    await createUser({ username: "Grace", password: "whatever1", avatar: "panda" });
    const state = await signup({}, form(grace));
    expect(state.errors?.username).toBe("That username is taken");
  });

  it("logs in with the right password only", async () => {
    const user = await createUser({ username: "Grace", password: "cobol1959", avatar: "panda" });
    expect(await login({}, form({ username: "grace", password: "nope-nope" }))).toMatchObject({
      message: "Wrong username or password",
    });
    expect(await login({}, form({ username: "nobody", password: "cobol1959" }))).toMatchObject({
      message: "Wrong username or password",
    });
    expect(session.startSession).not.toHaveBeenCalled();

    expect(await redirectOf(login({}, form({ username: "grace", password: "cobol1959" })))).toBe("/");
    expect(session.startSession).toHaveBeenCalledWith(user!.id);
  });

  it("logs out and returns home", async () => {
    expect(await redirectOf(logout())).toBe("/");
    expect(session.endSession).toHaveBeenCalled();
  });
});
