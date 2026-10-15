import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { GameError } from "./games-repo";
import {
  SESSION_TTL_MS,
  type User,
  createSession,
  deleteSession,
  findUserBySessionToken,
} from "./users-repo";

/** proxy.ts repeats this name: Proxy shouldn't share modules with the app. */
export const SESSION_COOKIE = "cc_session";

/**
 * Starts a session for the user and sets its cookie. Cookies can only be
 * written from a Server Action or Route Handler, never while rendering.
 */
export async function startSession(userId: string): Promise<void> {
  const token = await createSession(userId);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

/** Revokes the current session (if any) and clears its cookie. */
export async function endSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(token);
  store.delete(SESSION_COOKIE);
}

/**
 * The signed-in user, or null. Reads the request, so with Cache Components any
 * component calling this must sit behind a <Suspense> boundary. `cache` makes
 * repeat calls within one render share a single session lookup.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? findUserBySessionToken(token) : null;
});

/** For route handlers: the signed-in user, or a 401 via `handle()`. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new GameError(401, "Sign in to play");
  return user;
}
