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

### Interaction 5 — Milestone 4: landing hero and the game-flow CTA

**User Prompt**

> Milestone approved. Commit and start milestone 4

**Agent Outcome**

Milestone 3 was committed as `bbe4dff`. Milestone 4 rebuilds the landing page in [`app/page.tsx`](app/page.tsx):
- **Hero:**
  - an eyebrow line ("A board game café in your browser");
  - the headline *Six points. Sixty marbles. One link to play!* in Fraunces, with the last clause in brass italic;
  - one line of copy and a quiet "Pull up a chair ↓" anchor (there is deliberately no "Get started" button);
  - the animated six-player board on a felt table under a blurred lamplight glow.
- **"Pull up a chair" flow** (`#play`), three numbered steps. Step 1 spans two rows on `lg`, and the steps stack on mobile:
  1. **Take a seat.** Signed out, it shows the real `AuthForm`, and the `?next=` pass-through still works. Signed in, it shows the avatar, "Welcome back", and `NewGameButton` labelled "Open a new table". It stays behind `Suspense`, so the rest of the page is still in the static shell.
  2. **Send the invite.** [`InviteCard`](components/landing/InviteCard.tsx) is a non-interactive example: a `…/games/k3f9q2` link with a "Copied!" chip and a "sol joined as Blue" toast, which matches the demo's sapphire player.
  3. **Follow every move.** [`MoveTracker`](components/landing/MoveTracker.tsx) is a fixed-height table of the latest six scripted moves. A row is logged the moment its marble sets off, new rows ease in, and the newest is brass-tinted.
- **Below the flow:** "Your games" (`GameHistory`) when signed in. Signed out, a numbered "House rules" card, whose first rule now says plainly that real games are two-player.

New supporting pieces:
- [`DemoPlayback`](components/landing/DemoPlayback.tsx) is a client context provider that owns the playback clock `{ move, hop, fading }`. It advances one hop every 420 ms, pauses 650 ms between moves, then holds, fades, and loops. It pauses while the tab is hidden and shows a still frame (move 18) under `prefers-reduced-motion`, both read with `useSyncExternalStore`. The hero and the tracker share it, so they stay in sync.
- [`HeroBoard`](components/landing/HeroBoard.tsx) draws 60 `Marble`s as `<g>` elements positioned by CSS `transform`, so each hop glides. The moving marble scales up slightly, and the current path is drawn as a dashed trail. On reset, the transform transition is dropped so marbles fade back in place instead of flying home.
- [`FeltTable`](components/FeltTable.tsx) is the felt panel, now shared by the hero and `GameClient`.
- `app/globals.css` gains the `row-in` keyframes as the `animate-row-in` theme utility.

**Rationale**

One clock in a context, rather than two timers, keeps the tracker's "simulated data" exactly in step with the board. Positions come from `positionsAt` snapshots, so each frame is a lookup, not a replay.

**Changes**

- New: `components/landing/DemoPlayback.tsx`, `HeroBoard.tsx`, `MoveTracker.tsx`, `InviteCard.tsx`, `components/FeltTable.tsx`
- Modified: `app/page.tsx`, `app/globals.css`, `components/GameClient.tsx`

**Verification**

```bash
npm run lint && npm run typecheck && npm test   # clean; 74 tests passed
npm run build                                   # / still partially prerendered
```

Against `next start`, using headless Chrome with `--virtual-time-budget`:
- **Desktop, 1280 px, at about 15 s:** the board was mid-game, the tracker's newest row was move 16 (sol, jump ×3), and the dashed trail on the board was that same move.
- **Mobile, 375 px:** the hero stacks above the steps, the table fits, and there is no horizontal scroll.
- **`--force-prefers-reduced-motion`:** after 8 s the tracker still showed the still frame's moves 13–18.
- **Redirects:** `/?next=/games/abc123` puts `next` into the auth form's hidden input, and `/games/abc123` without a cookie still 307s to `/?next=%2Fgames%2Fabc123`.

The signed-in landing (step 1 "Open a new table" and the history list) was **not** checked in a browser, because that needs a Neon account.

### Interaction 6 — Milestone 5: README and polish

**User Prompt**

> Approved. Commit then start milestone 5

**Agent Outcome**

Milestone 4 was committed as `aefea86`. Milestone 5 finishes `PLAN-UI.md`:
- **README:**
  - A new "Look and feel" section covers the dark-only café theme and its token names, and the fonts. It says the hero is a scripted six-player loop while real games are two-player, how the script is built (seeded, from `reachableFrom`), and that reduced motion shows a still frame.
  - "Start a game" now names **Open a new table**.
  - The test-command comment mentions the demo script.
  - The Architecture table gains rows for `components/board-art.tsx`, `components/ui.ts` + `SiteHeader.tsx`, `lib/demo/script.ts`, and `components/landing/`.
