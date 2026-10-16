import { Suspense } from "react";
import AuthForm from "@/components/AuthForm";
import Avatar from "@/components/Avatar";
import GameHistory from "@/components/GameHistory";
import NewGameButton from "@/components/NewGameButton";
import SiteHeader from "@/components/SiteHeader";
import { card, eyebrow } from "@/components/ui";
import { listGamesForUser } from "@/lib/games-repo";
import { getCurrentUser } from "@/lib/session";

const RULES = [
  "Red starts in the top point of the star, Blue in the bottom point. Each has 10 marbles.",
  "On your turn, move one marble to an adjacent empty hole, or hop over a neighbouring marble (any colour) into the empty hole beyond.",
  "Hops can be chained in one turn, changing direction as you go. You can stop after any hop.",
  "Once a marble reaches the opposite point it can't leave it again.",
  "The first player to fill the opposite point wins.",
];

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center gap-8 px-4 pb-12 pt-4 text-center sm:pt-8">
        <div className="flex items-center gap-3" aria-hidden>
          <span className="size-6 rounded-full bg-gradient-to-br from-red-300 via-red-600 to-red-900 shadow" />
          <span className="size-6 rounded-full bg-gradient-to-br from-blue-300 via-blue-600 to-blue-900 shadow" />
        </div>
        <div className="space-y-3">
          <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">Chinese Checkers</h1>
          <p className="text-lg text-muted">
            A two-player game across two screens. Every game you play is saved to your history.
          </p>
        </div>

        <Suspense fallback={<p className="py-8 text-muted">Loading…</p>}>
          <HomePanel searchParams={searchParams} />
        </Suspense>

        <section className={`${card} w-full p-6 text-left`}>
          <h2 className={`${eyebrow} mb-3`}>How to play</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed marker:text-brass">
            {RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}

/** Reads the session, so it streams in behind the page's static shell. */
async function HomePanel({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const user = await getCurrentUser();
  if (!user) {
    const { next } = await searchParams;
    return <AuthForm next={typeof next === "string" ? next : undefined} />;
  }

  const games = await listGamesForUser(user.id);
  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="flex items-center gap-3">
        <Avatar avatar={user.avatar} size={48} />
        <p className="text-lg">
          Welcome back, <span className="font-semibold">{user.username}</span>
        </p>
      </div>
      <NewGameButton />
      <GameHistory games={games} />
    </div>
  );
}
