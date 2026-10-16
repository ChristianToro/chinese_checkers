"use client";

import { DEMO_SCRIPT, DEMO_SEATS, MARBLE_SEATS, positionsAt } from "@/lib/demo/script";
import { Marble, MarbleGradients, StarBackdrop, VIEW_BOX, px } from "../board-art";
import { useDemoClock } from "./DemoPlayback";

const PREFIX = "hero";
const HOMES = DEMO_SEATS.map((s) => ({ cells: s.home, color: s.color }));
const COLORS = DEMO_SEATS.map((s) => s.color);

const GLIDE = "transform 380ms cubic-bezier(0.45, 0.05, 0.35, 1)";
const FADE = "opacity 700ms ease";

/** The landing page's looping six-player game. Decorative; it takes no input. */
export default function HeroBoard() {
  const { move, hop, fading } = useDemoClock();
  const positions = positionsAt(move, hop);
  // The move in progress, or else the one just finished, for the trail.
  const current = hop > 0 ? DEMO_SCRIPT[move] : DEMO_SCRIPT[move - 1];
  const trail = current?.path.slice(0, hop > 0 ? hop + 1 : undefined);
  // Back at the start after a fade: jump into place rather than fly back.
  const resetting = move === 0 && hop === 0;

  return (
    <svg
      viewBox={VIEW_BOX}
      className="h-auto w-full select-none"
      role="img"
      aria-label="An animated six-player game of Chinese Checkers: sixty marbles hopping across the star."
    >
      <MarbleGradients prefix={PREFIX} colors={COLORS} />
      <StarBackdrop prefix={PREFIX} homes={HOMES} />

      {trail && trail.length > 1 && !fading && (
        <polyline
          points={trail.map((k) => px(k).join(",")).join(" ")}
          fill="none"
          stroke="rgb(241 230 211 / 0.35)"
          strokeWidth={4}
          strokeDasharray="8 6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {positions.map((key, id) => {
        const [x, y] = px(key);
        const moving = hop > 0 && DEMO_SCRIPT[move]?.marble === id;
        return (
          <g
            key={id}
            style={{
              transform: `translate(${x}px, ${y}px)`,
              transition: resetting ? FADE : `${GLIDE}, ${FADE}`,
              opacity: fading ? 0 : 1,
            }}
          >
            <g style={{ transform: `scale(${moving ? 1.12 : 1})`, transition: GLIDE }}>
              <Marble prefix={PREFIX} color={DEMO_SEATS[MARBLE_SEATS[id]].color} />
            </g>
          </g>
        );
      })}
    </svg>
  );
}
