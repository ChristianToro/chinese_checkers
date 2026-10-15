# Plan: Chinese Checkers (2-player) — Next.js demo

## Context
Greenfield demo: two people play Chinese Checkers in the browser, no login. `week_5/day_2` is empty (no git, no CLAUDE.md); Node 24.15 / npm 11.12 available. The backend is the authority: it validates moves, enforces turns, detects wins, and persists games + move history. Decisions confirmed with the user:
- **Storage:** SQLite via `better-sqlite3`
- **Play mode:** shareable `/games/[id]` link + ~2s polling (same-screen hot-seat still works)
- **Rules:** enforce the official "a marble can't leave its target triangle once it's in" rule (officialgamerules.org)

The project goes in a new subfolder `week_5/day_2/chinese-checkers/` (`create-next-app@latest`, TypeScript, App Router, Tailwind, ESLint). It uses `PROMPT-HISTORY.md` at that root (see the last section).

## Execution order (per user)
1. Scaffold `chinese-checkers/` with `create-next-app`. It refuses non-empty dirs, so this goes first.
2. Write this plan verbatim to `chinese-checkers/PLAN.md` (project root).
3. Implement the steps below, with edits manually approved.

## Board model — `lib/game/board.ts`
- Axial hex coords `(q, r)`, `s = -q-r`, key `"q,r"`. Star = union of two big triangles: `{q,r,s ≥ -4}` ∪ `{q,r,s ≤ 4}` → 91 + 91 − 61 = **121 cells** (assert in a test).
- 6 directions: `(1,0) (1,-1) (0,-1) (-1,0) (-1,1) (0,1)`.
- **Red** home = top triangle `r ≤ -5` (10 cells); **Blue** home = bottom triangle `r ≥ 5`. Each player's target = the opponent's home.
- Pointy-top pixel layout: `x = √3·(q + r/2)`, `y = 1.5·r` → rows of 1,2,3,4,13,12,11,10,9,10,…,1.
- Human-readable label per cell: `row-col` (row 1–17 top→bottom, col counted from the left of that row) for move history.

## Rules engine (pure, shared by client + server) — `lib/game/rules.ts`, `lib/game/types.ts`
- `Board = Record<CellKey, Player>` (empty cells absent); `Player = 'red' | 'blue'`.
- `initialBoard()` — 10 red marbles in the top triangle, 10 blue in the bottom.
- `legalMoves(board, from): Map<CellKey, { path: CellKey[]; kind: 'step' | 'jump' }>`
  - Steps: on-board, empty neighbor.
  - Jumps: BFS over chained hops (over an occupied adjacent cell, onto an empty cell beyond in a straight line; direction may change between hops; no revisiting). Records the parent so the path can be rebuilt. Every intermediate landing is a valid destination. A step can't be mixed with hops.
  - Target-triangle lock: if `from` is in the mover's target triangle, every landing (step or hop) must stay inside it.
  - If a cell is reachable both ways, it's reported as a step.
- `applyMove(board, from, to)` → new board.
- `winner(board)` — a player wins when all 10 target cells are filled with their marbles. **Anti-spoiling edge case:** they also win if every target cell is occupied and at least one marble there is theirs. Without this, an opponent marble left at home could block the win forever.
- `hasAnyMove(board, player)` — if the next player has no legal move, the turn passes back. This is practically unreachable, but it keeps the game from deadlocking.

## Persistence — `lib/db.ts`, `lib/games-repo.ts`
- `better-sqlite3` singleton on `globalThis` (survives dev hot-reload). File at `data/chinese-checkers.db` (git-ignored). The path can be overridden with `DB_PATH` (tests use `:memory:`). WAL mode. The schema is created on first connect.
- Schema:
  - `games(id TEXT PK, board TEXT /*JSON*/, current_player TEXT, status TEXT /*'active'|'finished'*/, winner TEXT NULL, move_count INTEGER, created_at TEXT, updated_at TEXT)`
  - `moves(id INTEGER PK AUTOINCREMENT, game_id TEXT REFERENCES games ON DELETE CASCADE, move_number INTEGER, player TEXT, from_cell TEXT, to_cell TEXT, path TEXT /*JSON*/, kind TEXT, created_at TEXT, UNIQUE(game_id, move_number))`
