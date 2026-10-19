"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, api } from "@/lib/api-client";
import { legalMoves } from "@/lib/game/rules";
import { seatOf } from "@/lib/game/seats";
import type { CellKey, Game, Move, MoveOption, Player, PlayerProfile } from "@/lib/game/types";
import Board from "./Board";
import MoveHistory from "./MoveHistory";
import PlayersCard from "./PlayersCard";
import TurnIndicator from "./TurnIndicator";

const POLL_MS = 2000;
const NO_MOVES: ReadonlyMap<CellKey, MoveOption> = new Map();

const buttonClass =
  "rounded-lg border border-black/15 bg-white px-3 py-2 text-sm font-medium shadow-sm transition hover:bg-black/5 disabled:opacity-50 dark:border-white/15 dark:bg-white/10 dark:hover:bg-white/15";

interface GameClientProps {
  initialGame: Game;
  initialMoves: Move[];
  /** The signed-in user; their seat (if any) comes from the game, not this tab. */
  viewer: PlayerProfile;
}

export default function GameClient({ initialGame, initialMoves, viewer }: GameClientProps) {
  const router = useRouter();
  const [game, setGame] = useState(initialGame);
  const [moves, setMoves] = useState(initialMoves);
  const [selected, setSelected] = useState<CellKey | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const mySeat = seatOf(game, viewer.id);
  const ready = !!game.red && !!game.blue;

  const gameRef = useRef(game);
  const pendingRef = useRef(false);
  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  const canMove = useCallback(
    (player: Player) =>
      game.status === "active" && ready && player === game.currentPlayer && player === mySeat,
    [game.status, game.currentPlayer, ready, mySeat],
  );

  const selectable = useCallback(
    (key: CellKey) => {
      const occupant = game.board[key];
      return !!occupant && canMove(occupant);
    },
    [game.board, canMove],
  );

  // A selection goes stale if the board changes underneath it (e.g. via polling).
  const activeSelection = selected && selectable(selected) ? selected : null;
  const highlights = useMemo(
    () => (activeSelection ? legalMoves(game.board, activeSelection) : NO_MOVES),
    [game.board, activeSelection],
  );

  const syncFromServer = useCallback(async (latest: Game) => {
    setGame(latest);
    setSelected(null);
    const { moves } = await api.getMoves(latest.id);
    setMoves(moves);
  }, []);

  // Pick up moves made in other tabs or browsers.
  useEffect(() => {
    const timer = window.setInterval(async () => {
      if (document.hidden || pendingRef.current) return;
      try {
        const { game: latest } = await api.getGame(gameRef.current.id);
        if (!pendingRef.current && latest.updatedAt > gameRef.current.updatedAt) {
          await syncFromServer(latest);
        }
      } catch {
        // Transient; the next tick retries.
      }
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [syncFromServer]);

  async function run(action: () => Promise<void>) {
    pendingRef.current = true;
    setPending(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      // 409 means our view is out of date (turn changed, game reset, game over).
      if (err instanceof ApiError && err.status === 409) {
        try {
          const { game: latest } = await api.getGame(game.id);
          await syncFromServer(latest);
        } catch {
          // Keep the error banner; polling will catch up.
        }
      }
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  function handleCellClick(key: CellKey) {
    if (pending) return;
    if (activeSelection && highlights.has(key)) {
      const from = activeSelection;
      void run(async () => {
        const result = await api.submitMove(game.id, {
          from,
          to: key,
          expectedMoveCount: game.moveCount,
        });
        setGame(result.game);
        setMoves((prev) => [...prev, result.move]);
        setSelected(null);
      });
      return;
    }
    setSelected(key !== activeSelection && selectable(key) ? key : null);
  }

  function handleNewGame() {
    void run(async () => {
      const { game: created } = await api.createGame();
      router.push(`/games/${created.id}`);
    });
  }

  function handleJoin() {
    void run(async () => {
      const { game: joined } = await api.joinGame(game.id);
      setGame(joined);
    });
  }

  function handleRestart() {
    if (!window.confirm("Restart this game? The board and move history are cleared for everyone.")) {
      return;
    }
    void run(async () => {
      const { game: fresh } = await api.resetGame(game.id);
      setGame(fresh);
      setMoves([]);
      setSelected(null);
    });
  }

  function handleCopyLink() {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => setError("Couldn't copy the link; copy it from the address bar."));
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex items-start justify-center">
        <Board
          board={game.board}
          selected={activeSelection}
          highlights={highlights}
          selectable={selectable}
          lastPath={moves.at(-1)?.path ?? null}
          disabled={pending}
          onCellClick={handleCellClick}
        />
      </div>

      <aside className="flex min-w-0 flex-col gap-4">
        <TurnIndicator game={game} mySeat={mySeat} />

        <PlayersCard game={game} mySeat={mySeat} pending={pending} onJoin={handleJoin} />

        {error && (
          <div
            role="alert"
            className="flex items-start justify-between gap-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="font-semibold opacity-70 hover:opacity-100"
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleNewGame}
            disabled={pending}
            className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:opacity-50"
          >
            New Game
          </button>
          {/* Finished games stay as they ended, so they read right in history. */}
          {mySeat && game.status === "active" && (
            <button type="button" onClick={handleRestart} disabled={pending} className={buttonClass}>
              Restart
            </button>
          )}
          <button type="button" onClick={handleCopyLink} className={buttonClass}>
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>

        <MoveHistory moves={moves} />
      </aside>
    </div>
  );
}
