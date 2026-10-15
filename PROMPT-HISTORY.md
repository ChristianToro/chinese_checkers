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

The user approved Milestone 2, committed as `1919f16`.

#### Milestone 3 — PGlite repository tests (Step 5)

**Changes**

- [`lib/games-repo.test.ts`](lib/games-repo.test.ts):
  - `beforeAll` creates an in-memory `PGlite`, runs `db/schema.sql`, and calls `setDb` to make PGlite the database.
  - `beforeEach` runs `TRUNCATE games CASCADE`.
  - All 9 existing cases are now async, through an `expectGameError(promise, status)` helper built on `await expect(…).rejects`.
  - The win test seeds its board with `UPDATE … SET board = $1::jsonb`.
  - New: "lets only one of two concurrent identical moves through".
- `vitest.config.mts`: deleted. Its only setting was `DB_PATH`, and an empty config adds nothing.
- `package.json`: adds the dev dependency `@electric-sql/pglite@^0.5.10`.

**Rationale**

The concurrency case uses `Promise.allSettled`, not the plan's `Promise.all`, because `Promise.all` would reject on the 409 before the other result could be checked. Both calls read `move_count = 0` before either one writes, so the second write reaches the guarded `UPDATE` and matches 0 rows.

**Verification**

- `npm test`: 31 tests pass, 21 rules and 10 repository.
- `npm run typecheck`, `npm run lint`, and `npm run build` are all clean. `/games/[id]` is still a Partial Prerender.
- **Guard check:** the agent temporarily replaced `move_count = $2` in the guarded `UPDATE` with a condition that always holds. Only the concurrency test failed. The file was then restored from git.

The user approved Milestone 3, committed as `c36c3b9`.

#### Milestone 4 — Remove SQLite; env, gitignore, README (Step 6)

**Changes**

- `package.json`: removes `better-sqlite3` and `@types/better-sqlite3`.
- `data/`: deleted from disk. It was never tracked, so the local SQLite games are gone on every branch, as decided.
- `.gitignore`: drops `/data/` and adds `!.env.example`.
- [`.env.example`](.env.example): a placeholder pooled `DATABASE_URL`.
- [`README.md`](README.md):
  - **Setup:** `npx neonctl claim create --file .env`, then `npm run db:migrate`, then `npm run dev`. Claim with `npx neonctl claim accept` within 72 h, and replace the rotated `DATABASE_URL`.
  - **Polling and cold start:** a note on how the 2 s polling keeps Neon awake.
  - **Architecture table:** updated for the new storage layer.
  - **Guarded write:** a sentence on how it behaves.

**Rationale**

The plan left the exact provisioning command to be checked. To write the README correctly, the agent checked it now.
- **Docs:** Neon's claimable-Postgres page gives `neon claim create --env-pull`.
- **CLI help:** `npx neonctl@latest claim create --help` (v8.7.1) shows that `--env-pull` is already the default.
- **Target file:** `--file` writes to an existing `.env` but otherwise falls back to `.env.local`. `db:migrate` reads only `.env`, so the README passes `--file .env`.
- **Claim link:** it comes from `neon claim accept`; the CLI doesn't write it to `.env` as the plan expected.

Only `--help` was run, and nothing was provisioned.

**Verification**

- `npm test` (31 tests), `npm run typecheck`, `npm run lint`, and `npm run build` all pass.
- `grep better-sqlite3 lib app package.json` returns nothing.
- `git check-ignore -v` confirms `.env`/`.env.local` are ignored and `.env.example` is re-included.

The user approved Milestone 4, committed as `1a2fb33`.

#### Milestone 5 — Provision the temporary Neon database (Step 7)

**User Prompt**

> commit this and move on to step 7. We will leverage the temporary database and I will claim it later on.

**Agent Outcome**

With the user's approval, the agent ran `npx -y neonctl@8.7.1 claim create --file .env`.
- **Project:** `spring-frog-99908215`, branch `br-patient-queen-b5l98m1z`. It is unclaimed and **expires 2026-10-18T20:57:42Z**.
- **`.env`:** the CLI wrote `DATABASE_URL` (the pooled endpoint), `DATABASE_URL_UNPOOLED`, and `NEON_BRANCH`.
- **`.neon`:** a local file holding the project and branch IDs. The CLI also added it to `.gitignore`, and the agent kept that entry under a comment heading.

**Changes**

- `.gitignore`: the CLI's `.neon` entry, now under a comment heading.

**Verification**

