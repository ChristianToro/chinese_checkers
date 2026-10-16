"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { buttonPrimary, fieldError } from "./ui";

export default function NewGameButton({
  className,
  label = "New Game",
}: {
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setPending(true);
    setError(null);
    try {
      const { game } = await api.createGame();
      router.push(`/games/${game.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start a game");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={start}
        disabled={pending}
        className={className ?? `${buttonPrimary} px-6 py-3 text-lg`}
      >
        {pending ? "Setting up the board…" : label}
      </button>
      {error && (
        <p role="alert" className={fieldError}>
          {error}
        </p>
      )}
    </div>
  );
}
