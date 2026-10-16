# Plan: Dark board-game-café UI rework, animated hero, and game-flow CTA

## Context
The app works (accounts, two-browser games, history), but the UI is a plain light/dark-default Tailwind look. The landing page is a title, the auth form, and a rules list. The user wants:
- a more engaging landing page with a **hero**: a minimal looping animation of a Chinese Checkers board being played, under the headline **"Six points. Sixty marbles. One link to play!"**;
- the **CTA is the game flow itself**, not a "Get started" button: (1) make a free account / log in, (2) send the invite, (3) a small player-move tracker table with simulated data;
- a visual direction like a **cozy, premium board-game café, in dark tones**.

Decisions confirmed with the user (2026-10-15):

| Decision | Choice |
|---|---|
| Scope | The whole app gets the new theme: landing, game page, board, cards, move history, not-found |
| Invite step | Illustration of the existing share link. No backend change, no invite codes |
| Hero board | All six colours, 60 marbles, a decorative six-player loop on the real board geometry |

Defaults chosen without asking:
- **Dark only.** The light palette and `prefers-color-scheme` switch go away; `color-scheme: dark` is set.
- **Type:** Fraunces (serif display, `next/font/google`) for headings; Geist Sans stays for UI and Geist Mono for move logs.
- **No new dependencies.** Animation is SVG + CSS transitions driven by a small React timer.
- The hero and the CTA's move tracker play **the same scripted game in sync**, so the table visibly logs the moves happening on the board.
- `prefers-reduced-motion`: the hero shows a still mid-game frame and the tracker shows its rows without ticking.

## Execution protocol (user's standing instruction)
- Save this plan as `PLAN-UI.md` at the repo root.
- **Each step below is one milestone.** Stop after it, summarize what changed and how it was checked, and wait for review.
- Commit an approved milestone on `refactor/UI`, then start the next. Never push.
- Before writing code, read `node_modules/next/dist/docs/01-app/01-getting-started/13-fonts.md` and `11-css.md` (Next 16.4 differs from training data).

## Palette and tokens (`app/globals.css`, Tailwind v4 `@theme`)
Café-at-night tones, defined once and used as Tailwind colours (`bg-surface`, `text-muted`, `border-line`, …):
- `--color-ink` #120d0a (page, espresso) · `--color-surface` #1d1510 (cards, walnut) · `--color-raised` #2a1f17
- `--color-line` rgba(232,200,150,.12) · `--color-cream` #f1e6d3 (text) · `--color-muted` #b4a288
- `--color-brass` #d4a254 / `--color-brass-strong` #e8bb6a (accent, focus rings, primary buttons)
- `--color-felt` #1c3229 (the table the board sits on)
- Body background: espresso with a warm radial "lamp glow" near the top (pure CSS gradient).

Marble palette, one source for game and hero: ruby, sapphire, jade, topaz, amethyst, pearl, each with `base / light / dark / tint`. The game's Red and Blue map to ruby and sapphire.

## Step 0: Housekeeping (milestone 0)
- Write `PLAN-UI.md`.
- `PROMPT-HISTORY.md` (via the `prompt-history` skill the user invoked): open a "Session: 2026-10-15 (UI rework)" heading and log this request, the three decisions, and the plan. Keep it updated at each milestone.

## Step 1: Design foundation and shared chrome (milestone 1)
- `app/globals.css`: the tokens above, dark-only, `color-scheme: dark`, lamp-glow background, `.font-display` for Fraunces, a `@media (prefers-reduced-motion)` guard for any keyframes.
- `app/layout.tsx`: add Fraunces via `next/font/google` as `--font-display`; update metadata description.
- New `components/ui.ts`: the shared class strings that are currently copy-pasted (amber button appears in `AuthForm`, `NewGameButton`, `GameClient`, `PlayersCard`): `card`, `buttonPrimary`, `buttonSecondary`, `input`, `eyebrow`, `alertError`.
- New `components/SiteHeader.tsx`: star mark + serif "Chinese Checkers" wordmark linking home, an optional slot (game id on the game page), and `<UserMenu />` behind `<Suspense>`. Used by both pages; replaces the two hand-built headers.
- Restyle with the tokens: `Avatar` (brass ring), `UserMenu`, `AuthForm`, `NewGameButton`, `GameHistory` (outcome pills in brass / jade / muted).
- The landing page keeps its current structure in this step, so the theme lands separately from the redesign.

## Step 2: Board art and the game page (milestone 2)
- New `components/board-art.tsx`, extracted from `components/Board.tsx` so the hero can reuse it: `UNIT`, `MARBLE_R`, `HOLE_R`, `px`, `axialPx`, `padTriangle`, `STAR_TRIANGLES`, `VIEW_BOX`, the `MARBLES` palette, `<MarbleGradients ids=…/>`, and `<StarBackdrop homes=…/>` (walnut star, brass rim, tinted home triangles, dark recessed holes).
- `components/Board.tsx` keeps all its interaction logic and renders through `board-art`. Selection ring becomes brass; the last-move trail turns cream.
- `components/GameClient.tsx`, `PlayersCard.tsx`, `TurnIndicator.tsx`, `MoveHistory.tsx`: tokens and `ui.ts` classes. The board sits on a felt "table" panel. The turn indicator gets a soft glow in the mover's marble colour. The winner banner is brass.
- `app/games/[id]/page.tsx` uses `SiteHeader` (game id in its slot). `app/games/[id]/not-found.tsx` restyled.
- No behaviour changes: polling, join, restart, copy link are untouched.

