# Plan: Neon (serverless Postgres) storage variant

> [!CAUTION]
> **The temporary Neon database expires at 2026-10-18 20:57:42 UTC.** Project `spring-frog-99908215` was created on 2026-10-15 with `npx neonctl claim create` and has not been claimed. Neon deletes it, with all its games, at that time. It is in use until 2026-10-17. To keep it, run `npx neonctl claim accept` before it expires. Claiming rotates the password, so then copy the new `DATABASE_URL` from the Neon Console into `.env` and restart `npm run dev`. To let it lapse, create a fresh one with `npx neonctl claim create --file .env`, then run `npm run db:migrate`.

## Context
The app as built matches `PLAN.md` and stores games in SQLite via `better-sqlite3`. This plan swaps that storage for **Neon** on a separate **`neon` branch**. That branch runs locally (`npm run dev`) against a real Neon database. `main` keeps the working SQLite app. `PLAN.md` stays frozen as the SQLite design snapshot.

All persistence goes through one layer: `lib/db.ts` and `lib/games-repo.ts`. The rules engine (`lib/game/**`), the client components, and the API response shapes don't change.

## Decisions (confirmed with the user, 2026-10-15)
| Decision | Choice |
|---|---|
| Hosting | Local only for now. **GitHub Pages can't host this app.** It serves static files only, so there are no route handlers to validate moves. Going straight to Neon from the browser would expose the database credentials to every visitor. A Node host (e.g. Vercel, deploying from GitHub) can be added later with no code changes |
| SQLite | Replaced outright on the `neon` branch. `main` keeps it |
| Git | The SQLite baseline is committed on `main`. The Neon work goes on branch `neon`, which **is not merged** into `main` |
| Query layer | Raw parameterized SQL through the `@neondatabase/serverless` HTTP driver (`neon()` + `sql.query(text, params)`). No ORM |
| Concurrency | One guarded SQL statement per write. No WebSocket `Pool` and no interactive transactions |
| Tests | PGlite (`@electric-sql/pglite`), in-memory Postgres, injected through a small `query` seam |
| Schema | One idempotent `db/schema.sql`, shared by `npm run db:migrate` and the test setup |
| Provisioning | Instant claimable Neon database written to `.env`, then **claimed** by the user into a free Neon account |
| Old data | Discarded: `data/`, `DB_PATH`, and the `/data/` gitignore line are removed |
| Env docs | Commit `.env.example`; add `!.env.example` to `.gitignore` (which ignores `.env*`) |

## Step 0: Branch
`git switch -c neon` from the committed SQLite baseline on `main`.

## Step 1: Schema, `db/schema.sql`
```sql
CREATE TABLE IF NOT EXISTS games (
  id             TEXT PRIMARY KEY,
  board          JSONB NOT NULL,
  current_player TEXT NOT NULL CHECK (current_player IN ('red', 'blue')),
  status         TEXT NOT NULL CHECK (status IN ('active', 'finished')),
  winner         TEXT CHECK (winner IN ('red', 'blue')),
  move_count     INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL,
  updated_at     TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS moves (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  game_id     TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  move_number INTEGER NOT NULL,
  player      TEXT NOT NULL CHECK (player IN ('red', 'blue')),
  from_cell   TEXT NOT NULL,
  to_cell     TEXT NOT NULL,
  path        JSONB NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('step', 'jump')),
  created_at  TIMESTAMPTZ NOT NULL,
  UNIQUE (game_id, move_number)
);
```
- **Timestamps:** these stay app-generated ISO strings passed as params, as they are today. That keeps millisecond precision for the client's `updatedAt >` polling comparison (`components/GameClient.tsx`).
- **`scripts/migrate.mjs`:** reads `db/schema.sql`, splits it on `;`, and runs each statement through `neon()`. The HTTP driver runs one statement per call.
- **Script:** `"db:migrate": "node --env-file=.env scripts/migrate.mjs"`.

## Step 2: `lib/db.ts`, the query seam
Replace the better-sqlite3 singleton with:
```ts
export interface Db {
  query<T>(text: string, params?: unknown[]): Promise<T[]>;
}
export function getDb(): Db;      // lazily wraps neon(process.env.DATABASE_URL); clear error pointing at .env.example if unset
export function setDb(db: Db): void; // test injection
```

## Step 3: `lib/games-repo.ts`, every function async
Keep `GameError`, `parseMoveInput`, and the order of validation as they are today.
- **`toGame` / `toMove` normalization:**
  - Timestamps: `new Date(v).toISOString()`, because drivers may return a `Date`.
  - JSONB: if the value comes back as a string, `JSON.parse` it; otherwise use the object as-is.
  - This keeps the RSC props (`initialGame`) plain and serializable.
