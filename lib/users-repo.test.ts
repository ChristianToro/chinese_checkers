import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setDb } from "./db";
import {
  createSession,
  createUser,
  deleteSession,
  findUserBySessionToken,
  validateSignup,
  verifyCredentials,
} from "./users-repo";

const schema = fs.readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");

describe("validateSignup", () => {
  const valid = { username: "  ada_99 ", password: "longenough", avatar: "tiger" };

  it("accepts and trims a valid signup", () => {
    expect(validateSignup(valid)).toEqual({
      ok: true,
      value: { username: "ada_99", password: "longenough", avatar: "tiger" },
    });
  });

  it("reports each bad field", () => {
    const result = validateSignup({ username: "a!", password: "short", avatar: "dragon" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["avatar", "password", "username"]);
  });

  it("enforces username and password length bounds", () => {
    expect(validateSignup({ ...valid, username: "ab" }).ok).toBe(false);
    expect(validateSignup({ ...valid, username: "a".repeat(21) }).ok).toBe(false);
    expect(validateSignup({ ...valid, password: "x".repeat(129) }).ok).toBe(false);
    expect(validateSignup({ ...valid, password: undefined }).ok).toBe(false);
  });
});

describe("users repository", () => {
  let pg: PGlite;

  beforeAll(async () => {
    pg = new PGlite();
    await pg.exec(schema);
    setDb({ query: async (text, params) => (await pg.query(text, params)).rows as never });
  });

  beforeEach(async () => {
    await pg.exec("TRUNCATE users CASCADE");
  });

  const ada = { username: "Ada", password: "analytical", avatar: "panda" } as const;

  it("creates a user and rejects the same name in any case", async () => {
    const user = await createUser(ada);
    expect(user).toMatchObject({ username: "Ada", avatar: "panda" });
    expect(await createUser({ ...ada, username: "ada" })).toBeNull();
  });

  it("never stores the plaintext password", async () => {
    await createUser(ada);
    const { rows } = await pg.query<{ password_hash: string }>("SELECT password_hash FROM users");
    expect(rows[0].password_hash).not.toContain("analytical");
  });

  it("checks credentials case-insensitively by username", async () => {
    const user = await createUser(ada);
    expect(await verifyCredentials("ADA", "analytical")).toEqual(user);
    expect(await verifyCredentials("Ada", "wrong-password")).toBeNull();
    expect(await verifyCredentials("nobody", "analytical")).toBeNull();
  });

  it("runs a session through create, look up, and delete", async () => {
    const user = await createUser(ada);
    const token = await createSession(user!.id);
    expect(await findUserBySessionToken(token)).toEqual(user);
    expect(await findUserBySessionToken("not-a-token")).toBeNull();

    const { rows } = await pg.query<{ token_hash: string }>("SELECT token_hash FROM sessions");
    expect(rows[0].token_hash).not.toBe(token);

    await deleteSession(token);
    expect(await findUserBySessionToken(token)).toBeNull();
  });

  it("ignores expired sessions", async () => {
    const user = await createUser(ada);
    const token = await createSession(user!.id);
    await pg.exec("UPDATE sessions SET expires_at = now() - interval '1 second'");
    expect(await findUserBySessionToken(token)).toBeNull();
  });
});
