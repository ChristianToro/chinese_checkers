# Plan: User accounts (username + password + avatar) and game history

## Context
Games now live in Neon. Right now anyone with a link can play either colour: the seat picker in `components/GameClient.tsx` is only a per-tab convenience. The goal is to **track game history per user**. To do that:
- People create accounts with a username, a password, and an avatar from `public/assets/avatars/`.
- Each game records which account holds Red and which holds Blue.
- The server, not the browser, decides who may move.

Decisions confirmed with the user (2026-10-15):

| Decision | Choice |
|---|---|
| Game ↔ users | Two players claim seats. The creator takes Red. A second signed-in user opens the share link and clicks **Join as Blue**. Only the account holding the seat to move may move |
| Signed-out visitors | Must sign in to play. The landing page shows only the auth form plus the rules. A game link sends them to `/?next=/games/<id>` and back after auth |
| Auth flows | Create account, log in, and log out |

Choices made in the plan without asking. Each one has a conventional default:
- **Passwords:** `node:crypto` scrypt with a per-user salt. No bcrypt dependency.
- **Sessions:** database sessions. The cookie holds a random token, and the `sessions` table stores only its SHA-256 hash, so it can be revoked on logout. No `SESSION_SECRET` env var is needed.
- **Auth forms:** Server Actions with `useActionState`, as `node_modules/next/dist/docs/01-app/02-guides/authentication.md` recommends.
- **Game APIs:** stay route handlers, which read the session cookie.
- **Validation:** hand-written, matching `parseMoveInput`. No zod.
- **History:** a "Your games" list on the signed-in landing page. There is no separate `/history` route.

**Behaviour change to flag:** hot-seat play (both colours on one screen) goes away. Every game needs two accounts. The "This tab plays as" seat picker and the sessionStorage `useSeat` hook are removed, because a player's seat now comes from their account.

## Execution protocol (user's instruction)
- **Each step below is one milestone.** After finishing a step, stop, summarize what changed and how it was checked, and wait for the user's review.
- **Commits:** once the user approves a milestone, commit it on `feature/authentication`, then start the next step. Never begin the next step before that commit. Never push; the user pushes.
- **Edits are approved manually** by the user.

## Step 0: Housekeeping (milestone 0)
- Write this plan to `PLAN-AUTH.md` at the repo root, following the `PLAN-NEON.md` precedent.
- Invoke the `prompt-history` skill. Log this session in `PROMPT-HISTORY.md`, in the same format as earlier sessions, and keep it updated at each milestone.

## Step 1: Schema (`db/schema.sql`, still idempotent)
Append the following, then run `npm run db:migrate` against Neon. `scripts/migrate.mjs` splits on `;`, so every statement must be separate and contain no `;` inside it.
```sql
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  avatar        TEXT NOT NULL CHECK (avatar IN ('panda','rabbit','red_panda','tiger','turtle')),
  created_at    TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_key ON users (lower(username));

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE games ADD COLUMN IF NOT EXISTS red_user_id  TEXT REFERENCES users(id);
ALTER TABLE games ADD COLUMN IF NOT EXISTS blue_user_id TEXT REFERENCES users(id);
CREATE INDEX IF NOT EXISTS games_red_user_idx  ON games (red_user_id);
CREATE INDEX IF NOT EXISTS games_blue_user_idx ON games (blue_user_id);
```
- **The seat columns are nullable.** The few existing games in Neon have no owners. That's fine, because the join rule is "fill an empty seat": the first visitor claims Red and the second claims Blue. No special case is needed.
- **One account can't hold both seats.** `joinGame` enforces this in SQL.

## Step 2: Auth core (pure DB code, testable with PGlite)
**`lib/avatars.ts`**
- `AVATARS = ["panda","rabbit","red_panda","tiger","turtle"] as const`, plus `type Avatar`.
- `isAvatar()`.
- `avatarSrc(a)` returns `/assets/avatars/avatar_${a}.png`. The images are 512×512 PNGs.
- Labels, for example "Red panda".

**`lib/password.ts`**
- `hashPassword(pw)` stores `scrypt$<saltB64>$<hashB64>`, using `crypto.scrypt` with a 16-byte salt and a 64-byte key.
- `verifyPassword(pw, stored)` compares with `timingSafeEqual`.

**`lib/users-repo.ts`** (uses `getDb()` from `lib/db.ts`, the same seam as `games-repo`)
- `type User = { id, username, avatar }`. This narrow shape is all that ever reaches the client.
- **`validateSignup({ username, password, avatar })`** returns field errors. The rules:
  - Username: 3–20 chars, `[A-Za-z0-9_-]`, trimmed.
  - Password: 8–128 chars.
  - Avatar: must be a member of `AVATARS`.
