import Link from "next/link";
import type { GameSummary } from "@/lib/games-repo";
import Avatar from "./Avatar";
import { card, eyebrow } from "./ui";

const DOT = { red: "bg-red-500", blue: "bg-blue-500" } as const;

const QUIET = "bg-raised text-muted";

const dateFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });

function outcome({ game, myColor }: GameSummary): { label: string; className: string } {
  const opponent = myColor === "red" ? game.blue : game.red;
  if (game.status === "finished") {
    return game.winner === myColor
      ? { label: "Won", className: "bg-emerald-400/15 text-emerald-200" }
      : { label: "Lost", className: QUIET };
  }
  if (!opponent) return { label: "Waiting for opponent", className: QUIET };
  return game.currentPlayer === myColor
    ? { label: "Your turn", className: "bg-brass/15 text-brass-strong" }
    : { label: "Their turn", className: QUIET };
}

/** The signed-in user's recent games, newest activity first. */
export default function GameHistory({ games }: { games: GameSummary[] }) {
  return (
    <section className={`${card} w-full p-6 text-left`}>
      <h2 className={`${eyebrow} mb-3`}>Your games</h2>
      {games.length === 0 ? (
        <p className="text-sm text-muted">No games yet. Start one and send the link to a friend.</p>
      ) : (
        <ul className="-mx-2 divide-y divide-line">
          {games.map((summary) => {
            const { game, myColor } = summary;
            const opponent = myColor === "red" ? game.blue : game.red;
            const { label, className } = outcome(summary);
            return (
              <li key={game.id}>
                <Link
                  href={`/games/${game.id}`}
                  className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition hover:bg-raised/70 focus-visible:outline-2 focus-visible:outline-brass"
                >
                  {opponent ? (
                    <Avatar avatar={opponent.avatar} size={36} />
                  ) : (
                    <span className="size-9 shrink-0 rounded-full border-2 border-dashed border-muted/40" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {opponent ? `vs ${opponent.username}` : "Open seat"}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-muted">
                      <span className={`inline-block size-2 rounded-full ${DOT[myColor]}`} aria-hidden />
                      You played {myColor} · {game.moveCount} {game.moveCount === 1 ? "move" : "moves"} ·{" "}
                      {dateFormat.format(new Date(game.updatedAt))}
                    </span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>
                    {label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
