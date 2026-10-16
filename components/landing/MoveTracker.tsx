"use client";

import { cellLabel } from "@/lib/game/board";
import { DEMO_SCRIPT, DEMO_SEATS, type DemoMove } from "@/lib/demo/script";
import { MarbleDot } from "../board-art";
import { useDemoClock } from "./DemoPlayback";

const ROWS = 6;

function describe(move: DemoMove): string {
  if (move.kind === "step") return "step";
  const hops = move.path.length - 1;
  return hops === 1 ? "jump" : `jump ×${hops}`;
}

/** The latest moves of the hero's demo game, logged as the marbles move. */
export default function MoveTracker() {
  const { move, hop } = useDemoClock();
  // A move is logged as soon as its marble sets off.
  const started = move + (hop > 0 ? 1 : 0);
  const rows = DEMO_SCRIPT.slice(Math.max(0, started - ROWS), started);

  return (
    <table className="w-full table-fixed text-left text-[13px]">
      <caption className="caption-bottom pt-3 text-left text-xs text-muted">
        Simulated game: the moves on the board above.
      </caption>
      <thead>
        <tr className="text-[11px] uppercase tracking-wider text-muted">
          <th scope="col" className="w-9 pb-2 font-medium">#</th>
          <th scope="col" className="pb-2 font-medium">Player</th>
          <th scope="col" className="w-[38%] pb-2 font-medium">Move</th>
          <th scope="col" className="w-[22%] pb-2 text-right font-medium">Type</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((m, i) => {
          const seat = DEMO_SEATS[m.seat];
          const newest = i === rows.length - 1;
          return (
            <tr
              key={m.moveNumber}
              className={`animate-row-in border-t border-line ${newest ? "bg-brass/10" : ""}`}
            >
              <td className="py-1.5 pl-1 font-mono text-muted">{m.moveNumber}</td>
              <td className="py-1.5">
                <span className="flex min-w-0 items-center gap-2">
                  <MarbleDot color={seat.color} className="size-2.5" />
                  <span className="truncate">{seat.name}</span>
                </span>
              </td>
              <td className="truncate py-1.5 font-mono">
                {cellLabel(m.path[0])} → {cellLabel(m.path.at(-1)!)}
              </td>
              <td className="py-1.5 pr-1 text-right text-muted">{describe(m)}</td>
            </tr>
          );
        })}
        {Array.from({ length: ROWS - rows.length }, (_, i) => (
          <tr key={`empty-${i}`} className="border-t border-line" aria-hidden>
            <td colSpan={4} className="py-1.5">
              &nbsp;
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
