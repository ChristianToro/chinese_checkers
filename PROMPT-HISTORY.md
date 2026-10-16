# Prompt History

This document records meaningful development interactions between the user and
AI coding agents working on this project. It focuses on requests, outcomes,
implementation decisions, verification, and human-agent collaboration rather
than preserving a raw conversation transcript.

Generated code is included verbatim when reasonably concise. Extensive
implementations are referenced through their canonical repository files.

> This file is an engineering collaboration record, not a source of truth for
> application behavior. The repository itself remains authoritative.

> Prior history: [PROMPT-HISTORY-2026-Q4.md](PROMPT-HISTORY-2026-Q4.md). It covers the SQLite
> build, the Neon migration, and the authentication work (2026-10-14 to 2026-10-15).

`PLAN.md`, `PLAN-NEON.md`, and `PLAN-AUTH.md` are the approved design snapshots for those phases.

---

## Session: 2026-10-15 (Authentication, continued)

**Objective:** Follow-ups to the authentication work. The earlier part of this session, Interactions 1–11, is in [PROMPT-HISTORY-2026-Q4.md](PROMPT-HISTORY-2026-Q4.md). That file was rotated after the session summary.

### Interaction 12 — README: accounts and game history

**User Prompt**

> update the README to describe accounts and game history

**Agent Outcome**

[`README.md`](README.md) had last been updated for the Neon version. It still said "No login. Play hot-seat on one screen". It now covers:
- **Intro:** accounts across two browsers, and the history. `main` is described as the earlier no-login, hot-seat SQLite version.
- **A new "Accounts and game history" section:**
  - sign-up rules (username and password limits, and that usernames are unique ignoring case);
  - log in and log out;
  - New Game as Red, then Copy link and Join as Blue;
  - that only the seat holder moves, and others can watch;
  - the "Your games" list and its states;
  - that restarts are limited to unfinished games;
  - the sign-in redirect for game links.
- **Setup:** re-run `npm run db:migrate` on an existing database to add `users`, `sessions`, and the seat columns.
- **Architecture:** rows for `lib/users-repo.ts` + `lib/password.ts`, `lib/session.ts`, `app/actions/auth.ts`, and `proxy.ts`. A move-validation note says the seat comes from the session, and an "Authentication" paragraph covers scrypt, hashed session tokens, the cookie flags, and that `proxy.ts` is only an optimistic check.
- **API:** every endpoint needs a session, and the `red` / `blue` player shape is described. Adds `POST /api/games/:id/join`, drops `player?` from the move body, and states the reset restriction. The status list now includes `401` and `403` and the new `409` cases.

**Changes**

- `README.md`

**Verification**

Documentation only. The agent checked each claim against the code before writing it: the validation limits in `lib/users-repo.ts`, the error statuses and messages in `lib/games-repo.ts` and `lib/session.ts`, the cookie options, and the route list from `next build`. No tests were run, since no code changed.

**Collaboration**

This picks up the README open item from the session summary.

---

## Session: 2026-10-15 (UI rework)

**Objective:** Rework the UI on branch `refactor/UI`: a dark, cozy board-game-café theme across the app, plus a landing page with an animated hero and a CTA that walks through the actual game flow. Planned in [`PLAN-UI.md`](PLAN-UI.md).

### Interaction 1 — UI rework request and plan

**User Prompt**

> The UI and interface needs rework.
>
> There needs to be a more engaging landing page with a HERO section: an minimal looping asset of a chinese checkerboard being played. Headline should be "Six points. Sixty marbles. One link to play!
>
> Make the CTA the actual game flow, not a get started (make free account/log in, send invite code, small player-move tracker table with simulated data)
>
> The visual direction should resemble a cozy, premium board game cafe, with dark tones.

**Agent Outcome**

Read the current UI (`app/page.tsx`, `components/*`, `app/globals.css`, `app/layout.tsx`) and wrote a five-milestone plan, saved as [`PLAN-UI.md`](PLAN-UI.md):
0. Housekeeping: plan file and this log.
1. Design foundation: dark-only café tokens in `app/globals.css`, Fraunces display font, shared class strings in `components/ui.ts`, a shared `SiteHeader`, and restyled auth/history components.
2. Board art and game page: geometry and a six-colour marble palette pulled out of `Board.tsx` into `components/board-art.tsx`; game page restyled with no behaviour change.
3. Scripted demo game: `reachableFrom()` extracted from `legalMoves` in `lib/game/rules.ts`; `lib/demo/script.ts` precomputes a deterministic six-player opening on the real board, with tests.
4. Landing page: animated `HeroBoard` and a three-step "Pull up a chair" flow: the real auth form, an illustrated invite link, and a `MoveTracker` table that logs the hero's scripted moves in sync.
5. README and polish.

