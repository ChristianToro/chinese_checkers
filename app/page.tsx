import Link from "next/link";
import type { ReactNode } from "react";
import { Suspense } from "react";
import Avatar from "@/components/Avatar";
import FeltTable from "@/components/FeltTable";
import GameHistory from "@/components/GameHistory";
import NewGameButton from "@/components/NewGameButton";
import SiteHeader from "@/components/SiteHeader";
import DemoPlayback from "@/components/landing/DemoPlayback";
import HeroBoard from "@/components/landing/HeroBoard";
import InviteCard from "@/components/landing/InviteCard";
import MoveTracker from "@/components/landing/MoveTracker";
import SignInDemo from "@/components/landing/SignInDemo";
import { buttonPrimary, card, eyebrow } from "@/components/ui";
import { listGamesForUser } from "@/lib/games-repo";
import { getCurrentUser } from "@/lib/session";

const RULES = [
  "Two players, two screens. Red starts in the top point of the star, Blue in the bottom point, ten marbles each.",
  "On your turn, move one marble to an adjacent empty hole, or hop over a neighbouring marble (any colour) into the empty hole beyond.",
  "Hops can be chained in one turn, changing direction as you go. You can stop after any hop.",
  "Once a marble reaches the opposite point it can't leave it again.",
  "The first player to fill the opposite point wins.",
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex w-full flex-1 flex-col">
        <DemoPlayback>
          <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pb-12 pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14 lg:pb-20 lg:pt-16">
            <div className="text-center lg:text-left">
              <p className={eyebrow}>A board game café in your browser</p>
              <h1 className="mt-4 text-balance font-display text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
                Six points. Sixty marbles.{" "}
                <span className="italic text-brass">One link to play!</span>
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted lg:mx-0">
                Pull up a chair for Chinese Checkers across two screens. Open a table, send the
                link, and play. Every game is kept in your history.
              </p>
              <a
                href="#play"
                className="mt-8 inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-brass-strong transition hover:text-cream focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass"
              >
                Pull up a chair <span aria-hidden>↓</span>
              </a>
            </div>
            <div className="relative">
              {/* Lamplight pooling on the table. */}
              <div
                aria-hidden
                className="absolute inset-x-[8%] -top-[6%] bottom-[10%] rounded-full bg-brass/20 blur-3xl"
              />
              <FeltTable className="relative p-3 sm:p-6">
                <HeroBoard />
              </FeltTable>
            </div>
          </section>

          <section id="play" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 pb-16">
            <div className="text-center lg:text-left">
              <p className={eyebrow}>Pull up a chair</p>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                From hello to first hop in three moves
              </h2>
            </div>
            <ol className="mt-10 grid gap-6 lg:grid-cols-2 lg:grid-rows-[auto_1fr]">
              <Step n={1} title="Take a seat" blurb="Make a free account or log in." className="lg:row-span-2">
                <Suspense fallback={<p className="py-8 text-muted">Loading…</p>}>
                  <Seat />
                </Suspense>
              </Step>
              <Step n={2} title="Send the invite" blurb="One link is all your opponent needs.">
                <div className={`${card} p-5`}>
                  <InviteCard />
                </div>
              </Step>
              <Step n={3} title="Follow every move" blurb="Each hop is logged as it happens.">
                <div className={`${card} p-5`}>
                  <MoveTracker />
                </div>
              </Step>
            </ol>
          </section>
        </DemoPlayback>

        <Suspense>
          <TableNotes />
        </Suspense>
      </main>
    </>
  );
}

function Step({
  n,
  title,
  blurb,
  className = "",
  children,
}: {
  n: number;
  title: string;
  blurb: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <li className={`flex min-w-0 flex-col gap-4 ${className}`}>
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-full border border-brass/50 bg-brass/10 font-display text-lg font-semibold text-brass-strong"
        >
          {n}
        </span>
        <div>
          <h3 className="font-display text-xl font-semibold">
            <span className="sr-only">Step {n}: </span>
            {title}
          </h3>
          <p className="text-sm text-muted">{blurb}</p>
        </div>
      </div>
      {children}
    </li>
  );
}

/**
 * Step 1: a simulated log in that offers "Get started" on hover, or a way to
 * start a game once seated. Reads the session.
 */
async function Seat() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className={`${card} group relative flex flex-1 flex-col justify-center p-5`}>
        <SignInDemo />
        {/* With a mouse the button fades in over the card; on touch it sits below. */}
        <div className="mt-5 flex justify-center can-hover:pointer-events-none can-hover:absolute can-hover:inset-0 can-hover:mt-0 can-hover:items-center can-hover:rounded-2xl can-hover:bg-ink/65 can-hover:opacity-0 can-hover:backdrop-blur-[2px] can-hover:transition-opacity can-hover:duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
          {/* The ::after stretches the link over the whole card, so any click on it counts. */}
          <Link
            href="/login"
            className={`${buttonPrimary} pointer-events-auto px-8 py-3 text-lg after:absolute after:inset-0 after:rounded-2xl`}
          >
            Get started
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div className={`${card} flex flex-col items-center gap-5 p-8 text-center`}>
      <Avatar avatar={user.avatar} size={72} />
      <div>
        <p className="font-display text-2xl font-semibold">Welcome back, {user.username}</p>
        <p className="mt-1 text-sm text-muted">
          You&apos;re seated. Open a table and you&apos;ll play Red; copy its link for your opponent.
        </p>
      </div>
      <NewGameButton label="Open a new table" />
    </div>
  );
}

/** Below the flow: your games once signed in, the house rules otherwise. */
async function TableNotes() {
  const user = await getCurrentUser();
  return (
    <section className="mx-auto w-full max-w-3xl px-4 pb-20">
      {user ? (
        <GameHistory games={await listGamesForUser(user.id)} />
      ) : (
        <div className={`${card} p-6 sm:p-8`}>
          <h2 className={`${eyebrow} mb-4`}>House rules</h2>
          <ol className="space-y-3 text-sm leading-relaxed">
            {RULES.map((rule, i) => (
              <li key={rule} className="flex gap-3">
                <span className="w-5 shrink-0 font-display text-base text-brass">{i + 1}</span>
                <span>{rule}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
