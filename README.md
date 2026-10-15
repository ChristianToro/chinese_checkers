# Chinese Checkers

A two-player Chinese Checkers demo built with Next.js 16. No login. Play hot-seat on one screen, or share the game link and play from two browsers.

Games are stored in [Neon](https://neon.com) serverless Postgres. (The `main` branch has the same app on a local SQLite file.)

## Setup

1. **Create a database.** This makes a temporary Neon database without an account and writes its pooled `DATABASE_URL` to `.env`:
   ```bash
   npm install
   npx neonctl claim create --file .env
   ```
   Or create a project in the Neon Console and copy `.env.example` to `.env` with its connection string.
2. **Create the tables.** `npm run db:migrate` applies `db/schema.sql`. It is idempotent, so it's safe to re-run.
3. **Run it.** `npm run dev`, then open http://localhost:3000.
4. **Claim the database within 72 hours,** or it is deleted. Until it's claimed it is capped at 100 MB of storage and 1 GB of transfer.
   1. Run `npx neonctl claim accept`. It opens the claim page (add `--no-open` to just print the URL).
   2. Sign in and take the project into a free Neon account.
   3. Claiming revokes the old password. Copy the new connection string from the Neon Console into `DATABASE_URL` in `.env`, then restart `npm run dev`.

```bash
npm test           # rules engine + repository tests (Vitest, in-memory PGlite; no Neon needed)
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
| Postgres schema (`games`, `moves`), applied by `npm run db:migrate` | `db/schema.sql` |
| Query seam over the Neon HTTP driver (swapped for PGlite in tests) | `lib/db.ts` |
| Game sessions: create/get/reset, move submission as one guarded SQL write | `lib/games-repo.ts` |
| API route handlers | `app/api/games/**/route.ts` |
| UI: SVG board, turn indicator, move history, polling | `components/` |

The client uses the shared rules only to highlight destinations. The server re-validates every move: turn order, marble ownership, legality, and an optional `expectedMoveCount` concurrency check. The write itself only applies if the game's `move_count` hasn't changed since it was read, so when two moves race, one gets a `409`.

## API

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/games` | Start a new game → `201 { game }` |
| GET | `/api/games/:id` | Board, turn, status → `{ game }` |
| POST | `/api/games/:id/moves` | Body `{ from, to, player?, expectedMoveCount? }` → `{ game, move }` |
| GET | `/api/games/:id/moves` | Move history → `{ moves }` |
| POST | `/api/games/:id/reset` | Restart the same game id → `{ game }` |

Errors come back as `{ error }`: `400` for an illegal move or a bad body, `404` for an unknown game, and `409` for the wrong turn, a finished game, or a stale `expectedMoveCount`.

Cells are axial keys like `"1,-5"`. The UI and move history show them as `row-col`, with row 1–17 counted top to bottom.
