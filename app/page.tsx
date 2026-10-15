import NewGameButton from "@/components/NewGameButton";

const RULES = [
  "Red starts in the top point of the star, Blue in the bottom point. Each has 10 marbles.",
  "On your turn, move one marble to an adjacent empty hole, or hop over a neighbouring marble (any colour) into the empty hole beyond.",
  "Hops can be chained in one turn, changing direction as you go. You can stop after any hop.",
  "Once a marble reaches the opposite point it can't leave it again.",
  "The first player to fill the opposite point wins.",
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-8 px-4 py-12 text-center">
      <div className="flex items-center gap-3" aria-hidden>
        <span className="size-6 rounded-full bg-gradient-to-br from-red-300 via-red-600 to-red-900 shadow" />
        <span className="size-6 rounded-full bg-gradient-to-br from-blue-300 via-blue-600 to-blue-900 shadow" />
      </div>
      <div className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Chinese Checkers</h1>
        <p className="text-lg opacity-70">
          A two-player game for one screen or two. No sign-up needed.
        </p>
      </div>

      <NewGameButton />

      <section className="w-full rounded-2xl border border-black/10 bg-white p-6 text-left shadow-sm dark:border-white/10 dark:bg-white/5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide opacity-70">
          How to play
        </h2>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed">
          {RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