**Rationale**

The hero and the tracker share one precomputed script and one playback clock, so the "simulated data" in the table is visibly the game on the board. Board geometry is shared rather than duplicated so the hero and the real board look the same.

**Collaboration**

The agent asked three questions, and the user chose the recommended option each time:
- **Scope:** retheme the whole app, not only the landing page.
- **Invite step:** illustrate the existing share link. Real short invite codes were offered and declined, so there is no backend change.
- **Hero:** all six colours and 60 marbles, to match the headline, even though play stays two-player.

Without asking, the agent chose dark-only (no light mode), Fraunces with Geist, no new dependencies, and a still frame under `prefers-reduced-motion`. The user approved the plan. It follows the user's standing milestone protocol from earlier phases: review and commit each step on `refactor/UI`, and never push.

**Changes**

- `PLAN-UI.md` (new): the approved plan.
- `PROMPT-HISTORY.md`: this session.

**Verification**

Planning only; no code changed.

### Interaction 2 — Milestone 1: café theme foundation and shared header

**User Prompt**

> commit it and start milestone 1

**Agent Outcome**

Milestone 0 was committed as `4114257`. Milestone 1 sets up the dark café look without yet changing the landing page's layout:
- **Theme tokens** in [`app/globals.css`](app/globals.css), as Tailwind v4 `@theme` colours: `ink`, `surface`, `raised`, `line`, `cream`, `muted`, `brass`, `brass-strong`, and `felt`. The body has an espresso background with a warm radial "lamp glow". A `prefers-reduced-motion` guard shortens animations and transitions.
- **Dark only.** The light palette is gone. `dark:` is redefined as a class variant, and `<html>` carries `dark`, so the game-page components that still use `dark:` classes (restyled in milestone 2) never flip to light on a light-mode OS.
- **Fraunces** (variable, `opsz` and `SOFT` axes) is loaded in [`app/layout.tsx`](app/layout.tsx) as `--font-display`, so Tailwind's `font-display` class is available. Geist stays for UI text.
- [`components/ui.ts`](components/ui.ts) (new): shared class strings `card`, `buttonPrimary`, `buttonSecondary`, `input`, `eyebrow`, `alertError`, and `fieldError`. Sizes are left to callers so conflicting padding utilities never meet.
- [`components/SiteHeader.tsx`](components/SiteHeader.tsx) (new): a sticky header with a brass star mark, a Fraunces wordmark linking home, a slot for page extras, and `UserMenu` behind `Suspense`. It replaces the hand-built headers on `/` and `/games/[id]` (the game id goes in the slot).
- Restyled with the tokens: `AuthForm`, `Avatar` (cream fill, brass ring), `UserMenu` (the username hides below `sm`), `NewGameButton` (gains an optional `label` prop for milestone 4), and `GameHistory` (brass "Your turn", emerald "Won", muted pills otherwise).

**Changes**

- New: `components/ui.ts`, `components/SiteHeader.tsx`
- Modified: `app/globals.css`, `app/layout.tsx`, `app/page.tsx`, `app/games/[id]/page.tsx`, `components/AuthForm.tsx`, `components/Avatar.tsx`, `components/UserMenu.tsx`, `components/NewGameButton.tsx`, `components/GameHistory.tsx`

**Verification**

```bash
npm run lint && npm run typecheck && npm test   # clean; 69 tests passed
npm run build                                   # / and /games/[id] still partially prerendered
```

The signed-out landing page was screenshotted with headless Chrome against `next start`, at 1280 px and 375 px wide. The theme, the header, and the auth form render correctly, with no horizontal scroll. The signed-in views (history list, header user menu) and the game page were **not** checked visually, because that needs a test account in the Neon database.

### Interaction 3 — Milestone 2: board art and the game page

**User Prompt**

> commit it and start milestone 2

**Agent Outcome**

Milestone 1 was committed as `87d8314`. Milestone 2 restyles the board and game page with no change to how the game behaves:
- [`components/board-art.tsx`](components/board-art.tsx) (new) holds the board's look, so the playable board and the milestone 4 hero share it:
  - geometry (`UNIT`, `MARBLE_R`, `HOLE_R`, `px`, `VIEW_BOX`);
  - a six-colour marble palette (`MARBLES`: ruby, sapphire, jade, topaz, amethyst, pearl), with `PLAYER_MARBLE` mapping Red → ruby and Blue → sapphire;
  - SVG pieces: `MarbleGradients`, `Marble` (contact shadow and glint), and `StarBackdrop` (walnut star with a brass rim, tinted home points, recessed holes);
  - `MarbleDot`, a CSS marble for lists.