- **`createUser(input)`** inserts the user. It catches Postgres unique violation `23505` and returns `{ error: "taken" }`.
- **`verifyCredentials(username, password)`** looks the user up with `lower(username)` and returns `User | null`. When the user doesn't exist, it still runs a dummy scrypt, so timing doesn't reveal which usernames exist.
- **`createSession(userId)`** returns the raw token. The token is 32 random bytes in base64url. The table stores its sha256 hash, with a 30-day expiry.
- **`findUserBySessionToken(token)`** joins `sessions` to `users` and returns the user, or `null` if the session is expired or missing.
- **`deleteSession(token)`**.

## Step 3: Session glue and route protection
**`lib/session.ts`** (`import "server-only"`; Next bundles it)
- Cookie name: `cc_session`. Options: `httpOnly`, `sameSite: "lax"`, `secure` in production, `path: "/"`, `maxAge` 30 days.
- `setSessionCookie(token)` and `clearSessionCookie()`. Per `cookies.md`, these are callable only from Server Actions or Route Handlers.
- **`getCurrentUser()`** reads the cookie and calls `findUserBySessionToken`. It's wrapped in React `cache()` so each request looks the session up once.
- **`requireUser()`** is for route handlers. It throws `GameError(401, "Sign in to play")`.

**`proxy.ts`** (an optimistic check)
- Matcher: `/games/:path*`.
- If there is no `cc_session` cookie, it redirects to `/?next=<pathname>`.
- The real check still happens in the page.

**Next.js rule (cacheComponents is on):** every component that reads the session sits behind `<Suspense>`. This is the "Authentication with Cache Components" guide.

## Step 4: Server Actions (`app/actions/auth.ts`, `"use server"`)
- **`signup(prev, formData)`:**
  1. Validate the fields.
  2. Call `createUser`. On a taken username, return `{ errors: { username: ["That username is taken"] } }`.
  3. Call `createSession`, then `setSessionCookie`.
  4. Call `redirect(safeNext(formData.get("next")))`.
- **`login(prev, formData)`:** calls `verifyCredentials`. On failure, it returns one generic message, "Wrong username or password". On success, it creates a session, sets the cookie, and redirects.
- **`logout()`:** deletes the session row, clears the cookie, then calls `redirect("/")`.
- **`safeNext`** accepts only paths that start with `/` and not `//`. Anything else becomes `/`.
- **`redirect()` placement:** it's called outside any `try`, as `redirect.md` requires.

## Step 5: Games, now player-aware (`lib/games-repo.ts`, `lib/game/types.ts`)
**Types (`lib/game/types.ts`)**
- Add `PlayerProfile = { id, username, avatar }`.
- `Game` gains `red: PlayerProfile | null` and `blue: PlayerProfile | null`.

**Reads**
- Every read goes through one SQL helper. It selects `games.*` and `LEFT JOIN`s `users` twice, aliased as `red_username`, `red_avatar`, and so on. `toGame` maps these columns.
- The write statements already use `… RETURNING *` inside CTEs. They change from `SELECT * FROM upd` to the same join over `upd`, so every write returns the player profiles too.

