import type { Game, Player } from "@/lib/game/types";
import type { Seat } from "./GameClient";

const DOT: Record<Player, string> = {
  red: "bg-red-600",
  blue: "bg-blue-600",
};

const NAME: Record<Player, string> = { red: "Red", blue: "Blue" };

export default function TurnIndicator({ game, seat }: { game: Game; seat: Seat }) {
  if (game.status === "finished" && game.winner) {
    return (
      <div className="rounded-xl border border-amber-400 bg-amber-100 px-4 py-3 text-amber-950 dark:border-amber-500/60 dark:bg-amber-500/15 dark:text-amber-100">
        <p className="flex items-center gap-2 text-lg font-semibold">
          <span className={`inline-block size-4 rounded-full ${DOT[game.winner]}`} />
          {NAME[game.winner]} wins!
        </p>
        <p className="text-sm opacity-80">
          All target holes filled after {game.moveCount} moves.
        </p>
      </div>
    );
  }

  const player = game.currentPlayer;
  const waiting = seat !== "both" && seat !== player;
  return (
    <div
      className="rounded-xl border border-black/10 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-white/5"
      aria-live="polite"
    >
      <p className="flex items-center gap-2 text-lg font-semibold">
        <span className={`inline-block size-4 rounded-full ${DOT[player]}`} />
        {NAME[player]}&apos;s turn
      </p>
      <p className="text-sm opacity-70">
        {waiting
          ? `Waiting for ${NAME[player]} to move…`
          : "Pick a marble, then a highlighted hole."}
      </p>
    </div>
  );
}
