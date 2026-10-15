# Prompt History

This document records meaningful development interactions between the user and
AI coding agents working on this project. It focuses on requests, outcomes,
implementation decisions, verification, and human-agent collaboration rather
than preserving a raw conversation transcript.

Generated code is included verbatim when reasonably concise. Extensive
implementations are referenced through their canonical repository files.

> This file is an engineering collaboration record, not a source of truth for
> application behavior. The repository itself remains authoritative.

`PLAN.md` (same folder) is the approved implementation plan from this session,
kept as a design snapshot. This file is the running collaboration log.

---

## Session: 2026-10-14

**Objective:** Build a two-player Chinese Checkers demo in Next.js. The backend validates moves, enforces turns, detects wins, and persists games and move history.

### Interaction 1 — Initial task and planning

**User Prompt**

> Task: we are going to create a next.js application where two users play a game of Chinese Checkers (https://officialgamerules.org/game-rules/chinese-checkers/).
>
> This will be for demonstration purposes: no log in required.
>
> The interface could include a star-shaped board, colored marbles, player turn indicator, New Game button, and move history.
> A player clicks one of their marbles, then clicks a valid destination. The frontend sends that move to the backend, which validates it, updates the board, and returns the new game state.
>
> Layer / Responsibility: React frontend — Draw the board and marbles; React state — Selected marble, highlighted moves, current game state; Next.js backend — Validate moves, enforce turns, detect wins; API communication — Send moves and retrieve updated board state; Data storage — Maintain game sessions and move history
>
> 3. Game rules for the first version — standard two-player configuration:
> - A six-pointed star board with 121 positions.
> - Two players, Red and Blue, with 10 marbles each.
> - Players take turns moving one marble.
> - A marble can move into an adjacent empty position or jump over another marble into an empty position.
> - Multiple jumps are allowed during one turn.
> - The first player to move all their marbles into the opposite triangle wins
>
> 4. Suggested API endpoints: `POST /api/games` (start), `GET /api/games/:id` (board and turn), `POST /api/games/:id/moves` (submit move), `GET /api/games/:id/moves` (history), `POST /api/games/:id/reset` (restart)
>
> [Prompt abbreviated for history. Table formatting condensed; core requirements preserved.]

**Agent Outcome**

Ran in plan mode. The working folder was empty. The agent read the linked rules page, which confirms chained hops and that marbles can't leave the destination triangle. It doesn't address spoiling or whether a step can be mixed with hops. The agent then asked three clarifying questions and wrote a plan.

**Collaboration**

The user made these decisions:
- **Storage:** SQLite via `better-sqlite3`. The agent had recommended an in-memory Map; the user chose persistence.
- **Play mode:** a shareable `/games/[id]` link with ~2s polling. Hot-seat on one screen still works.
- **Rules:** enforce the official "can't leave the target triangle" rule, on top of the rules in the prompt.

### Interaction 2 — Plan approval with redirection

**User Prompt**

> write this plan into PLAN.md at the root of this project, then execute in manual mode.

**Agent Outcome**

The project was scaffolded into `chinese-checkers/` first, because `create-next-app` refuses a non-empty directory. The approved plan was then copied verbatim to `PLAN.md`. Implementation went ahead with edits approved manually.

### Interaction 3 — Implementation

**Agent Outcome**

Built the full app with Next.js 16.4.1 (App Router, Turbopack, Cache Components on by default), React 19.3, Tailwind 4, `better-sqlite3` 13, and Vitest 5.

**Implementation**

- [`lib/game/board.ts`](lib/game/board.ts): axial hex geometry. The star is the union of two triangles, `{q,r,s ≥ -4} ∪ {q,r,s ≤ 4}`, giving 121 cells. Also holds `HOME`/`TARGET` sets and `row-col` labels.
- [`lib/game/rules.ts`](lib/game/rules.ts): pure functions shared by client and server: `legalMoves()` (steps plus a BFS over hop chains with parent tracking for the path), `applyMove()`, `hasWon()`, `nextPlayer()`.
- [`lib/db.ts`](lib/db.ts): `better-sqlite3` singleton on `globalThis`, WAL mode, with a `games` and a `moves` table.
- [`lib/games-repo.ts`](lib/games-repo.ts): `createGame()`, `getGame()`, `listMoves()`, `resetGame()`, and `submitMove()`, which runs in a single transaction. `GameError` carries the HTTP status.
- [`app/api/games/`](app/api/games/): the five route handlers, sharing [`lib/http.ts`](lib/http.ts).
- [`components/GameClient.tsx`](components/GameClient.tsx): selection, highlights, polling, the seat picker, New Game / Restart / Copy link. Also [`Board.tsx`](components/Board.tsx) (SVG), [`TurnIndicator.tsx`](components/TurnIndicator.tsx), and [`MoveHistory.tsx`](components/MoveHistory.tsx).
- [`app/games/[id]/page.tsx`](app/games/[id]/page.tsx): server-loads the game inside `<Suspense>` after `await connection()`.

**Rationale**

- **Shared rules module.** The client uses it only to highlight destinations, and the server re-validates every move, so the two can't drift apart. The client sends just `{from, to}` and the server works out the hop path for history.
- **Anti-spoiling win.** The win condition is "target full and at least one marble is yours." With the leave-lock rule, an opponent marble left at home could otherwise block a win forever. This goes slightly beyond the user's stated win rule and is documented in README.
- **`expectedMoveCount` → 409.** This handles two browsers racing on the same game.
- **Seat picker.** Stored in `sessionStorage` per tab, so two tabs can take opposite sides. It's a UI guard only, since there's no auth.
- **Next 16 specifics.**
  - Pages with dynamic params must access them inside `<Suspense>`.
  - The bundled docs say synchronous `better-sqlite3` queries need `await connection()` to stay out of prerendering.
  - `RouteContext<…>` and `PageProps<…>` are globally generated types.

**Changes**

- Created: `lib/**`, `components/**`, `app/api/games/**`, `app/games/[id]/{page,not-found}.tsx`, `vitest.config.mts`, `PLAN.md`, `CLAUDE.md` (imports `AGENTS.md` and turns on this log), `PROMPT-HISTORY.md`.
- Modified:
  - `app/page.tsx`: landing page with rules and New Game.
  - `app/layout.tsx`: metadata.
  - `app/globals.css`: Geist font, warm background.
  - `README.md`: replaced the boilerplate.
  - `package.json`: `test` and `typecheck` scripts, `@types/node` bumped to `^24`.
  - `.gitignore`: ignores `/data/`.

**Verification**

- `npm test`: 30 tests pass.
  - Rules: 121 cells and row lengths, steps, single and chained hops with a direction change, loop termination, target-triangle lock, win and anti-spoiling, no-move pass.
  - Repository: turn and ownership checks, 400/404/409 cases, history order, a win, reset.
- `npm run typecheck` and `npm run lint`: clean. `npm run build`: succeeds, with `/games/[id]` rendered as Partial Prerender.
- curl against `next dev` hit every endpoint, including a 409 for the wrong turn, a 409 for a stale count, a 400 for an illegal move, a 400 for a bad JSON body, and a 404.
- Headless Chrome (`playwright-core` in the session scratchpad, not a project dependency) checked the following:
  - Highlights appear, and the opponent's marbles can't be selected.
  - A step and a ×2 chained jump each update the history and switch the turn.
  - A second tab synced through polling in about 2.3s.
  - Restart synced across tabs, and New Game navigated to a new id.
  - No horizontal overflow at 390px.
  - One hydration warning about an inline `caret-color` style came from Playwright's screenshot caret-hiding. Clean reloads without screenshots showed no errors.

**Known behaviour**

- `/games/<unknown>` renders the not-found UI with `noindex` but returns HTTP 200. `notFound()` runs inside Suspense after streaming has started, which Next documents as expected.

**Collaboration**

`npm` refused vitest 5's peer range for `@types/node@^20`. The agent bumped it to `^24` to match the Node 24 runtime, rather than forcing the install with `--legacy-peer-deps`.

---

## Session: 2026-10-15

**Objective:** Check the built app against `PLAN.md`, then design a move from SQLite to Neon (serverless Postgres).

### Interaction 4 — Plan alignment audit and Neon design (grilling)

**User Prompt**

> /grill-me is this application in its current state aligned with the planning document?
> what would the integration and implementation of a Neon database look like for data storage for this application?

**Agent Outcome**

Ran in plan mode using the `grilling` skill. The agent read `PLAN.md` and the code, then answered the alignment question. It then asked four rounds of design questions about Neon and recorded each answer.

**Alignment audit.** The app is closely aligned with the plan. Every planned file, endpoint, status code, schema column and test area exists. Small drift, all of it deliberate or cosmetic:
- The plan's `winner(board)` became `hasWon(board, player)` plus `nextPlayer()`. Behavior is the same.
- The seat is stored in `sessionStorage`, not `localStorage`, so two tabs can sit on opposite sides.
- `/games/<unknown>` returns HTTP 200 with the not-found UI. This is already listed as known behavior.
- Not in the plan, but helpful: `lib/http.ts`, `components/NewGameButton.tsx`, and the `typecheck` script.
- Gap: nothing had been committed past the create-next-app commit.

**Neon touch points.** Storage sits behind `lib/db.ts` and `lib/games-repo.ts`. To move it:
- Every repo function becomes async.
- The SQLite transaction in `submitMove` needs a different design.
- The schema moves to Postgres types.
- Schema creation becomes an explicit migration step.
- The repo tests need a Postgres to run against, since `:memory:` SQLite goes away.

**Collaboration**

The user made these decisions. The agent recommended an option for each, and the user accepted it unless noted otherwise:
- **Hosting.** The user asked whether GitHub Pages would work. The agent explained that it can't: Pages is static-only, so it can't run the API that validates moves, and the browser would need the database credentials. The user chose **local only for now**. The agent had recommended Vercel.
- **SQLite.** Replace it outright, with no dual-driver adapter.
- **Git.** Commit the SQLite baseline on `main`, then do the Neon work on a `neon` branch. Later the user chose to **keep that branch separate** instead of merging it, which overrode the agent's recommendation.
- **Query layer.** Raw parameterized SQL with the `@neondatabase/serverless` HTTP driver, with no ORM.
- **Concurrency.** Each write is a single guarded SQL statement (`UPDATE … WHERE move_count = $n` with an `INSERT` in a CTE). If no rows match, the API returns 409. There is no Pool and no interactive transactions.
- **Tests.** PGlite in-memory Postgres behind a small `query(text, params)` seam.
- **Docs.** Leave `PLAN.md` as the SQLite snapshot. The Neon design goes in a new `PLAN-NEON.md`. The agent had recommended revising `PLAN.md` in place.
- **Provisioning.** The user chose an instant claimable Neon database over the Neon Console, which the agent had recommended, and will **claim** it into a free account. The agent looked up the details: an unclaimed database expires after 72 h, and claiming rotates the password. Sources disagree on the exact CLI command, so execution will check it with `--help` first.
- **Migrations.** One idempotent `db/schema.sql`, shared by `npm run db:migrate` and the test setup.
- **Old SQLite data.** Discard it.
- **Environment.** Commit `.env.example`, with a gitignore exception.

The user rejected the plan-mode exit and redirected. The agent was to log this session here, write `PLAN-NEON.md`, and commit the current work on `main`. Implementation is deferred to a later session.

**Changes**

- Created: `PLAN-NEON.md`, the full Neon design: decisions, steps, SQL, and verification.
- Committed on `main`: the complete SQLite app from Interactions 1–3, plus this log and `PLAN-NEON.md`. This commit is the baseline the `neon` branch will start from.

---

## Session: 2026-10-15 (Neon implementation)

**Objective:** Carry out `PLAN-NEON.md` on branch `feature/neon_db`, with each step as a milestone that is reviewed and committed before the next one starts.

### Interaction 1 — Execute PLAN-NEON as reviewed milestones

**User Prompt**

> Execute the steps in NEON-PLAN as milestones to be reviewed then committed separately before continuing.

**Collaboration**

- **Review.** The agent asked who should review each milestone. The user chose to **review every step themselves before it is committed**.
- **Branch.** The user had already created `feature/neon_db` from the SQLite baseline `d97b303`, so it replaces the plan's `neon` branch. Step 0 needed no commit.
- **Dependencies.** Each one is added in the step that first uses it, rather than all in Step 6. `@neondatabase/serverless` comes in Step 1 for the migrate script.

#### Milestone 1 — Schema and migration script

**Changes**

- [`db/schema.sql`](db/schema.sql): the Postgres schema from the plan, unchanged.
- [`scripts/migrate.mjs`](scripts/migrate.mjs): splits the schema on `;` and runs each statement through `neon()`'s `sql.query()`. Exits with a pointer to `.env.example` if `DATABASE_URL` is unset.
- `package.json`: adds `db:migrate` and `@neondatabase/serverless@^1.2.0`.

**Rationale**

The script uses `--env-file-if-exists=.env` instead of the plan's `--env-file=.env`. With the plan's flag, a missing `.env` makes Node stop with `node: .env: not found`. With this one, the script prints its own message, and `DATABASE_URL` can also come from the shell.

**Verification**

- No Neon database exists yet; that is Step 7. The agent ran the same split-and-run logic against a throwaway PGlite in the session scratchpad. Two runs both succeeded, which shows the schema can safely be re-run. Both tables were created, and the `current_player` CHECK rejected `'green'`.
- `npm run db:migrate` with no `.env` exits 1 and prints the `.env.example` hint.

The user approved Milestone 1, committed as `935ae73`. They chose to **combine Steps 2–4 into one milestone**, so no commit is left in a state that doesn't compile.

#### Milestone 2 — Async query seam, repository, and callers (Steps 2–4)

**Changes**

- [`lib/db.ts`](lib/db.ts): replaces the better-sqlite3 singleton.
  - The `Db` interface has one method, `query<T>(text, params)`.
  - `getDb()` lazily wraps `neon(DATABASE_URL)` and throws a hint pointing at `.env.example` if it's unset.
  - `setDb()` lets the tests inject a database.
- [`lib/games-repo.ts`](lib/games-repo.ts): every function is now async.
  - `toGame`/`toMove` normalize JSONB (string or object) and TIMESTAMPTZ (Date or string, turned into an ISO string).
  - `createGame` is one `INSERT … RETURNING *`.
  - `resetGame` is one `WITH del AS (DELETE …) UPDATE … RETURNING *`. Zero rows means 404.
  - `submitMove` keeps the JS validation order, then writes with the plan's guarded `UPDATE … WHERE move_count = $2 AND status = 'active'` and a CTE `INSERT` into `moves`. Zero rows means a 409 with the existing stale-board message, now shared as `STALE_BOARD`.
- `app/api/games/**/route.ts` (4 files): each one now awaits its repo call.
- `app/games/[id]/page.tsx`: awaits `getGame`/`listMoves`. The `connection()` comment now says the call is there because game state is per-request data that changes over time, as the bundled `08-caching.md` describes, not because SQLite is synchronous.

**Verification**

- `npm run typecheck`: the app code is clean. The only errors are in `lib/games-repo.test.ts`, which still uses the synchronous SQLite API; Step 5 rewrites it. `npm run lint` is clean. `grep better-sqlite3 lib app` finds nothing.
- `npm run build` hasn't been run yet. It also typechecks the stale test file, so it waits for Step 5.
- A throwaway Vitest smoke test in the session scratchpad ran the real repo against PGlite. It is not part of the repo.
  - **Create:** ISO timestamps with milliseconds.
  - **Concurrent writes:** two identical opening moves fired with `Promise.allSettled` gave one `ok` and one `409 The board has changed…`, leaving exactly one history row.
  - **Move results:** `path` comes back as an array, the turn passes to blue, and `updatedAt` advances.
  - **Reset:** it clears the history. Resetting or getting an unknown id gives 404 / `null`.
