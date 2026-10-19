# Chinese Checkers

A two-player Chinese Checkers demo built with Next.js 16. Each player signs in with their own account, games are played across two browsers, and every game is saved to both players' history.

Games and accounts are stored in [Neon](https://neon.com) serverless Postgres. (The `main` branch has the earlier no-login, hot-seat version of the app on a local SQLite file.)

## Accounts and game history

- **Sign up** on the landing page with a username, a password, and one of five avatars (`public/assets/avatars/`).
  - Usernames are 3–20 letters, numbers, `-` or `_`, and are unique regardless of case.
  - Passwords are 8–128 characters.
  - Returning players use the **Log in** tab. **Log out** is in the header.
- **Start a game** with **New Game**. You play Red.
- **Invite an opponent:** send them the link from **Copy link**. When they open it signed in, they click **Join as Blue**. Red moves first once both seats are filled.
- **Who can move:** each player can only move their own colour, on their own turn, from their own account. Anyone else signed in who opens the link can watch but not play.
- **History:** your games are listed under **Your games** on the landing page, newest first. Each row shows your opponent, your colour, the number of moves, the date, and the state: *Won*, *Lost*, *Your turn*, *Their turn* or *Waiting for opponent*.
- **Restart:** either player can restart an unfinished game. Finished games can't be restarted, so their result stays in both players' history.

You must be signed in to play. Opening a game link while signed out takes you to sign in first, then back to the game.

## Setup

1. **Create a database.** This makes a temporary Neon database without an account and writes its pooled `DATABASE_URL` to `.env`:
   ```bash
   npm install
   npx neonctl claim create --file .env
   ```
   Or create a project in the Neon Console and copy `.env.example` to `.env` with its connection string.
2. **Create the tables.** `npm run db:migrate` applies `db/schema.sql`. It is idempotent, so it's safe to re-run. Re-run it after pulling this version into an existing database: it adds the `users` and `sessions` tables and the games' seat columns.
3. **Run it.** `npm run dev`, then open http://localhost:3000.
4. **Claim the database within 72 hours,** or it is deleted. Until it's claimed it is capped at 100 MB of storage and 1 GB of transfer.
   1. Run `npx neonctl claim accept`. It opens the claim page (add `--no-open` to just print the URL).
   2. Sign in and take the project into a free Neon account.
   3. Claiming revokes the old password. Copy the new connection string from the Neon Console into `DATABASE_URL` in `.env`, then restart `npm run dev`.

```bash
npm test           # rules, auth, repositories, API routes, and proxy (Vitest, in-memory PGlite; no Neon needed)
npm run typecheck
npm run lint
```

**Neon compute and polling.** An open game tab polls every 2 s, which keeps the Neon compute awake. About 5 minutes after the last tab closes, Neon scales to zero, so the next request has a short cold start.

## Rules implemented

- 121-hole star. Red starts in the top point and Blue in the bottom point, 10 marbles each. Red moves first.
- A turn is either one **step** to an adjacent empty hole, or a **chain of hops** over adjacent marbles of either colour into the empty hole directly beyond. The chain can change direction and stop after any hop.
- A marble that has reached its target triangle can't leave it.
- You win when every hole of the opposite triangle is filled and at least one marble there is yours. Normally that means all 10 of yours. The "at least one" clause is the standard anti-spoiling rule, so an opponent can't block you by never leaving home.
- If the next player has no legal move, the turn passes back.

## Architecture

| Layer | Where |
|---|---|
| Board geometry (axial hex coords, homes/targets, layout) | `lib/game/board.ts` |
| Pure rules: legal moves, apply, win, turn order (shared by client and server) | `lib/game/rules.ts` |
| Postgres schema (`games`, `moves`, `users`, `sessions`), applied by `npm run db:migrate` | `db/schema.sql` |
| Query seam over the Neon HTTP driver (swapped for PGlite in tests) | `lib/db.ts` |
| Games: create, join, get, reset, per-user history, and moves as one guarded SQL write | `lib/games-repo.ts` |
| Accounts: signup validation, credential checks, database sessions | `lib/users-repo.ts`, `lib/password.ts` |
| Session cookie, current user, `requireUser()` for API routes | `lib/session.ts` |
| Sign up, log in, and log out (Server Actions) | `app/actions/auth.ts` |
| Sends signed-out visitors on `/games/*` to sign in | `proxy.ts` |
| API route handlers | `app/api/games/**/route.ts` |
| UI: auth form, game history, players card, SVG board, turn indicator, move history, polling | `components/` |

The client uses the shared rules only to highlight destinations. The server re-validates every move. It checks:
- that the mover holds a seat in the game, taken from the session rather than the request body;
- that both seats are filled;
- turn order, marble ownership and legality;
- an optional `expectedMoveCount` concurrency check.

The write itself only applies if the game's `move_count` hasn't changed since it was read, so when two moves race, one gets a `409`.

**Authentication.**
- **Passwords** are hashed with scrypt (`node:crypto`), with a random salt per password.
- **Signing in** creates a row in `sessions` and sets an `httpOnly`, `SameSite=Lax` cookie, `cc_session`, which lasts 30 days. The cookie is HTTPS-only in production. It holds a random token; the database stores only the token's SHA-256, so a leaked database can't be replayed as cookies.
- **Logging out** deletes the session row.
- **`proxy.ts`** only checks that the cookie exists. Pages and API routes look the session up in the database.

## API

Every endpoint requires a signed-in session (the `cc_session` cookie). Each `game` includes `red` and `blue` players as `{ id, username, avatar }`, or `null` for an open seat.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/games` | Start a new game with you as Red → `201 { game }` |
| GET | `/api/games/:id` | Board, turn, status, players → `{ game }` |
| POST | `/api/games/:id/join` | Take the open seat → `{ game }` |
| POST | `/api/games/:id/moves` | Body `{ from, to, expectedMoveCount? }` → `{ game, move }` |
| GET | `/api/games/:id/moves` | Move history → `{ moves }` |
| POST | `/api/games/:id/reset` | Restart an unfinished game (players only) → `{ game }` |

Errors come back as `{ error }`:

| Status | When |
|---|---|
| `400` | An illegal move or a bad body |
| `401` | No valid session |
| `403` | Moving in, or restarting, a game you're not playing |
| `404` | An unknown game |
| `409` | The wrong turn, waiting for an opponent, both seats already taken, a finished game, or a stale `expectedMoveCount` |

Cells are axial keys like `"1,-5"`. The UI and move history show them as `row-col`, with row 1–17 counted top to bottom.
