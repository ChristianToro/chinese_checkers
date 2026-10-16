import type { Game, Player } from "@/lib/game/types";
import Avatar from "./Avatar";
import { MarbleDot, PLAYER_MARBLE } from "./board-art";
import { buttonPrimary, card } from "./ui";

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
      className={`${card} px-4 py-3`}
    >
      <ul className="space-y-2">
        {(["red", "blue"] as const).map((color) => {
          const player = game[color];
          const toMove = game.status === "active" && game.currentPlayer === color && !openSeat;
          return (
            <li key={color} className="flex items-center gap-3">
              <MarbleDot color={PLAYER_MARBLE[color]} />
              {player ? (
                <Avatar avatar={player.avatar} size={32} />
              ) : (
                <span className="size-8 shrink-0 rounded-full border-2 border-dashed border-muted/40" />
              )}
              <span className="min-w-0 flex-1 truncate">
                <span className="sr-only">{NAME[color]}: </span>
                {player ? (
                  <>
                    <span className="font-medium">{player.username}</span>
                    {mySeat === color && <span className="text-muted"> (you)</span>}
                  </>
                ) : (
                  <span className="text-muted">Open seat</span>
                )}
              </span>
              {toMove && (
                <span className="shrink-0 rounded-full bg-brass/15 px-2 py-0.5 text-xs font-semibold text-brass-strong">
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
          className={`${buttonPrimary} mt-3 w-full px-3 py-2 text-sm`}
        >
          Join as {NAME[openSeat]}
        </button>
      )}
      {openSeat && mySeat && (
        <p className="mt-3 text-xs text-muted">
          Copy the link and send it to your opponent. The game starts when they join.
        </p>
      )}
      {!openSeat && !mySeat && (
        <p className="mt-3 text-xs text-muted">You&apos;re watching this game.</p>
      )}
    </section>
  );
}
