import NewGameButton from "@/components/NewGameButton";

export default function GameNotFound() {
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">Game not found</h1>
      <p className="opacity-70">
        This link doesn&apos;t match a saved game. It may be mistyped, or the database was cleared.
      </p>
      <NewGameButton />
    </main>
  );
}
