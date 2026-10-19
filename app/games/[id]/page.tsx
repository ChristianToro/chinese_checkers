import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import GameClient from "@/components/GameClient";
import UserMenu from "@/components/UserMenu";
import { getGame, listMoves } from "@/lib/games-repo";
import { getCurrentUser } from "@/lib/session";

export default function GamePage({ params }: PageProps<"/games/[id]">) {
  return (
    <main className="flex w-full flex-1 flex-col">
      <header className="border-b border-black/10 dark:border-white/10">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="text-lg font-bold tracking-tight">
            Chinese Checkers
          </Link>
          <div className="flex items-center gap-4">
            <Suspense>
              {params.then(({ id }) => (
                <span className="hidden font-mono text-xs opacity-60 sm:inline">game {id}</span>
              ))}
            </Suspense>
            <Suspense>
              <UserMenu />
            </Suspense>
          </div>
        </div>
      </header>
      <Suspense fallback={<p className="p-8 text-center opacity-60">Loading game…</p>}>
        {params.then(({ id }) => (
          <LoadedGame id={id} />
        ))}
      </Suspense>
    </main>
  );
}

async function LoadedGame({ id }: { id: string }) {
  // Game state is per-request data that changes between requests; render at
  // request time rather than letting the query be prerendered.
  await connection();
  // proxy.ts only checks that a cookie exists; this checks the session is real.
  const viewer = await getCurrentUser();
  if (!viewer) redirect(`/?${new URLSearchParams({ next: `/games/${id}` })}`);
  const game = await getGame(id);
  if (!game) notFound();
  return (
    <GameClient key={id} initialGame={game} initialMoves={await listMoves(id)} viewer={viewer} />
  );
}