## Step 3: Scripted demo game (milestone 3, pure logic + tests)
- `lib/game/rules.ts`: extract the step/hop search inside `legalMoves` into an exported `reachableFrom(isOccupied, from, allowed)`; `legalMoves` becomes a thin wrapper. The existing `rules.test.ts` guards the refactor.
- New `lib/demo/script.ts`:
  - `SIX_POINTS`: the six star points as axial predicates (`r ≤ -5`, `r ≥ 5`, `q ≥ 5`, `q ≤ -5`, `s ≥ 5`, `s ≤ -5`), each paired with its opposite and a marble colour; 6 × 10 = 60 marbles.
  - `DEMO_PLAYERS`: six made-up usernames, one per colour.
  - `DEMO_SCRIPT`: computed once at module load. About 36 moves (six rounds), each a greedy, deterministic choice (seeded tie-break) using `reachableFrom`, picking the move that best closes distance to the opposite point so the opening looks purposeful, with long hop chains.
  - Marbles carry stable ids so the renderer can animate them; `framesAt(moveIndex, hopIndex)` returns marble positions.
- New `lib/demo/script.test.ts`: 60 marbles at the start, 10 per point; every scripted hop is a legal step or jump on the board at that time; no two marbles ever share a hole; the script is deterministic.

## Step 4: Landing page hero and CTA flow (milestone 4)
- New `components/landing/DemoPlayback.tsx` (client): a context provider that owns the playback clock (`moveIndex`, `hopIndex`): one hop about every 380 ms, a pause between moves, a hold and fade at the end, then the loop restarts. It pauses while the tab is hidden and stays still under `prefers-reduced-motion` (read with `useSyncExternalStore` on `matchMedia`). The first render is frame 0, so server and client markup match.
- New `components/landing/HeroBoard.tsx`: renders `StarBackdrop` plus 60 marbles as `<g>` elements positioned by CSS `transform` with a short transition, so each hop glides. `role="img"` and a label describing the animated six-player game.
- New `components/landing/MoveTracker.tsx`: a compact `<table>` (#, player dot + name, `from → to` with `cellLabel`, step / jump ×n) showing the latest ~6 scripted moves; new rows ease in. Caption: "Simulated game: the moves on the board above".
- New `components/landing/InviteCard.tsx`: an illustration of step 2, a sample `…/games/k3f9q2` link with a "Copy link" chip and a "mei joined as Blue" toast. Non-interactive; marked as an example.
- `app/page.tsx` rewritten:
  1. `SiteHeader`.
  2. **Hero:** eyebrow ("A board game café in your browser"), H1 *Six points. Sixty marbles. One link to play!* in Fraunces, one line of subcopy, and `HeroBoard` on a felt table with lamp glow. Two columns on `lg`, stacked on mobile (board under the headline).
  3. **"Pull up a chair": the CTA flow**, three numbered steps:
     - **1 · Take a seat:** signed out, the real `AuthForm` ("Make a free account" / "Log in" tabs, `next` param kept); signed in, avatar + "Welcome back" + `NewGameButton` ("Open a new table"). This stays inside the existing `<Suspense>` `HomePanel`, so the static shell (hero, steps 2–3) still prerenders under `cacheComponents`.
     - **2 · Send the invite:** `InviteCard`.
     - **3 · Follow every move:** `MoveTracker`.
     `DemoPlayback` wraps the hero and the flow so the tracker and board stay in sync.
  4. **Signed in:** "Your games" (`GameHistory`). **Signed out:** "House rules", the existing `RULES` as a menu-card styled list. The game itself is still two-player; the copy says so plainly here.
- Layout works at 375 px with no horizontal scroll; the board scales with `w-full`.

## Step 5: Docs and polish (milestone 5)
- `README.md`: a short "Look and feel" note (dark café theme, hero is a scripted six-player demo while play is two-player) and the new files in the Architecture table (`components/board-art.tsx`, `lib/demo/script.ts`, `components/landing/*`).
- A final pass on focus states (brass rings), contrast of `muted` text on `surface`, and reduced motion.

## Critical files
- Modified: `app/globals.css`, `app/layout.tsx`, `app/page.tsx`, `app/games/[id]/page.tsx`, `app/games/[id]/not-found.tsx`, `components/Board.tsx`, `GameClient.tsx`, `PlayersCard.tsx`, `TurnIndicator.tsx`, `MoveHistory.tsx`, `AuthForm.tsx`, `NewGameButton.tsx`, `GameHistory.tsx`, `UserMenu.tsx`, `Avatar.tsx`, `lib/game/rules.ts`, `README.md`
- New: `components/ui.ts`, `components/SiteHeader.tsx`, `components/board-art.tsx`, `lib/demo/script.ts` (+ test), `components/landing/{DemoPlayback,HeroBoard,MoveTracker,InviteCard}.tsx`, `PLAN-UI.md`
- Reused as is: `lib/game/board.ts` (`CELLS`, `CELL_MAP`, `neighbor`, `DIRECTIONS`, `cellLabel`), `lib/avatars.ts`, `app/actions/auth.ts`, all API routes and repos.

## Verification (each milestone)
- `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` (the build confirms the landing shell still prerenders with `cacheComponents`).
- Run `npm run dev` and check in a browser at desktop width and 375 px: hero loops and the tracker logs the same moves; reduced motion (DevTools emulation) gives a still frame; signing up, logging in and the `?next=` redirect still work; on the game page, two accounts in two browsers can create, join, move, and see polling updates, with the restyled board.
- Anything not actually checked is reported as unchecked.
