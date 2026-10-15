"use client";

import { useEffect, useRef } from "react";
import { cellLabel } from "@/lib/game/board";
import type { Move } from "@/lib/game/types";

function describe(move: Move): string {
  if (move.kind === "step") return "step";
  const hops = move.path.length - 1;
  return hops === 1 ? "jump" : `jump ×${hops}`;
}

export default function MoveHistory({ moves }: { moves: Move[] }) {
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [moves.length]);

  return (
    <section className="flex min-h-0 flex-col rounded-xl border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
      <h2 className="border-b border-black/10 px-4 py-2 text-sm font-semibold uppercase tracking-wide opacity-70 dark:border-white/10">
        Move history
      </h2>
      {moves.length === 0 ? (
        <p className="px-4 py-3 text-sm opacity-60">No moves yet. Red goes first.</p>
      ) : (
        <ol ref={listRef} className="max-h-72 overflow-y-auto px-2 py-2 font-mono text-sm lg:max-h-[420px]">
          {moves.map((move) => (
            <li
              key={move.moveNumber}
              className="flex items-center gap-2 rounded px-2 py-1 odd:bg-black/[0.03] dark:odd:bg-white/[0.04]"
            >
              <span className="w-8 text-right opacity-50">{move.moveNumber}.</span>
              <span
                className={`inline-block size-2.5 rounded-full ${move.player === "red" ? "bg-red-600" : "bg-blue-600"}`}
                aria-label={move.player}
              />
              <span>
                {cellLabel(move.from)} → {cellLabel(move.to)}
              </span>
              <span className="ml-auto text-xs opacity-60">{describe(move)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
