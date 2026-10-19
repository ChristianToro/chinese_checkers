import Link from "next/link";
import type { GameSummary } from "@/lib/games-repo";
import Avatar from "./Avatar";

const DOT = { red: "bg-red-600", blue: "bg-blue-600" } as const;

const dateFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });

function outcome({ game, myColor }: GameSummary): { label: string; className: string } {
  const opponent = myColor === "red" ? game.blue : game.red;
  if (game.status === "finished") {
    return game.winner === myColor
      ? { label: "Won", className: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-200" }
      : { label: "Lost", className: "bg-black/5 dark:bg-white/10" };
  }
  if (!opponent) return { label: "Waiting for opponent", className: "bg-black/5 dark:bg-white/10" };
  return game.currentPlayer === myColor
    ? { label: "Your turn", className: "bg-amber-100 text-amber-950 dark:bg-amber-500/15 dark:text-amber-100" }
    : { label: "Their turn", className: "bg-black/5 dark:bg-white/10" };
}

/** The signed-in user's recent games, newest activity first. */
export default function GameHistory({ games }: { games: GameSummary[] }) {
  return (
    <section className="w-full rounded-2xl border border-black/10 bg-white p-6 text-left shadow-sm dark:border-white/10 dark:bg-white/5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide opacity-70">Your games</h2>
      {games.length === 0 ? (
        <p className="text-sm opacity-70">No games yet. Start one and send the link to a friend.</p>
      ) : (
        <ul className="-mx-2 divide-y divide-black/5 dark:divide-white/10">
          {games.map((summary) => {
            const { game, myColor } = summary;
            const opponent = myColor === "red" ? game.blue : game.red;
            const { label, className } = outcome(summary);
            return (
              <li key={game.id}>
                <Link
                  href={`/games/${game.id}`}
                  className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition hover:bg-black/5 dark:hover:bg-white/5"
                >
                  {opponent ? (
                    <Avatar avatar={opponent.avatar} size={36} />
                  ) : (
                    <span className="size-9 shrink-0 rounded-full border-2 border-dashed border-black/20 dark:border-white/20" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {opponent ? `vs ${opponent.username}` : "Open seat"}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs opacity-60">
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
