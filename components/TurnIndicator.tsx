import type { Game, Player } from "@/lib/game/types";

const DOT: Record<Player, string> = {
  red: "bg-red-600",
  blue: "bg-blue-600",
};

const NAME: Record<Player, string> = { red: "Red", blue: "Blue" };

/** The player's username, falling back to the colour for an open seat. */
function nameOf(game: Game, player: Player): string {
  return game[player]?.username ?? NAME[player];
}

export default function TurnIndicator({ game, mySeat }: { game: Game; mySeat: Player | null }) {
  if (game.status === "finished" && game.winner) {
    return (
      <div className="rounded-xl border border-amber-400 bg-amber-100 px-4 py-3 text-amber-950 dark:border-amber-500/60 dark:bg-amber-500/15 dark:text-amber-100">
        <p className="flex items-center gap-2 text-lg font-semibold">
          <span className={`inline-block size-4 rounded-full ${DOT[game.winner]}`} />
          {game.winner === mySeat ? "You win!" : `${nameOf(game, game.winner)} wins!`}
        </p>
        <p className="text-sm opacity-80">
          All target holes filled after {game.moveCount} moves.
        </p>
      </div>
    );
  }

  const ready = !!game.red && !!game.blue;
  const player = game.currentPlayer;
  let heading = `${nameOf(game, player)}'s turn`;
  let detail = "You're watching.";
  if (!ready) {
    heading = "Waiting for an opponent";
    detail = "Red moves first once both seats are filled.";
  } else if (mySeat === player) {
    heading = "Your turn";
    detail = "Pick a marble, then a highlighted hole.";
  } else if (mySeat) {
    detail = `Waiting for ${nameOf(game, player)} to move…`;
  }

  return (
    <div
      className="rounded-xl border border-black/10 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-white/5"
      aria-live="polite"
    >
      <p className="flex items-center gap-2 text-lg font-semibold">
        <span className={`inline-block size-4 rounded-full ${DOT[player]}`} />
        {heading}
      </p>
      <p className="text-sm opacity-70">{detail}</p>
    </div>
  );
}
