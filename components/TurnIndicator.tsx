import type { Game, Player } from "@/lib/game/types";
import { MarbleDot, PLAYER_MARBLE, tint } from "./board-art";
import { card } from "./ui";

const NAME: Record<Player, string> = { red: "Red", blue: "Blue" };

/** The player's username, falling back to the colour for an open seat. */
function nameOf(game: Game, player: Player): string {
  return game[player]?.username ?? NAME[player];
}

export default function TurnIndicator({ game, mySeat }: { game: Game; mySeat: Player | null }) {
  if (game.status === "finished" && game.winner) {
    return (
      <div className="rounded-2xl border border-brass/60 bg-brass/10 px-4 py-3 text-brass-strong shadow-[0_0_40px_-12px_rgb(212_162_84/0.6)]">
        <p className="flex items-center gap-2 font-display text-xl font-semibold">
          <MarbleDot color={PLAYER_MARBLE[game.winner]} className="size-4" />
          {game.winner === mySeat ? "You win!" : `${nameOf(game, game.winner)} wins!`}
        </p>
        <p className="text-sm text-cream/80">
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

  const color = PLAYER_MARBLE[player];
  return (
    <div
      className={`${card} px-4 py-3 transition-shadow`}
      style={ready ? { boxShadow: `0 0 0 1px ${tint(color, 0.35)}, 0 0 36px -10px ${tint(color, 0.65)}` } : undefined}
      aria-live="polite"
    >
      <p className="flex items-center gap-2 font-display text-xl font-semibold">
        <MarbleDot color={color} className="size-4" />
        {heading}
      </p>
      <p className="text-sm text-muted">{detail}</p>
    </div>
  );
}
