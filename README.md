# Chinese Checkers

A two-player Chinese Checkers demo built with Next.js 16. Each player signs in with their own account, games are played across two browsers, and every game is saved to both players' history.

Games and accounts are stored in [Neon](https://neon.com) serverless Postgres. (The `main` branch has the earlier no-login, hot-seat version of the app on a local SQLite file.)

## Accounts and game history

- **Sign up** on the `/login` page (**Get started** on the landing page) with a username, a password, and one of five avatars (`public/assets/avatars/`).
  - Usernames are 3–20 letters, numbers, `-` or `_`, and are unique regardless of case.
  - Passwords are 8–128 characters.
  - Returning players use the **Log in** tab. **Log out** is in the header.
- **Start a game** with **Open a new table** on the landing page, or **New Game** on a game page. You play Red.
- **Invite an opponent:** **Copy link** copies the game's path (`/games/<id>`), not a full URL, so it works wherever the app is served from (for example, a tunnel whose address changes each run). Put your site's address in front and send it. When they open it signed in, they click **Join as Blue**. Red moves first once both seats are filled.
- **Who can move:** each player can only move their own colour, on their own turn, from their own account. Anyone else signed in who opens the link can watch but not play.
- **History:** your games are listed under **Your games** on the landing page, newest first. Each row shows your opponent, your colour, the number of moves, the date, and the state: *Won*, *Lost*, *Your turn*, *Their turn* or *Waiting for opponent*.
- **Restart:** either player can restart an unfinished game. Finished games can't be restarted, so their result stays in both players' history.

You must be signed in to play. Opening a game link while signed out takes you to `/login` first, then back to the game.

## Look and feel

The app has one dark theme, styled after a board game café at night: espresso and walnut surfaces, cream text, brass accents, and boards set on green felt. Headings use Fraunces, and body text uses Geist. The colours are Tailwind theme tokens in `app/globals.css` (`ink`, `surface`, `raised`, `line`, `cream`, `muted`, `brass`, `felt`).

The landing page's hero is a scripted **six-player** game on a loop, with 60 marbles to match the headline. Real games are two-player. The "Follow every move" table under it logs the same scripted moves as they happen, and the "Take a seat" card fills in a log in form on its own loop; hovering it shows **Get started**. The script is built once from the real move search (`reachableFrom` in `lib/game/rules.ts`) with a fixed seed, so every visitor sees the same game. With `prefers-reduced-motion`, the hero and the table show a still mid-game frame, and the log in card shows its finished state.

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
npm test           # rules, demo script, auth, repositories, API routes, and proxy (Vitest, in-memory PGlite; no Neon needed)
npm run typecheck
npm run lint
```

**Neon compute and polling.** An open game tab polls every 2 s, which keeps the Neon compute awake. About 5 minutes after the last tab closes, Neon scales to zero, so the next request has a short cold start.

## Querying the database

`npm run sql` sends one SQL statement to the database in `DATABASE_URL` (from `.env`) through the same Neon HTTP driver the app uses, and prints the rows as a table. No `psql` is needed.

```bash
npm run sql -- 'SELECT id, status, move_count FROM games ORDER BY updated_at DESC LIMIT 10'
```

- **Everything after `--` goes to the script.** The statement comes first, then its parameters, which fill `$1`, `$2`, ... in order.
- **Quote the statement with single quotes** so the shell leaves `$1` alone. SQL string literals also use single quotes, so pass values as parameters instead of writing them inline. A statement with no `$` can use double quotes on the outside, as in the list of tables below.
- **One statement per call.** The HTTP driver doesn't accept several statements separated by `;`.
- **`--json` prints the rows as JSON** instead of a table. Use it for JSONB columns (`games.board`, `moves.path`), which don't fit in a table cell.
- **The last line is the command and its row count** (`SELECT 10`, `DELETE 3`). It goes to stderr, so `--json` output can be piped on its own.

Some useful queries:

```bash
# The tables in the database
npm run sql -- "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"

# Columns of one table
npm run sql -- 'SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position' games

# Games by status
npm run sql -- 'SELECT status, count(*) FROM games GROUP BY status'

# Accounts (leave out password_hash)
npm run sql -- 'SELECT id, username, avatar, created_at FROM users ORDER BY created_at'

# One player's games, with both seats by username (matched regardless of case)
npm run sql -- 'SELECT g.id, g.status, g.winner, g.move_count, r.username AS red, b.username AS blue FROM games g LEFT JOIN users r ON r.id = g.red_user_id LEFT JOIN users b ON b.id = g.blue_user_id WHERE lower(r.username) = lower($1) OR lower(b.username) = lower($1) ORDER BY g.updated_at DESC' alice

# Games still waiting for a second player
npm run sql -- 'SELECT g.id, r.username AS red, g.created_at FROM games g LEFT JOIN users r ON r.id = g.red_user_id WHERE g.blue_user_id IS NULL ORDER BY g.created_at DESC'

# A game's move history. Replace GAME_ID with the id at the end of the game's URL,
# e.g. /games/b21a35f3c1 → b21a35f3c1
npm run sql -- 'SELECT move_number, player, from_cell, to_cell, kind, created_at FROM moves WHERE game_id = $1 ORDER BY move_number' GAME_ID

# A game's board, as JSON
npm run sql -- --json 'SELECT board, current_player, status FROM games WHERE id = $1' GAME_ID

# Signed-in sessions that haven't expired (leave out token_hash)
npm run sql -- 'SELECT u.username, s.created_at, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.expires_at > now() ORDER BY s.expires_at DESC'

# Clean up expired sessions
npm run sql -- 'DELETE FROM sessions WHERE expires_at < now()'
```

This is the live database, so take care with writes. Deleting a game also deletes its moves, and deleting a user also deletes their sessions (`ON DELETE CASCADE`). A user who still holds a seat in a game can't be deleted until that seat is cleared.

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
| Command-line scripts: apply the schema (`npm run db:migrate`), run one SQL statement (`npm run sql`) | `scripts/` |
| Games: create, join, get, reset, per-user history, and moves as one guarded SQL write | `lib/games-repo.ts` |
| Accounts: signup validation, credential checks, database sessions | `lib/users-repo.ts`, `lib/password.ts` |
| Session cookie, current user, `requireUser()` for API routes | `lib/session.ts` |
| Sign up, log in, and log out (Server Actions) | `app/actions/auth.ts` |
| Sends signed-out visitors on `/games/*` to sign in | `proxy.ts` |
| API route handlers | `app/api/games/**/route.ts` |
| Board art shared by the game and the hero: geometry, six-colour marble palette, star, holes, marbles | `components/board-art.tsx` |
| Theme class strings (cards, buttons, inputs) and the site header | `components/ui.ts`, `components/SiteHeader.tsx` |
| Scripted six-player demo game for the landing page (pure, tested) | `lib/demo/script.ts` |
| Landing hero and play flow: playback clock, animated board, invite example, move tracker | `components/landing/` |
| Game UI: auth form, game history, players card, SVG board, turn indicator, move history, polling | `components/` |

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