**Writes**
- **`GameError` status union:** add `401 | 403`. `lib/http.ts` maps them unchanged.
- **`createGame(userId)`:** sets `red_user_id = userId`.
- **`joinGame(id, userId)` (new):** one guarded statement:
  ```sql
  UPDATE games SET
    red_user_id  = COALESCE(red_user_id, $2),
    blue_user_id = CASE WHEN red_user_id IS NOT NULL AND blue_user_id IS NULL THEN $2 ELSE blue_user_id END,
    updated_at = $3
  WHERE id = $1 AND (red_user_id IS NULL OR blue_user_id IS NULL)
    AND red_user_id IS DISTINCT FROM $2 AND blue_user_id IS DISTINCT FROM $2
  RETURNING *
  ```
  - 0 rows means one of three things: 404 (the game is missing), 409 (both seats are already taken), or a no-op (you're already seated). Re-read the game to tell which.
  - The statement bumps `updated_at`, so the opponent's 2-second poll picks up the new player.
- **`submitMove(id, userId, input)`:**
  - The `player` input is dropped, because the server derives the seat from `userId`.
  - New checks, run before the existing ones:
    - Both seats must be filled. Otherwise 409, "Waiting for an opponent to join".
    - The user must hold the seat whose turn it is. A non-player gets 403. The wrong player gets 409, "It's red's turn".
  - `expectedMoveCount` and the guarded CTE write stay exactly as they are.
- **`resetGame(id, userId)`:** only a seated player may reset (403 otherwise). It's only allowed while `status = 'active'`, so finished games stay in the history (409 "This game is finished; start a new one").
- **`listGamesForUser(userId, limit = 20)` (new):** returns the user's games, newest `updated_at` first. Each entry has the `Game` (with profiles), plus `myColor`.

## Step 6: API routes (`app/api/games/**`)
- **Every handler** calls `requireUser()` first, inside `handle()`.
- **`POST /api/games`:** calls `createGame(user.id)`.
- **`POST /api/games/[id]/join` (new):** calls `joinGame`.
- **`POST /api/games/[id]/moves`:** passes `user.id`, and stops forwarding `player`.
- **`POST /api/games/[id]/reset`:** passes `user.id`.
- **`lib/api-client.ts`:**
  - Add `joinGame`.
  - Remove `player` from `SubmitMoveBody`.

## Step 7: UI
**Landing page, `app/page.tsx`**
- The title and rules stay static, so they're prerendered.
- `<Suspense>` wraps a new server component, `HomePanel`, which calls `getCurrentUser()`:
  - **Signed out:** `components/AuthForm.tsx`, a client component. It has:
    - Tabs: **Create account** / **Log in**, each using `useActionState`.
    - An avatar picker: a radio group of 5 `next/image` tiles. It's keyboard-accessible, with visible selection and a default of `panda`.
    - A hidden `next` input. `HomePanel` reads `searchParams`, which is also behind the Suspense.
  - **Signed in:**
    - A greeting showing the avatar and username.
    - `NewGameButton`.
    - `components/GameHistory.tsx`, which shows the user's games, each linking to `/games/<id>`. A row shows:
      - the opponent's avatar and name, or "Waiting for opponent";
      - your colour dot;
      - the result: Won, Lost, Your turn, or Their turn;
      - the move count and date.
- Change the copy "No sign-up needed" and the `layout.tsx` metadata "No login required".

**Header user menu: `components/UserMenu.tsx`**
- Shows the avatar, the username, and a **Log out** button, which is a form with `action={logout}`.
- Used in the landing page's top bar and the game page header, each behind its own `<Suspense>`.

**Game page, `app/games/[id]/page.tsx`**
- `LoadedGame` calls `getCurrentUser()`. With no user, it calls `redirect('/?next=/games/<id>')`.
- It passes `viewer` to `GameClient`.

**`components/GameClient.tsx`**
- Remove `useSeat`, `SEATS`, and the seat fieldset.
- `mySeat` is derived from the game: `"red"`, `"blue"`, or `null` for a spectator.
- `canMove` requires `mySeat === player`, and both seats must be filled.
- **A new "Players" card** shows both players' avatars and names, and marks whose turn it is. When a seat is open and the viewer isn't seated, it shows a **Join as Blue** (or Red) button. When the viewer is the creator, it shows "Share the link with your opponent" next to Copy link.
- **Restart** is hidden unless the viewer is seated and the game is active.
- **Polling:** `updatedAt` polling is unchanged and already covers joins.

**`components/TurnIndicator.tsx`**
- It takes `mySeat` instead of `Seat`.
- The winner banner shows the winner's username.

## Step 8: Tests (vitest + PGlite, same harness as `lib/games-repo.test.ts`)
- **Harness:** `TRUNCATE games, users CASCADE` in `beforeEach`. Add a helper that creates two users.
- **`lib/password.test.ts`:**
  - Hashing then verifying round-trips.
  - A wrong password fails.
  - The same password gives two different hashes, because of the salt.
- **`lib/users-repo.test.ts`:**
  - Signup validation rules.
  - Duplicate usernames are rejected case-insensitively.
  - Credential checks: right and wrong password, and an unknown user.
  - The session lifecycle: create, then look up, then delete, after which the lookup returns null. An expired session also returns null.
- **`lib/games-repo.test.ts`** (update the existing tests to pass user ids, and add):
  - `joinGame`: fills Blue; a third user gets 409; the creator can't take both seats; it bumps `updatedAt`.
  - `submitMove`: 409 before Blue joins; 403 for a non-player; 409 for the wrong player; the existing concurrency test still passes.
  - `resetGame`: 403 for a non-player; 409 on a finished game.
  - `listGamesForUser`: returns the games for both seats with the right `myColor`, newest first.

## Verification
1. `npm run db:migrate` runs against Neon. Running it a second time is a no-op, which shows it's idempotent.
2. `npm test`, `npm run typecheck`, and `npm run lint` all pass.
3. Run the `npm run dev` + two-browser-context walkthrough with the scratchpad `playwright-core` driver, as in the Neon milestone:
   1. Signed out, `/` shows the auth form. `/games/x` redirects to `/?next=/games/x`.
   2. User A creates an account with the tiger avatar. The `cc_session` cookie is httpOnly. A creates a game and copies the link.
   3. User B opens the link. B lands on sign-up with `next` set, creates an account, returns to the game, and clicks Join as Blue. A's tab shows B within about 2 s.
   4. A moves, then B moves. Each tab can select only its own marbles on its own turn. A 3rd account sees a read-only view and no Join button.
   5. Log out, then log back in as A. The landing page's history lists the game against B.
   6. A duplicate username in a different case shows "taken". A wrong password shows the generic error.
4. A `neon()` query shows rows in `users` and `sessions`, with hashed tokens and no plaintext passwords, and shows `games.red_user_id` / `blue_user_id` set.

## Out of scope (possible follow-ups)
- A rematch button
- Password change or reset
- Rate-limiting login attempts
- Win/loss stats beyond the list
- Deploying with `secure` cookies on a real host