- **Contrast:** WCAG ratios were computed for the theme pairs. Muted on surface, raised, ink, and felt is 5.5–7.8:1; brass on ink is 8.4:1, and ink on brass 8.4:1. The one failure was `text-muted/70` on a surface (4.18:1), used for move numbers in `MoveHistory`; it now uses `text-muted`.
- **Focus:**
  - Board cells used `focus-visible:opacity-80`, which barely shows on the dark board. The hit-area circle now draws a cream ring on keyboard focus (`group-focus-visible:stroke-cream`), distinct from the brass selection ring. Its radius stays at `MARBLE_R + 4`; a first try at `+6` would have overlapped the neighbouring holes' hit areas.
  - The error banner's dismiss button gains a brass focus outline in place of an opacity fade.
- **Reduced motion:** already covered by the global CSS guard (which also stops the board's `animate-pulse` targets) and by `DemoPlayback`'s still frame, which was checked in milestone 4. Nothing changed.

**Changes**

- Modified: `README.md`, `components/Board.tsx`, `components/MoveHistory.tsx`, `components/GameClient.tsx`

**Verification**

```bash
npm run lint && npm run typecheck && npm test   # clean; 74 tests passed
npm run build                                   # / still partially prerendered; the focus-ring rule is in the built CSS
```

The keyboard focus ring was **not** checked in a browser. It only appears on a playable board, which needs a signed-in game.

The user approved milestone 5, which was committed as `a56872c`. The user pushes the branch themselves.

### Session Summary

**Completed**

- [`PLAN-UI.md`](PLAN-UI.md) was carried out on `refactor/UI` as six reviewed milestones: `4114257` (plan), `87d8314` (theme and header), `763e416` (board art and game page), `bbe4dff` (demo script), `aefea86` (landing page), `a56872c` (README and polish).
- A dark-only "board game café" theme across the app: Tailwind theme tokens, Fraunces headings, shared `ui.ts` classes, a shared `SiteHeader`, and boards on a felt `FeltTable`.
- Shared board art (`components/board-art.tsx`) with a six-colour marble palette, used by both the playable board and the hero.
- A landing page with the requested headline, a looping six-player hero board, and a three-step CTA flow: the real auth form, an illustrated invite link, and a move tracker logging the hero's moves in sync.

**Key Decisions**

- The user chose to retheme the whole app, to illustrate the existing share link instead of building invite codes, and to show six colours and 60 marbles in the hero.
- The hero is a deterministic, precomputed script built from the real move search (`reachableFrom`, extracted from `legalMoves`). It is scored by on-screen distance so its moves look purposeful.
- One playback clock (`DemoPlayback`) drives both the hero and the tracker. Reduced motion shows a still frame, and the loop pauses in hidden tabs.
- There is no "Get started" button. The CTA is the flow itself, as the user asked.

**Verification**

- Lint, typecheck, 74 Vitest tests (5 of them new, for the demo script), and `next build` passed at every milestone. `/` and `/games/[id]` stayed partially prerendered.
- Headless-Chrome screenshots of the signed-out landing page at 1280 px and 375 px, a reduced-motion run, a hero/tracker sync check, and static renders of the board and the demo frames.
- The `?next=` sign-in redirect was rechecked against `next start`.

**Open Items**

- Not checked in a browser, because each needs accounts in the Neon database: the signed-in landing page ("Open a new table", "Your games"), the restyled game page during two-account play (players card, turn glow, polling), and the board's keyboard focus ring. A `npm run dev` pass with two accounts would cover all three.

---

## Session: 2026-10-16 (UI rework, continued)

**Objective:** Follow-ups after the UI rework was closed.

### Interaction 7 — Copy link copies only the game path

**User Prompt**

> I established a work-around to avoid having to deploy the application with a service like vercel: using a Cloudflare quick tunnel, I can send a remote user a game session I start for them to participate in when I run `npm build && npm start` from my machine. The DB is allowing for the interaction to occur live.
>
> One change will help facilitate this process: the `share link` button should only copy `/game/[id]` instead of the entire localhost path. Since a tunnel provided url changes each instance, I will affix it when I share with a different user. Make this change.

**Agent Outcome**

`handleCopyLink` in [`components/GameClient.tsx`](components/GameClient.tsx) now copies `` `/games/${game.id}` `` instead of `window.location.href`. The user's host plays on `localhost`, while the remote player reaches the app through a quick-tunnel URL that changes every run. The copy-failure message now says "game path". The README's "Invite an opponent" bullet explains that the button copies a path, and that the sharer puts the site's address in front.

**Rationale**

The path is built from the game id rather than read from `window.location.pathname`, so the copied value can't pick up a query string or anything else from the current URL. The route is `/games/[id]`, plural, so the copied path uses that rather than the `/game/[id]` written in the prompt.

**Changes**

- `components/GameClient.tsx`: copy the path only.
- `README.md`: the "Invite an opponent" bullet.

**Verification**

```bash
npm run lint && npm run typecheck && npm test   # clean; 74 tests passed
```

The clipboard write was not exercised in a browser; it needs a signed-in game page.
