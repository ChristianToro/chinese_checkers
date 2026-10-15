import { createHash, randomBytes, randomUUID } from "node:crypto";
import { type Avatar, isAvatar } from "./avatars";
import { getDb } from "./db";
import type { PlayerProfile } from "./game/types";
import { hashPassword, verifyPassword } from "./password";

/** The narrow user shape (all that ever leaves the server): a game's player profile. */
export type User = PlayerProfile;

export interface SignupInput {
  username: string;
  password: string;
  avatar: Avatar;
}

export type SignupErrors = Partial<Record<keyof SignupInput, string>>;

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const USERNAME_PATTERN = /^[A-Za-z0-9_-]{3,20}$/;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

export function validateSignup(input: {
  username: unknown;
  password: unknown;
  avatar: unknown;
}): { ok: true; value: SignupInput } | { ok: false; errors: SignupErrors } {
  const errors: SignupErrors = {};
  const username = typeof input.username === "string" ? input.username.trim() : "";
  const password = typeof input.password === "string" ? input.password : "";

  if (!USERNAME_PATTERN.test(username)) {
    errors.username = "Use 3–20 letters, numbers, dashes or underscores";
  }
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    errors.password = `Use ${PASSWORD_MIN}–${PASSWORD_MAX} characters`;
  }
  if (!isAvatar(input.avatar)) {
    errors.avatar = "Pick an avatar";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { username, password, avatar: input.avatar as Avatar } };
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === "23505";
}

/** Creates the account, or returns null when the username is taken (in any case). */
export async function createUser(input: SignupInput): Promise<User | null> {
  const id = randomUUID();
  const passwordHash = await hashPassword(input.password);
  try {
    await getDb().query(
      `INSERT INTO users (id, username, password_hash, avatar, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, input.username, passwordHash, input.avatar, new Date().toISOString()],
    );
  } catch (err) {
    if (isUniqueViolation(err)) return null;
    throw err;
  }
  return { id, username: input.username, avatar: input.avatar };
}

// Checked against when the username doesn't exist, so a miss costs the same
// scrypt run as a hit and response timing doesn't reveal which names exist.
let dummyHash: Promise<string> | undefined;

export async function verifyCredentials(username: string, password: string): Promise<User | null> {
  const [row] = await getDb().query<User & { password_hash: string }>(
    "SELECT id, username, avatar, password_hash FROM users WHERE lower(username) = lower($1)",
    [username.trim()],
  );
  if (!row) {
    dummyHash ??= hashPassword("not-a-real-password");
    await verifyPassword(password, await dummyHash);
    return null;
  }
  if (!(await verifyPassword(password, row.password_hash))) return null;
  return { id: row.id, username: row.username, avatar: row.avatar };
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Starts a session and returns the raw token for the cookie; only its hash is stored. */
export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  await getDb().query(
    `INSERT INTO sessions (token_hash, user_id, expires_at, created_at)
     VALUES ($1, $2, $3, $4)`,
    [
      hashToken(token),
      userId,
      new Date(now + SESSION_TTL_MS).toISOString(),
      new Date(now).toISOString(),
    ],
  );
  return token;
}

// Expiry is compared with the database's now(), not `new Date()`: this runs
// while rendering, where Cache Components rejects reading the clock.
export async function findUserBySessionToken(token: string): Promise<User | null> {
  const [row] = await getDb().query<User>(
    `SELECT u.id, u.username, u.avatar
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashToken(token)],
  );
  return row ?? null;
}

export async function deleteSession(token: string): Promise<void> {
  await getDb().query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
}