- `npm run db:migrate` ran twice and printed `Applied 2 schema statements.` both times. `information_schema` lists `games` and `moves`.
- **`next dev` against Neon:** repeated PLAN.md's curl flow:
  - create → GET 200 → a legal move 200
  - wrong turn 409 → stale `expectedMoveCount` 409
  - illegal move 400 → bad JSON 400
  - GET moves (1 entry) → reset 200 (history empty) → unknown id 404
  - `/games/<id>` page 200
- **Rows reached Neon:** a `neon()` query counted them. Game `898c4c450a` was left with one move (`games: 1, moves: 1`) so the claim check can find it.
- **Not yet done:**
  - the two-tab UI check (`run` skill)
  - the after-claim reload of `898c4c450a`, which waits on the user
  - `git switch main && npm test`

The user approved Milestone 5, committed as `9aad15a`.

#### Milestone 6 — Final verification

**User Prompt**

> commit this and continue with the final verification; the spring-frog db will be leveraged until 2026-10-17, so a recheck is not necessary

**Agent Outcome**

The user will use the unclaimed `spring-frog` database until 2026-10-17, so they **dropped the plan's after-claim reload check**. Every other item in the plan's Verification section passed.

**Verification**

- **UI, two tabs against Neon:**
  - **Setup:** the `run` skill found no project skill and no `chromium-cli`, so the agent drove `/usr/bin/google-chrome` with `playwright-core` from the session scratchpad. Neither is a project dependency. Each tab had its own browser context: A played Red and B played Blue.
  - **Opening:** a vitest-based search (scratchpad) with the real rules engine found the opening `4-1→5-5`, `14-4→13-9`, `5-5→5-6`, `14-3→14-4`. After it, red can make a two-hop chain.
  - **Results:**
    - **Seat guard:** Blue's tab has 0 selectable marbles on Red's turn.
    - **Highlights:** selecting `4-1` shows 2 highlights.
    - **Each move:** adds a history row and switches the turn.
    - **Polling:** the other tab synced within 0.6–1.3 s every time.
    - **Chained jump:** `3-1 → 5-5` was logged as `jump ×2`, with the dashed path drawn in both tabs, confirmed by screenshot.
    - **Restart:** cleared both tabs, the second by polling within 1.3 s.
    - **New Game:** went to a new id with an empty history.
    - **Layout and errors:** no horizontal overflow at 390 px, and no console errors in any tab.