- Repo functions: `createGame()`, `getGame(id)`, `listMoves(id)`, `resetGame(id)` (clears moves, restores the initial board; same id so the shared link keeps working), `submitMove(id, {from, to, player?, expectedMoveCount?})`. `submitMove` runs inside a single `db.transaction`: load → validate turn/ownership/legality → apply → detect winner → advance turn → insert the move → update the game.
- Ids from `crypto.randomUUID()` (short slice is fine for URLs).
- Next already lists `better-sqlite3` in its default `serverExternalPackages`. API routes run on the Node runtime. Fallback if the native module fails to install: switch to built-in `node:sqlite` behind the same `lib/db.ts` interface, and tell the user.

## API (App Router route handlers; `params` is a Promise in Next 15+)
| Method | Route | File | Response |
|---|---|---|---|
| POST | `/api/games` | `app/api/games/route.ts` | 201 `{ game }` |
| GET | `/api/games/:id` | `app/api/games/[id]/route.ts` | `{ game }` / 404 |
| POST | `/api/games/:id/moves` | `app/api/games/[id]/moves/route.ts` | `{ game, move }`; 400 illegal move / bad body; 409 wrong turn, game finished, or stale `expectedMoveCount`; 404 |
| GET | `/api/games/:id/moves` | same file | `{ moves }` |
| POST | `/api/games/:id/reset` | `app/api/games/[id]/reset/route.ts` | `{ game }` |

`game` = `{ id, board, currentPlayer, status, winner, moveCount, createdAt, updatedAt }`. Errors = `{ error: string }`. The request body is validated by hand: cell keys must be on-board strings, and `player` must be red or blue.

## Frontend
- `app/page.tsx` — title, short rules blurb, **New Game** button → `POST /api/games` → `router.push('/games/[id]')`.
- `app/games/[id]/page.tsx` — server component that loads the game (404 → `notFound()`) and renders `<GameClient initialGame=… />`.
- `components/GameClient.tsx` (client) holds React state: `game`, `moves`, `selected`, `highlights` (from `legalMoves`), `pending`, `error`, and `seat` (`'both' | 'red' | 'blue'`, saved per tab in `localStorage`; it's a convenience guard only, since there's no auth).
  - Clicking your own marble selects it and highlights its destinations. Clicking a highlight sends `POST …/moves` with `{from, to, player, expectedMoveCount}`. Clicking elsewhere deselects. The server's response replaces state. Errors show in a dismissible banner.
  - Polling: `GET /api/games/:id` every 2s while the tab is visible and no move is pending. When `moveCount` changes, it refetches moves and clears any stale selection.
  - Controls: **New Game** (creates a new game and navigates), **Restart** (`/reset`), **Copy link**.
- `components/Board.tsx` — one SVG: star background polygon, colored triangle tints for the two homes, 121 holes, red/blue marbles with radial-gradient shading, ring on the selected marble, dots on legal destinations, and a faint path line for the last move.
- `components/TurnIndicator.tsx` — whose turn it is, or a winner banner.
- `components/MoveHistory.tsx` — numbered list, e.g. `12. Blue 15-3 → 11-4 (jump ×3)`.
- `lib/api-client.ts` — typed fetch helpers.

## Tooling & tests
- `vitest` dev dependency, `npm test` script.
- `lib/game/rules.test.ts`: 121 cells, initial 10+10 placement, step, single jump, chained jump with a direction change, no jump over an empty cell or off the board, no revisit loops, target-triangle lock, win detection, anti-spoiling win, no-move pass.
- `lib/games-repo.test.ts` (`DB_PATH=:memory:`): create → move → wrong-turn 409 → illegal 400 → history order → reset clears history.

## Prompt history
The user invoked `/prompt-history`; that's the opt-in. At `chinese-checkers/` root:
- Create `PROMPT-HISTORY.md` with the reference header and `## Session: 2026-10-14`. Interaction 1 records the task prompt (abbreviated with marker), the 3 clarifying decisions the user made, the plan, and its outcome. Later interactions are added as work proceeds.
- Add the opt-in line to the project's `CLAUDE.md` (create it, or append if create-next-app generated one) so future sessions keep the log.

## Verification
1. `npm test` — rules + repo tests pass.
2. `npm run lint` and `npx tsc --noEmit` — clean.
3. `npm run dev`, then curl the full API flow: create → GET → legal move → wrong-turn (409) → illegal (400) → GET moves → reset.
4. Use the `run` skill to drive the UI: select a marble, check the highlights, make a chained jump, confirm the history entry and the turn switch. Open the same link in a second tab and confirm polling syncs it. Restart and New Game.
5. `npm run build` succeeds (catches server/client boundary issues with `better-sqlite3`).