- **`createGame`:** a single `INSERT … RETURNING *`.
- **`resetGame`:** one statement, `WITH del AS (DELETE FROM moves WHERE game_id = $1) UPDATE games SET … move_count = 0 … WHERE id = $1 RETURNING *`. 0 rows → 404.
- **`submitMove`:**
  1. Read the game, then run the existing checks in JS: finished, `expectedMoveCount`, turn, ownership, `legalMoves`, `hasWon`, `nextPlayer`.
  2. Write with one guarded statement:
     ```sql
     WITH upd AS (
       UPDATE games
       SET board = $3::jsonb, current_player = $4, status = $5, winner = $6,
           move_count = move_count + 1, updated_at = $7
       WHERE id = $1 AND move_count = $2 AND status = 'active'
       RETURNING *
     ), ins AS (
       INSERT INTO moves (game_id, move_number, player, from_cell, to_cell, path, kind, created_at)
       SELECT id, move_count, $8, $9, $10, $11::jsonb, $12, $7 FROM upd
     )
     SELECT * FROM upd;
     ```
  3. If it returns 0 rows, throw `GameError(409, "The board has changed since you loaded it; refresh and try again")`, the same message as the existing stale check.
- **`listMoves`:** same logic, now awaited.

## Step 4: Callers
- **`app/api/games/**/route.ts` (4 files):** add `await` to the repo calls. The handlers are already async inside `handle()`.
- **`app/games/[id]/page.tsx`:** `await getGame(id)` and `await listMoves(id)`. Keep `await connection()`, and reword its comment: the query is per-request data, not a synchronous SQLite call.

## Step 5: Tests
- **`vitest.config.mts`:** remove the `DB_PATH` env.
- **`lib/games-repo.test.ts`:**
  - `beforeAll`: create a `PGlite`, `exec` the contents of `db/schema.sql`, and call `setDb({ query: async (t, p) => (await pg.query(t, p)).rows })`.
  - `beforeEach`: `TRUNCATE games CASCADE`.
  - Convert the existing cases to async, using `await expect(…).rejects`.
- **New case:** two concurrent `submitMove` calls (`Promise.all`), both making the same legal opening move with no `expectedMoveCount`. Exactly one should succeed and the other should get a 409, leaving one move in history. This exercises the guarded write.
- **`lib/game/rules.test.ts`:** unchanged.

## Step 6: Dependencies, config, docs
- **`package.json`:** remove `better-sqlite3` and `@types/better-sqlite3`; add `@neondatabase/serverless`; add the dev dependency `@electric-sql/pglite`.
- **Files:** delete `data/`. In `.gitignore`, drop `/data/` and add `!.env.example`.
- **`.env.example`:** `DATABASE_URL=postgresql://USER:PASSWORD@ep-xxxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require`.
- **`README.md` (`neon` branch only), setup steps:**
  1. Create the database with the claimable-DB CLI.
  2. `npm run db:migrate`.
  3. `npm run dev`.
  4. Claim the database within 72 h, paste the rotated `DATABASE_URL`, and restart.
- **`README.md`, polling note:** compute stays awake while a game tab is visible (2 s polling). Neon scales to zero about 5 min after the last tab closes, and the first request after that is a cold start.
- **`PROMPT-HISTORY.md`:** log the implementation as a new interaction.

## Step 7: Provisioning (with the user)
- **Check the command first.** Run the claimable-DB CLI with `--help` before using it, because sources disagree. Neon's docs show `neon claim create --env-pull`; older guides use `npx neondb` or `npx neon-new`.
- **Ask before running it.** It creates an external resource. It writes `DATABASE_URL` (pooled) and a claim link to `.env`.
- **Limits until claimed:** the database expires 72 h after creation, with caps of 100 MB storage and 1 GB transfer.
- Run `npm run db:migrate` twice to prove it's idempotent.
- **User step:**
  1. Open the claim link, sign in, and claim the database into a free account.
  2. Claiming rotates the password, so put the new `DATABASE_URL` in `.env` and restart `npm run dev`.

## Verification
1. **Checks:**
   - `npm test`: the rules tests plus the PGlite repo tests, including the concurrency case.
   - `npm run typecheck`, `npm run lint`, and `npm run build` are all clean.
   - `grep -r better-sqlite3 lib app` returns nothing.
2. **API flow:** run `npm run dev` against Neon and repeat PLAN.md's curl flow:
   - create → GET → legal move
   - wrong turn (409) → stale `expectedMoveCount` (409)
   - illegal move (400) → bad JSON (400)
   - GET moves → reset → unknown id (404)
3. **Data reached Neon:** a one-line node script using `neon()` counts the rows in `games` and `moves`.
4. **UI, two tabs (`run` skill):** select a marble, see the highlights, make a chained jump, then check the history entry, the turn switch, polling sync, Restart, and New Game.
5. **After claiming:** restart with the new URL and reload an earlier game id. It should still be there.
6. **SQLite baseline:** `git switch main && npm test` still passes.

## References
- Neon serverless driver: https://neon.com/docs/serverless/serverless-driver
- Claimable Postgres: https://neon.com/docs/reference/claimable-postgres
- Next 16 caching and `connection()`: `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md`