- **Rows reached Neon:** a `neon()` query lists the three games (`898c4c450a` with 1 move, plus the UI run's restarted game and new game, each with 0).
- **SQLite baseline:** a temporary detached worktree of `main` (`d97b303`) in the scratchpad ran `npm ci && npm test`, and 30 tests passed. The worktree was then removed, so the `feature/neon_db` checkout and its `node_modules` were never touched.

**Collaboration**

The `run` fallback needed a scratch driver (`playwright-core` plus a two-tab script), so the agent suggested `/run-skill-generator` to save it as a project skill.

The user approved Milestone 6, committed as `8b9b0cf`.

### Interaction 2 — Expiry reminder in PLAN-NEON.md

**User Prompt**

> Add an alert comment at the top of PLAN-NEON regarding the expiry time as a reminder. I will push in a separate terminal.

**Changes**

- `PLAN-NEON.md`: a GitHub `[!CAUTION]` alert under the title. It gives the unclaimed `spring-frog-99908215` database's expiry, 2026-10-18 20:57:42 UTC, and notes that it's in use until 2026-10-17. It also covers how to claim it, which means replacing the rotated `DATABASE_URL`, and how to re-provision it if it lapses.

**Collaboration**

The user pushes the branch themselves, so the agent committed this but did not push.

---

## Session: 2026-10-15 (Authentication)

**Objective:** Add username/password accounts with an avatar, and use them to track each user's game history. The work happens on branch `feature/authentication`, as milestones the user reviews.

### Interaction 1 — Planning user accounts and game history

**User Prompt**

> Now that we have a neon db to leverage, I want to include authentication for users, with a username and a password.
>
> On the landing page an inauthenticated user will be prompted to create an account with a username, a password, and an avatar (assets are located in public/assets/avatars)
>
> The goal of having authenticated users is to track game history

**Agent Outcome**

The agent wrote [`PLAN-AUTH.md`](PLAN-AUTH.md) in plan mode, in 9 steps:
- **Step 0:** housekeeping.
- **Steps 1–7:** schema, auth core, session glue + `proxy.ts`, Server Actions, player-aware games repo, API routes, UI.
- **Step 8:** tests.

Before writing it, the agent read the existing data layer (`lib/db.ts`, `lib/games-repo.ts`, `db/schema.sql`) and the Next 16 docs it bundles. Those docs are `02-guides/authentication.md`, `authentication-with-cache-components.md`, `cookies.md` and `redirect.md`. `cacheComponents` is on, so every component that reads the session must sit behind `<Suspense>`, and cookies can only be set in Server Functions or Route Handlers.

**Key decisions**

| Decision | Choice | Decided by |
|---|---|---|
| Game ↔ users | The creator takes Red. A second signed-in user claims Blue from the share link. Only the account in the seat to move may move | User |
| Signed-out visitors | Must sign in to play. Game links redirect to `/?next=/games/<id>` | User |
| Auth flows | Sign up, log in, and log out | User |
| Passwords | `node:crypto` scrypt with a per-user salt. No new dependency | Agent |
| Sessions | DB `sessions` table holding the SHA-256 of a random token, which lives in an httpOnly `cc_session` cookie. Revocable, and needs no secret env var | Agent |
| Forms | Server Actions with `useActionState`, per the Next auth guide. Game APIs stay route handlers | Agent |
| History | A "Your games" list on the signed-in landing page | Agent |
| Legacy games | `red_user_id` / `blue_user_id` are nullable. Joining fills an empty seat, so existing ownerless games need no special case | Agent |
| Finished games | Can't be restarted, so the history stays intact | Agent |

**Rationale**

Server-derived seats make the history trustworthy: the server, not the client's `player` field, decides who moved. A consequence the agent flagged: hot-seat play (one screen, both colours) goes away, along with the per-tab seat picker.

**Changes**

- Created [`PLAN-AUTH.md`](PLAN-AUTH.md).

**Verification**

None yet. This interaction was planning only.

**Collaboration**

- **Design questions:** the agent asked three questions, and the user picked the recommended option each time: two seated players, sign-in required, full log-in/log-out.
- **Approval:** the user rejected the plan-mode exit twice to restate how the work should run.
  - **First rejection:**
    > write this plan into PLAN-AUTH.md at the repo root. Execute each step as a milestone to be reviewed by me, then it will be comitted before moving on to the next step. Execute in manual mode
  - **The agent's response:** it added an "Execution protocol" section to the plan, so `PLAN-AUTH.md` carries it:
    - one milestone per step, with a stop for review;
    - a commit only after approval;
    - edits approved manually;
    - never push.
  - **Second rejection:**
    > Write this plan into PLAN-AUTH.md at the root of the project. Complete each step as a separate milestone to be reviewed by me. After the review, commit and move on to the next step.
  - **What followed:** the agent then wrote `PLAN-AUTH.md` directly. It's a copy of the approved plan file.
- **Prompt history:** `CLAUDE.md` asks for the `prompt-history` skill at session start. The agent's attempt to invoke it failed, because the skill disables model invocation, so the agent asked the user to run it. The user ran `/prompt-history` and asked for `PLAN-AUTH.md` and this log to be committed before Step 1 starts.
- **Agent memory:** the agent saved the milestone workflow to its project memory, outside the repo, for future sessions.

### Interaction 2 — Step 1: Schema

**User Prompt**

> commit PLAN-AUTH and the session thus far into the prompt-history. Then start step 1

**Agent Outcome**

Committed the plan and the log as `08f3c81`. Then appended to [`db/schema.sql`](db/schema.sql):
- `users` table, with an avatar `CHECK` over the 5 avatar keys.
- A unique index on `lower(username)`.
- `sessions` table.
- Nullable `games.red_user_id` / `blue_user_id` foreign keys, each with an index.

Every statement is idempotent: `IF NOT EXISTS` on each one, including `ADD COLUMN IF NOT EXISTS`.

**Attempted Approach / Resolution**

The first draft had a `;` inside a SQL comment. `scripts/migrate.mjs` splits the file on `;`, so that would have produced a broken statement. The agent reworded the comment before running the migration and confirmed that no comment line contains `;`.

**Changes**

- [`db/schema.sql`](db/schema.sql): auth tables and seat columns.

**Verification**

- `npm test`: 31 passed. The PGlite harness applies the extended schema.
- `npm run db:migrate` against Neon ran twice, applying 9 statements both times. The second run being a no-op shows the schema is idempotent.
- A scratch `neon()` query against `information_schema` and `pg_indexes` confirmed:
  - the new columns and their nullability;
  - all 4 new indexes;
  - the 5 existing games, all with `red_user_id` NULL.

**Collaboration**

The plan's own note says `migrate.mjs` splits on `;`, and that is what caught the comment bug.

### Interaction 3 — Step 1 review: track avatar assets, audit this log

**User Prompt**

> Add the asset folder to this step 1 commit. Look back through this session to ensure it is reflected in prompt-history; if anything is missing, add it

**Agent Outcome**

- **The assets were untracked.** While preparing the Step 1 commit, the agent found that `public/assets/` had never been tracked by git. That folder holds the 5 avatar PNGs (512×512, ~370–395 KB each) that the `users.avatar` CHECK and the planned picker depend on. At the user's direction, the folder is added in the Step 1 commit.
- **Log audit.** The agent checked this log against the session and found 4 gaps:
  - the first plan-mode rejection (the "Execute in manual mode" wording), which wasn't quoted;
  - the plan's added "Execution protocol" section, which wasn't mentioned;
  - the failed attempt to invoke `prompt-history` itself, which wasn't recorded;
  - the untracked-assets discovery, which wasn't logged.

  It filled all 4 in Interaction 1 and in this entry.

**Changes**

- `public/assets/avatars/avatar_{panda,rabbit,red_panda,tiger,turtle}.png`: now tracked.
- [`PROMPT-HISTORY.md`](PROMPT-HISTORY.md): Interaction 1 Collaboration completed, plus this entry.

**Verification**

The agent confirmed that `public/assets/` contains only the 5 avatar PNGs before staging it.

### Interaction 4 — Step 2: Auth core

**Agent Outcome**

Step 1 was committed as `ad8640c`, together with the avatar assets. Step 2 adds the auth core: pure DB and crypto code, with no Next.js imports, so PGlite can test it.

- **[`lib/avatars.ts`](lib/avatars.ts):**
  - `AVATARS`, the 5 keys, kept in sync with the schema CHECK;
  - `Avatar` type;
  - `AVATAR_LABELS`;
  - `isAvatar()`;
  - `avatarSrc()`.
- **[`lib/password.ts`](lib/password.ts):**
  - `hashPassword()` uses `node:crypto` scrypt with a 16-byte salt and a 64-byte key, stored as `scrypt$<salt>$<hash>`.
  - `verifyPassword()` uses `timingSafeEqual`. It rejects a malformed stored value or a key of the wrong length before running scrypt.
- **[`lib/users-repo.ts`](lib/users-repo.ts):**
  - `validateSignup()`: username 3–20 chars of `[A-Za-z0-9_-]`, trimmed. Password 8–128 chars, not trimmed. Avatar must be in `AVATARS`.
  - `createUser()`: returns `null` on Postgres `23505`, which is a duplicate on the `lower(username)` index.
  - `verifyCredentials()`: matches the username case-insensitively. When no such user exists, it checks the password against a dummy hash, so timing doesn't reveal which usernames exist.
  - `createSession()`: 32 random bytes as base64url. Only the SHA-256 hex is stored, with a 30-day TTL.
  - `findUserBySessionToken()`: filters on `expires_at > now`.
  - `deleteSession()`.

**Deviation from the plan**

The plan puts all tests in Step 8. The agent wrote the tests for this step's code now, so the milestone can be verified when it's reviewed. Step 8 still covers the games-repo changes.
- [`lib/password.test.ts`](lib/password.test.ts)
- [`lib/users-repo.test.ts`](lib/users-repo.test.ts)

**Changes**

- Created:
  - `lib/avatars.ts`
  - `lib/password.ts`
  - `lib/users-repo.ts`
  - `lib/password.test.ts`
  - `lib/users-repo.test.ts`

**Verification**

- `npm test`: 42 passed across 4 files, 11 of them new. The new tests cover:
  - signup validation;
  - case-insensitive duplicate rejection;
  - no plaintext password in the stored row;
  - right, wrong, and unknown-user credentials;
  - the session lifecycle: create, look up, then delete;
  - an expired session returning null;
  - a token that's stored only as its hash.
- `npm run typecheck` and `npx eslint lib` are clean.

### Interaction 5 — Step 3: Session glue and proxy

**User Prompt**

> commit step 2 and start step 3

**Agent Outcome**

Step 2 was committed as `9b6cce9`. Step 3 adds:

- **[`lib/session.ts`](lib/session.ts)** (`import "server-only"`):
  - `SESSION_COOKIE = "cc_session"`.
  - `startSession(userId)` creates a DB session and sets the cookie. Options: `httpOnly`, `sameSite: "lax"`, `secure` in production, `path: "/"`, and a `maxAge` equal to the 30-day TTL.
  - `endSession()` deletes the DB row and the cookie.
  - `getCurrentUser()` is wrapped in React `cache()`.
  - `requireUser()` throws `GameError(401, "Sign in to play")`.
- **[`proxy.ts`](proxy.ts):**
  - Matches `/games/:path*`.
  - Without a `cc_session` cookie, it returns a 307 to `/?next=<pathname>`.
  - It's an optimistic check only. The page still validates the session against the DB in Step 7.
- **`lib/games-repo.ts`:** the `GameError` status union gains `401 | 403`. It's pulled forward from Step 5 because `requireUser` needs it.

**Rationale**

- **Combined helpers.** The plan named separate `setSessionCookie(token)` / `clearSessionCookie()` helpers. The agent combined each with its DB call into `startSession` and `endSession`, so callers can't create a session without its cookie, or clear a cookie and leave the session live.
- **Inlined cookie name.** `proxy.ts` defines the cookie name itself instead of importing `lib/session.ts`. The Next 16 `proxy.md` says Proxy shouldn't rely on shared modules, and `session.ts` pulls in `server-only` and the DB.

**Changes**

- Created:
  - `lib/session.ts`
  - `proxy.ts`
- Modified:
  - `lib/games-repo.ts`: `GameError` statuses.

**Verification**

- `npm run typecheck`, `npx eslint lib proxy.ts`, and `npm test` (42 passed) are clean.
- `next dev -p 3107`, checked with curl:

  | Request | Result |
  |---|---|
  | `/games/abc123`, no cookie | `307 → /?next=%2Fgames%2Fabc123` |
  | `/games/abc123`, any `cc_session` cookie | passes through |
  | `/` | 200 |
  | `/api/games/abc123` | not matched by the proxy, so the existing 404 JSON |
  | `/assets/avatars/avatar_tiger.png` | `200 image/png` |

  The dev log had no errors or warnings.
- **Not yet exercised:** `startSession`, `endSession`, `getCurrentUser`, and `requireUser` have no callers until Steps 4–6. For now they are checked only by the type checker.

### Interaction 6 — Step 4: Auth Server Actions

**User Prompt**

> commit step 3 and start step 4

**Agent Outcome**

Step 3 was committed as `65b8833`. Step 4 adds:

- **[`app/actions/auth.ts`](app/actions/auth.ts)** (`"use server"`):
  - `signup`, `login`, and `logout`. The first two have the `useActionState` signature `(prev, formData) => AuthFormState`.
  - `AuthFormState` carries `errors` (per field), a `message` (login failure), and `values` (the username and avatar echoed back), so the form keeps its input after a failed submit.
  - On success, an action calls `startSession`, then `redirect(safeNext(next))`. `redirect` is called outside any `try`, per `redirect.md`.
  - Login always returns the same message, "Wrong username or password".
- **[`lib/safe-next.ts`](lib/safe-next.ts):** `safeNext()` allows only same-site paths. It rejects `//host` and `/\host`, which browsers treat as protocol-relative, as well as absolute URLs and non-strings.
- **[`vitest.config.mts`](vitest.config.mts):** `resolve: { tsconfigPaths: true }`, a native Vite 8 option, so tests can import app code through the `@/` alias.

**Rationale**

- **Why `safeNext` is its own module.** A `"use server"` file may only export async functions, so the helper can't live in `auth.ts`. A separate module also makes it unit-testable.
- **Config file extension.** The config is `.mts` because the `.ts` name triggered Vite's "ESM syntax in a file loaded as CommonJS" warning. The package has no `"type": "module"`.

**Changes**

- Created:
  - `app/actions/auth.ts`
  - `app/actions/auth.test.ts`
  - `lib/safe-next.ts`
  - `lib/safe-next.test.ts`
  - `vitest.config.mts`

**Verification**

- `npm test`: 50 passed across 6 files.
- **`auth.test.ts`** runs the real actions against PGlite. Only `@/lib/session` and `next/navigation` are mocked: `redirect` throws a sentinel, and the test checks its target. It covers:
  - signup → session → redirect to `next`;
  - an off-site `next` → `/`;
  - field errors echoed back with no session started;
  - a taken username;
  - login with a wrong password, an unknown user, and success;
  - logout.
- `npm run typecheck` and `npx eslint app lib vitest.config.mts` are clean.
- **Not yet verified:** the real cookie write (`startSession` through `cookies()`) needs a browser or a form POST. That comes with the Step 7 UI walkthrough.

### Interaction 7 — Step 5: Player-aware games repository

**User Prompt**

> commit step 4 and start step 5

**Agent Outcome**

Step 4 was committed as `472f8ae`. Step 5 changes the following.

**Types**
- **[`lib/game/types.ts`](lib/game/types.ts):** adds `PlayerProfile { id, username, avatar }`. `Game` gains `red` / `blue: PlayerProfile | null`.
- **`lib/users-repo.ts`:** `User` is now an alias of `PlayerProfile`, so there's one shape for "an account the client may see".

**[`lib/games-repo.ts`](lib/games-repo.ts)**
- **`withPlayers(source)`:** a SQL fragment that `LEFT JOIN`s `users` twice onto either `games` or a write CTE (`ins` / `upd`). Every read and write returns full profiles in one round trip.
- **`seatOf(game, userId)`:** returns `"red"`, `"blue"`, or `null`. Exported for the UI.
- **`createGame(userId)`:** puts the creator in the red seat.
- **`joinGame(id, userId)` (new):** one guarded `UPDATE` fills the open seat, red first so legacy ownerless games work. It refuses a user who already holds the other seat, and it bumps `updated_at` so the opponent's poll sees the join.
  - When 0 rows match, the game is re-read to choose between 404, a no-op (already seated), and 409 (both seats taken).
- **`submitMove(id, userId, input)`:** the client-supplied `player` field is gone, and the seat comes from `userId`. Checks run in this order:
  1. a non-player gets 403;
  2. a finished game gets 409;
  3. while an opponent is missing, 409 "Waiting for an opponent to join";
  4. a stale `expectedMoveCount` gets 409;
  5. the wrong seat gets 409;
  6. then the existing ownership and legality checks.
  The guarded CTE write is unchanged.
- **`resetGame(id, userId)`:** a non-player gets 403, and a finished game gets 409, so its result stays in both players' history.
- **`listGamesForUser(userId, limit = 20)` (new):** returns `{ game, myColor }`, ordered by `updated_at DESC`.

**Attempted Approach / Resolution**

In the old `resetGame`, the `DELETE FROM moves` CTE ran unconditionally next to the `UPDATE`. Now that reset is guarded on `status = 'active'`, that ordering could erase a finished game's history if it lost a race. The delete now keys off the update's rows: `WHERE game_id IN (SELECT id FROM upd)`.

**Changes**

- Modified:
  - `lib/game/types.ts`
  - `lib/users-repo.ts`
  - `lib/games-repo.ts`
  - `lib/games-repo.test.ts`

**Tests** ([`lib/games-repo.test.ts`](lib/games-repo.test.ts))

- **Setup:** 3 users are seeded by SQL (no scrypt cost). A `startGame()` helper creates a game and has Blue join.
- **Updated:** the existing tests now pass user ids instead of `player`.
- **Added:**
  - the join flow: Blue seated, `updatedAt` bumped, a third user refused, rejoin a no-op, no double-seating, an ownerless game filling red first;
  - racing joiners;
  - waiting for an opponent before the first move;
  - 403 / 409 seat enforcement;
  - reset by a player, 403 for a non-player, 409 on a finished game with its history intact;
  - `listGamesForUser` ordering and `myColor`.
- **Caveat:** PGlite is single-connection, so the "racing" tests check the SQL guards, not true parallelism. The same was already true of the concurrent-move test.

**Verification**

- `npm test`: 59 passed.
- `npx eslint lib` is clean.
- **`npm run typecheck` fails as expected,** with 3 `TS2554` argument-count errors. They're in `app/api/games/route.ts`, `[id]/moves/route.ts`, and `[id]/reset/route.ts`, the call sites that Step 6 rewrites to pass `requireUser()`'s id.

### Interaction 8 — Step 6: API routes (committed together with Step 5)

**User Prompt**

> Make steps 5 and 6 in one commit

**Agent Outcome**

The agent offered a choice: commit Step 5 on its own, which would fail `tsc`, or fold it into Step 6. The user chose a single commit, so every commit on the branch typechecks.

- **Every handler under [`app/api/games/`](app/api/games/)** calls `requireUser()` inside `handle()`, so signed-out requests get a 401 `{ error: "Sign in to play" }`.
  - `POST /api/games` → `createGame(user.id)`.
  - `POST …/moves` → `submitMove(id, user.id, …)`. It no longer reads `player` from the body.
  - `POST …/reset` → `resetGame(id, user.id)`.
  - The GETs require sign-in but no seat, so spectators can still read.
- **[`app/api/games/[id]/join/route.ts`](app/api/games/[id]/join/route.ts) (new):** `POST` → `joinGame(id, user.id)`.
- **[`lib/api-client.ts`](lib/api-client.ts):** adds `joinGame`. `player` is removed from `SubmitMoveBody`.
- **[`components/GameClient.tsx`](components/GameClient.tsx):** a one-line removal of the `player` field it sent. This is pulled forward from Step 7 because the narrower `SubmitMoveBody` would otherwise fail `tsc`. The seat picker is still there; it goes in Step 7.

**Changes**

- Created: `app/api/games/[id]/join/route.ts`.
- Modified:
  - `app/api/games/route.ts`
  - `app/api/games/[id]/route.ts`
  - `[id]/moves/route.ts`
  - `[id]/reset/route.ts`
  - `lib/api-client.ts`
  - `components/GameClient.tsx`

**Verification**

- `npm run typecheck`, `npx eslint app lib components`, and `npm test` (59 passed) are clean.
- **End to end against Neon.** A scratch script seeded 3 throwaway users (`zzcheck_*`), each with a 1-hour session row. The agent then ran `next dev -p 3107` and sent curl requests with `cc_session` cookies:

  | Case | Result |
  |---|---|
  | Signed out, or a bogus cookie | 401 |
  | Red creates a game, then moves before Blue joins | 409 "Waiting for an opponent to join" |
  | Blue joins | 200, both usernames in the response |
  | Eve joins | 409 "Both seats in this game are taken" |
  | Eve moves | 403 |
  | Blue moves on Red's turn | 409 |
  | Red moves while sending `"player":"blue"` | 200; the field is ignored |
  | Eve resets | 403 |
  | Signed-out GET | 401 |
  | Eve GETs moves | 200 (spectator read) |

  The dev log had no errors. The script then deleted its game and users; their sessions went with them through `ON DELETE CASCADE`.

### Interaction 9 — Step 7: UI

**User Prompt**

> start step 7

**Agent Outcome**

Steps 5 and 6 were committed together as `00afb3e`. Step 7 builds the UI.

**Landing page and auth form**
- **[`app/page.tsx`](app/page.tsx):** the title and rules stay in the static shell. `HomePanel` is behind `<Suspense>` and reads the session:
  - **Signed out:** it renders `AuthForm` and passes through `?next`.
  - **Signed in:** it shows a welcome with the avatar, `NewGameButton`, and `GameHistory`.
- **The header** has a `<Suspense>`-wrapped `UserMenu`.
- **The copy** no longer says "No sign-up needed". The `layout.tsx` metadata changed too.
- **[`components/AuthForm.tsx`](components/AuthForm.tsx):**
  - Create account / Log in tabs, each a separate form with its own `useActionState`.
  - Inline field errors linked with `aria-describedby`, and input preserved through `state.values`.
  - A 5-tile avatar radio group. The selection ring uses `has-[:checked]`, with a focus outline.

**Shared components**
- **[`components/Avatar.tsx`](components/Avatar.tsx):** a `next/image` round avatar.
- **[`components/UserMenu.tsx`](components/UserMenu.tsx):** the avatar, the username, and a `<form action={logout}>`.
- **[`components/GameHistory.tsx`](components/GameHistory.tsx):** each row shows the opponent's avatar and name (or "Open seat"), your colour, the move count, the date, and a badge: Won, Lost, Your turn, Their turn, or Waiting for opponent.

**Game page**
- **[`app/games/[id]/page.tsx`](app/games/[id]/page.tsx):** `LoadedGame` checks the session for real and redirects to `/?next=/games/<id>` if it's invalid. It passes `viewer` to `GameClient`. The header gains `UserMenu`.
- **[`components/GameClient.tsx`](components/GameClient.tsx):**
  - Removed: the sessionStorage `useSeat` hook, `SEATS`, and the "This tab plays as" fieldset. This ends hot-seat play.
  - `mySeat = seatOf(game, viewer.id)`. A marble is selectable only if it's `mySeat`'s turn and both seats are filled.
  - New `handleJoin`.
  - Restart is shown only to a seated player while the game is active.
- **[`components/PlayersCard.tsx`](components/PlayersCard.tsx) (new):** both seats with avatars, a "(you)" marker, and a "to move" badge. Depending on the viewer, it shows a "Join as Blue/Red" button, a "send the link" hint, or "You're watching".
- **[`components/TurnIndicator.tsx`](components/TurnIndicator.tsx):** takes `mySeat` and uses usernames. It shows "Your turn", "Waiting for <name>…", "Waiting for an opponent", "You're watching", or "You win!".

**Library**
- **`seatOf` moved to [`lib/game/seats.ts`](lib/game/seats.ts).** In `lib/games-repo.ts` it would have pulled the DB driver into the client bundle.

**Attempted Approach / Resolution**

- **`new Date()` during rendering.** The first browser run logged Next errors: "encountered the unstable value `new Date()` while prerendering" on `/` and `/games/[id]`. The source was `findUserBySessionToken`'s `expires_at > $2` parameter, `new Date().toISOString()`. With Cache Components and partial prefetching, reading the clock while rendering is rejected even after `cookies()`.
  - **Fix:** compare against Postgres `now()`, which also makes the DB clock the single authority for expiry.
  - Unit tests are unaffected. The expired-session test sets `expires_at` with SQL.
- **Script issues, not app bugs.** The walkthrough script needed two fixes:
  - `getByText("Your turn")` also matched the landing page's rules text, because Next 16 keeps the previous route mounted but hidden (`<Activity>`). The match was made exact.
  - An `isVisible()` check ran before the streamed Suspense content arrived. It now uses `waitFor()`.
- **Unexplained hydration warning.** The first full run also logged one "attributes didn't match" hydration warning. It didn't recur in the two later clean runs. It's noted here, but no cause was identified.

**Changes**

- Created:
  - `components/AuthForm.tsx`
  - `components/Avatar.tsx`
  - `components/UserMenu.tsx`
  - `components/GameHistory.tsx`
  - `components/PlayersCard.tsx`
  - `lib/game/seats.ts`
- Modified:
  - `app/page.tsx`
  - `app/layout.tsx`
  - `app/games/[id]/page.tsx`
  - `components/GameClient.tsx`
  - `components/TurnIndicator.tsx`
  - `lib/games-repo.ts` (imports `seatOf`)
  - `lib/users-repo.ts` (`now()`)

**Verification**

- `npm run typecheck`, `npx eslint .`, and `npm test` (59 passed) are clean.
- **`next build` passes,** both before and after the `now()` fix. `/` and `/games/[id]` build as partial prerenders (◐), and the Proxy is registered.
- **Browser walkthrough.** The driver is `playwright-core@1.49.1` in the session scratchpad, running `/usr/bin/google-chrome` against `next dev -p 3107` and Neon. It's not a project dependency. There were 4 separate browser contexts, and the plan's Verification steps passed twice in a row after the fix:
  - **Signed out:** `/games/doesnotexist` redirects to `/?next=%2Fgames%2Fdoesnotexist`, and the form shows.
  - **Validation:** bad input shows both field errors and keeps the username.
  - **Sign-up:** A signs up with the tiger avatar, and the welcome appears. `cc_session` is `httpOnly` and `SameSite=Lax`, and the history is empty.
  - **A's new game:** A is red "(you)", the blue seat is open, and the screen says "Waiting for an opponent". A has 0 selectable marbles.
  - **Joining:** B opens the link while signed out and is redirected with `next`. B signs up with the rabbit avatar, returns to the same game URL, and clicks "Join as Blue". A's tab shows B in about 790 ms through polling.
  - **Turns:** A can select only red marbles, and B can select none on red's turn. Both moves went through, each player's turn following the other.
  - **Phone width:** no horizontal overflow at 390 px.
  - **Spectator:** a third account sees "You're watching this game.", with no Join or Restart button and 0 selectable marbles.
  - **Log out and back in:** logging out removes the cookie. A wrong password shows the generic error. Logging in with the username in upper case works, and the history row reads "vs <B> | You played red · 2 moves · Oct 15 | Your turn".
  - **Duplicate name:** B's name in upper case is rejected with "That username is taken".
  - **No console errors** on either clean run.
- **Screenshots** of the error state, the desktop game, the 390 px game, and the history were reviewed. They're in the scratchpad, not committed.
- **Cleanup:** a scratch script deleted all walkthrough data (17 `zzui_*` users, their sessions, and 6 games). Neon is left with the 5 original ownerless games and no users or sessions.
