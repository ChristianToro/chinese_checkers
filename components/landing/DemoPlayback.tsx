"use client";

import { type ReactNode, createContext, use, useEffect, useState, useSyncExternalStore } from "react";
import { DEMO_SCRIPT } from "@/lib/demo/script";

/** Where the demo game is: `move` moves done, and `hop` hops into the next. */
export interface DemoClock {
  move: number;
  hop: number;
  /** The loop's end: marbles fade out before the board resets. */
  fading: boolean;
}

const START: DemoClock = { move: 0, hop: 0, fading: false };
/** Shown instead of the loop under prefers-reduced-motion. */
const STILL: DemoClock = { move: 18, hop: 0, fading: false };

const HOP_MS = 420;
const MOVE_PAUSE_MS = 650;
const END_HOLD_MS = 2400;
const FADE_MS = 700;

function advance(clock: DemoClock): DemoClock {
  if (clock.fading) return START;
  if (clock.move >= DEMO_SCRIPT.length) return { ...clock, fading: true };
  const hops = DEMO_SCRIPT[clock.move].path.length - 1;
  return clock.hop + 1 < hops
    ? { ...clock, hop: clock.hop + 1 }
    : { move: clock.move + 1, hop: 0, fading: false };
}

function delayAfter(clock: DemoClock): number {
  if (clock.fading) return FADE_MS;
  if (clock.move >= DEMO_SCRIPT.length) return END_HOLD_MS;
  return clock.hop === 0 ? MOVE_PAUSE_MS : HOP_MS;
}

function subscribeMotion(onChange: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function subscribeVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

/**
 * When a landing animation should hold still: `reduced` under
 * prefers-reduced-motion (show a still frame), `hidden` while the tab is in the
 * background (just pause). Both are false on the server.
 */
export function useMotionGate(): { reduced: boolean; hidden: boolean } {
  const reduced = useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
  const hidden = useSyncExternalStore(
    subscribeVisibility,
    () => document.hidden,
    () => false,
  );
  return { reduced, hidden };
}

const DemoClockContext = createContext<DemoClock>(START);

export function useDemoClock(): DemoClock {
  return use(DemoClockContext);
}

/**
 * Plays the scripted demo game on a loop for everything inside it, so the hero
 * board and the move tracker show the same moves at the same time. The first
 * render is the starting position, matching the server's HTML.
 */
export default function DemoPlayback({ children }: { children: ReactNode }) {
  const { reduced, hidden } = useMotionGate();
  const [clock, setClock] = useState(START);

  useEffect(() => {
    if (reduced || hidden) return;
    const timer = window.setTimeout(() => setClock(advance), delayAfter(clock));
    return () => window.clearTimeout(timer);
  }, [clock, reduced, hidden]);

  return <DemoClockContext value={reduced ? STILL : clock}>{children}</DemoClockContext>;
}
