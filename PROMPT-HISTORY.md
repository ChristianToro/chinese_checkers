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
