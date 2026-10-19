import type { Game, Player } from "@/lib/game/types";
import Avatar from "./Avatar";

const DOT: Record<Player, string> = { red: "bg-red-600", blue: "bg-blue-600" };
const NAME: Record<Player, string> = { red: "Red", blue: "Blue" };

interface PlayersCardProps {
  game: Game;
  mySeat: Player | null;
  pending: boolean;
  onJoin: () => void;
}

/** Both seats, whose turn it is, and a way to take an open seat. */
export default function PlayersCard({ game, mySeat, pending, onJoin }: PlayersCardProps) {
  const openSeat = !game.red ? "red" : !game.blue ? "blue" : null;
  return (
    <section
      aria-label="Players"
      className="rounded-xl border border-black/10 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-white/5"
    >
      <ul className="space-y-2">
        {(["red", "blue"] as const).map((color) => {
          const player = game[color];
          const toMove = game.status === "active" && game.currentPlayer === color && !openSeat;
          return (
            <li key={color} className="flex items-center gap-3">
              <span className={`inline-block size-3 shrink-0 rounded-full ${DOT[color]}`} aria-hidden />
              {player ? (
                <Avatar avatar={player.avatar} size={32} />
              ) : (
                <span className="size-8 shrink-0 rounded-full border-2 border-dashed border-black/20 dark:border-white/20" />
              )}
              <span className="min-w-0 flex-1 truncate">
                <span className="sr-only">{NAME[color]}: </span>
                {player ? (
                  <>
                    <span className="font-medium">{player.username}</span>
                    {mySeat === color && <span className="opacity-60"> (you)</span>}
                  </>
                ) : (
                  <span className="opacity-60">Open seat</span>
                )}
              </span>
              {toMove && (
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-950 dark:bg-amber-500/15 dark:text-amber-100">
                  to move
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {openSeat && !mySeat && (
        <button
          type="button"
          onClick={onJoin}
          disabled={pending}
          className="mt-3 w-full rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:opacity-50"
        >
          Join as {NAME[openSeat]}
        </button>
      )}
      {openSeat && mySeat && (
        <p className="mt-3 text-xs opacity-70">
          Copy the link and send it to your opponent. The game starts when they join.
        </p>
      )}
      {!openSeat && !mySeat && (
        <p className="mt-3 text-xs opacity-70">You&apos;re watching this game.</p>
      )}
    </section>
  );
}
