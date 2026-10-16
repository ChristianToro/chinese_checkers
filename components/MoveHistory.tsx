"use client";

import { useEffect, useRef } from "react";
import { cellLabel } from "@/lib/game/board";
import type { Move } from "@/lib/game/types";
import { MarbleDot, PLAYER_MARBLE } from "./board-art";
import { card, eyebrow } from "./ui";

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
    <section className={`${card} flex min-h-0 flex-col`}>
      <h2 className={`${eyebrow} border-b border-line px-4 py-2.5`}>
        Move history
      </h2>
      {moves.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted">No moves yet. Red goes first.</p>
      ) : (
        <ol ref={listRef} className="max-h-72 overflow-y-auto px-2 py-2 font-mono text-sm lg:max-h-[420px]">
          {moves.map((move) => (
            <li
              key={move.moveNumber}
              className="flex items-center gap-2 rounded px-2 py-1 odd:bg-raised/50"
            >
              <span className="w-8 text-right text-muted">{move.moveNumber}.</span>
              <MarbleDot color={PLAYER_MARBLE[move.player]} className="size-2.5" />
              <span className="sr-only">{move.player}</span>
              <span>
                {cellLabel(move.from)} → {cellLabel(move.to)}
              </span>
              <span className="ml-auto text-xs text-muted">{describe(move)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
