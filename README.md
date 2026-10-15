# Chinese Checkers

A two-player Chinese Checkers demo built with Next.js 16. No login. Play hot-seat on one screen, or share the game link and play from two browsers.

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # rules engine + repository tests (Vitest)
npm run typecheck
npm run lint
```

Games live in a local SQLite file at `data/chinese-checkers.db`, which is git-ignored and created on first use. Set `DB_PATH` to use a different file, or `:memory:`.

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
| SQLite connection + schema (`games`, `moves`) | `lib/db.ts` |
| Game sessions: create/get/reset, transactional move submission | `lib/games-repo.ts` |
| API route handlers | `app/api/games/**/route.ts` |
| UI: SVG board, turn indicator, move history, polling | `components/` |

The client uses the shared rules only to highlight destinations. The server re-validates every move: turn order, marble ownership, legality, and an optional `expectedMoveCount` concurrency check.

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
