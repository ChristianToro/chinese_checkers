import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import GameClient from "@/components/GameClient";
import { getGame, listMoves } from "@/lib/games-repo";

export default function GamePage({ params }: PageProps<"/games/[id]">) {
  return (
    <main className="flex w-full flex-1 flex-col">
      <header className="border-b border-black/10 dark:border-white/10">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-lg font-bold tracking-tight">
            Chinese Checkers
          </Link>
          <Suspense>
            {params.then(({ id }) => (
              <span className="font-mono text-xs opacity-60">game {id}</span>
            ))}
          </Suspense>
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
  const game = await getGame(id);
  if (!game) notFound();
  return <GameClient key={id} initialGame={game} initialMoves={await listMoves(id)} />;
}