- Home-point outlines are now derived from any point's ten cells: the three cells farthest from the centroid are the corners. The hard-coded red and blue corners are gone, which lets the hero tint all six points.
- [`components/Board.tsx`](components/Board.tsx) keeps its interaction logic. Holes moved into `StarBackdrop`. The selection ring is brass and the last-move trail is cream.
- `GameClient` puts the board on a felt "table" panel and uses the `ui.ts` button and alert classes.
- `TurnIndicator` glows in the mover's marble colour, and its winner banner is brass. `PlayersCard`, `MoveHistory`, and `GameHistory` use `MarbleDot` and the theme tokens. The not-found page uses Fraunces.
- The `dark:` class variant and the `dark` class on `<html>` were removed. They were milestone 1's stopgap, and no `dark:` classes are left.

**Changes**

- New: `components/board-art.tsx`
- Modified: `components/Board.tsx`, `GameClient.tsx`, `TurnIndicator.tsx`, `PlayersCard.tsx`, `MoveHistory.tsx`, `GameHistory.tsx`, `app/games/[id]/not-found.tsx`, `app/globals.css`, `app/layout.tsx`

**Verification**

```bash
npm run lint && npm run typecheck && npm test   # clean; 69 tests passed
npm run build                                   # / and /games/[id] still partially prerendered
```

The board was rendered with `renderToStaticMarkup` from a throwaway Vitest harness in the session scratchpad (not in the repo), on a felt background, with Red's corner marble selected. A headless-Chrome screenshot showed the marbles, the brass selection ring, the ruby target rings, and the tinted home points as intended. The full game page (players card, turn glow, polling, two-account play) was **not** checked in a browser, because that needs accounts in the Neon database.

### Interaction 4 — Milestone 3: scripted six-player demo game

**User Prompt**

> commit it and start milestone 3

**Agent Outcome**

Milestone 2 was committed as `763e416`. Milestone 3 adds the game logic the landing hero will replay. It is pure code and adds no UI yet.
- **`reachableFrom(isOccupied, from, allowed)`** in [`lib/game/rules.ts`](lib/game/rules.ts): the step and hop-chain search, taken out of `legalMoves` and blind to colour. `legalMoves` is now a thin wrapper that adds the "stay inside your target once there" restriction. The moving marble's own hole always counts as empty, so callers don't have to remove it from the board first.
- **[`lib/demo/script.ts`](lib/demo/script.ts)** (new):
  - `DEMO_SEATS`: the six star points clockwise from the top (ruby, topaz, jade, sapphire, amethyst, pearl), each with a made-up username, a home, and the opposite point as its target. Top and bottom match the real game's Red and Blue.
  - `START`, `MARBLE_SEATS`: 60 marbles with stable ids, so the renderer can animate them.
  - `DEMO_SCRIPT`: 36 moves (six rounds), computed once at module load. Each turn picks the move that gains the most ground toward the target's tip, with ties broken by a seeded mulberry32 PRNG, so every visitor sees the same game.
  - `positionsAt(moveIndex, hop)`: marble positions part-way through a hop chain, read from precomputed snapshots.
- **[`lib/demo/script.test.ts`](lib/demo/script.test.ts)** (new), 5 tests:
  - 60 marbles start in six disjoint ten-hole points, and every home is exactly one seat's target;
  - six rounds in seat order;
  - every step goes to an adjacent empty hole, every hop goes over an occupied hole onto an empty one, and two marbles never share a hole;
  - `positionsAt` advances one hole per hop;
  - the script is deterministic.

**Attempted Approach / Resolution**

The first scoring used hex-step distance to the target's tip. A dump of the script showed hop chains that were "progress" in hex terms but went sideways or backwards on screen. One amethyst move ended in the bottom point. Scoring now uses straight-line distance in the drawn layout (`CELL_MAP` x/y). The resulting script has hop chains of 1–5 (12 single hops, 13 doubles, and 11 of three or more), and they get longer as the centre fills.

**Changes**

- New: `lib/demo/script.ts`, `lib/demo/script.test.ts`
- Modified: `lib/game/rules.ts`

**Verification**

```bash
npm run lint && npm run typecheck && npm test   # clean; 74 tests passed (69 before + 5 new)
```

The existing 40 rules tests passed unchanged after the `reachableFrom` refactor. The start, middle (move 18), and end positions were rendered with `StarBackdrop` and `Marble` in a scratchpad harness and screenshotted. All six points are tinted, and the marbles visibly cross toward their opposite points.
