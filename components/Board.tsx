import { CELLS, CELL_MAP, HOME } from "@/lib/game/board";
import type { Board as BoardState, CellKey, MoveOption, Player } from "@/lib/game/types";

/** Pixels per hex-size unit; adjacent holes sit √3 units apart. */
const UNIT = 30;
const MARBLE_R = 21;
const HOLE_R = 7;
const MARGIN = 34;

const COLORS: Record<
  Player,
  { base: string; light: string; dark: string; tint: string; target: string }
> = {
  red: {
    base: "#dc2626",
    light: "#fca5a5",
    dark: "#7f1d1d",
    tint: "rgba(220, 38, 38, 0.22)",
    target: "rgba(220, 38, 38, 0.55)",
  },
  blue: {
    base: "#2563eb",
    light: "#93c5fd",
    dark: "#1e3a8a",
    tint: "rgba(37, 99, 235, 0.22)",
    target: "rgba(37, 99, 235, 0.55)",
  },
};

function px(key: CellKey): [number, number] {
  const cell = CELL_MAP.get(key)!;
  return [cell.x * UNIT, cell.y * UNIT];
}

function axialPx(q: number, r: number): [number, number] {
  return [Math.sqrt(3) * (q + r / 2) * UNIT, 1.5 * r * UNIT];
}

/** Pushes each corner of an equilateral triangle outward so its edges move by `m`. */
function padTriangle(corners: [number, number][], m: number): string {
  const cx = corners.reduce((s, p) => s + p[0], 0) / 3;
  const cy = corners.reduce((s, p) => s + p[1], 0) / 3;
  return corners
    .map(([x, y]) => {
      const len = Math.hypot(x - cx, y - cy);
      const k = (len + 2 * m) / len;
      return `${cx + (x - cx) * k},${cy + (y - cy) * k}`;
    })
    .join(" ");
}

// The star is the union of two big triangles (see lib/game/board.ts).
const STAR_TRIANGLES = [
  padTriangle([axialPx(-4, -4), axialPx(-4, 8), axialPx(8, -4)], MARGIN),
  padTriangle([axialPx(4, 4), axialPx(4, -8), axialPx(-8, 4)], MARGIN),
];

const HOME_TRIANGLES: Record<Player, string> = {
  red: padTriangle([axialPx(4, -8), axialPx(1, -5), axialPx(4, -5)], MARBLE_R + 4),
  blue: padTriangle([axialPx(-4, 8), axialPx(-4, 5), axialPx(-1, 5)], MARBLE_R + 4),
};

const EXTENT_X = 6 * Math.sqrt(3) * UNIT + MARGIN * 2;
const EXTENT_Y = 12 * UNIT + MARGIN * 2;
const VIEW_BOX = `${-EXTENT_X} ${-EXTENT_Y} ${EXTENT_X * 2} ${EXTENT_Y * 2}`;

function homeOf(key: CellKey): Player | null {
  if (HOME.red.has(key)) return "red";
  if (HOME.blue.has(key)) return "blue";
  return null;
}

interface BoardProps {
  board: BoardState;
  selected: CellKey | null;
  highlights: ReadonlyMap<CellKey, MoveOption>;
  /** Marbles the viewer may pick up right now. */
  selectable: (key: CellKey) => boolean;
  lastPath: CellKey[] | null;
  disabled?: boolean;
  onCellClick: (key: CellKey) => void;
}

export default function Board({
  board,
  selected,
  highlights,
  selectable,
  lastPath,
  disabled,
  onCellClick,
}: BoardProps) {
  const selectedColor = selected ? board[selected] : undefined;

  return (
    <svg
      viewBox={VIEW_BOX}
      className="h-auto w-full max-w-[640px] select-none"
      role="img"
      aria-label="Chinese Checkers board"
    >
      <defs>
        {(Object.keys(COLORS) as Player[]).map((p) => (
          <radialGradient key={p} id={`marble-${p}`} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor={COLORS[p].light} />
            <stop offset="45%" stopColor={COLORS[p].base} />
            <stop offset="100%" stopColor={COLORS[p].dark} />
          </radialGradient>
        ))}
      </defs>

      {STAR_TRIANGLES.map((points, i) => (
        <polygon
          key={i}
          points={points}
          fill="#e7c48d"
          stroke="#b08550"
          strokeWidth={6}
          strokeLinejoin="round"
        />
      ))}
      {/* Second fill pass hides the inner strokes where the triangles overlap. */}
      {STAR_TRIANGLES.map((points, i) => (
        <polygon key={`fill-${i}`} points={points} fill="#e7c48d" strokeLinejoin="round" />
      ))}
      {(Object.keys(HOME_TRIANGLES) as Player[]).map((p) => (
        <polygon
          key={p}
          points={HOME_TRIANGLES[p]}
          fill={COLORS[p].tint}
          strokeLinejoin="round"
        />
      ))}

      {lastPath && lastPath.length > 1 && (
        <polyline
          points={lastPath.map((k) => px(k).join(",")).join(" ")}
          fill="none"
          stroke="rgba(68, 44, 18, 0.45)"
          strokeWidth={4}
          strokeDasharray="8 6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {CELLS.map(({ key, label }) => {
        const [x, y] = px(key);
        const occupant = board[key];
        const isTarget = highlights.has(key);
        const canSelect = !!occupant && selectable(key);
        const interactive = !disabled && (isTarget || canSelect);
        const home = homeOf(key);
        const description = occupant
          ? `${occupant} marble at ${label}`
          : isTarget
            ? `Move to ${label}`
            : `Empty hole ${label}`;

        return (
          <g
            key={key}
            transform={`translate(${x} ${y})`}
            onClick={() => !disabled && onCellClick(key)}
            onKeyDown={(e) => {
              if (interactive && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                onCellClick(key);
              }
            }}
            role={interactive ? "button" : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-label={description}
            className={interactive ? "cursor-pointer outline-none focus-visible:opacity-80" : undefined}
          >
            {/* Generous invisible hit area. */}
            <circle r={MARBLE_R + 3} fill="transparent" />
            <circle
              r={HOLE_R}
              fill="#8a6234"
              stroke={home ? COLORS[home].base : "#6f4b23"}
              strokeOpacity={home ? 0.6 : 0.4}
              strokeWidth={2}
            />
            {occupant && (
              <>
                <circle r={MARBLE_R} cx={1.5} cy={2.5} fill="rgba(0,0,0,0.25)" />
                <circle r={MARBLE_R} fill={`url(#marble-${occupant})`} />
              </>
            )}
            {canSelect && key !== selected && !disabled && (
              <circle
                r={MARBLE_R + 3}
                fill="none"
                stroke="rgba(255,255,255,0.55)"
                strokeWidth={2}
                strokeDasharray="4 4"
              />
            )}
            {key === selected && (
              <circle r={MARBLE_R + 4} fill="none" stroke="#facc15" strokeWidth={4} />
            )}
            {isTarget && selectedColor && (
              <circle
                r={HOLE_R + 5}
                fill={COLORS[selectedColor].target}
                stroke={COLORS[selectedColor].base}
                strokeWidth={2.5}
                className="animate-pulse"
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
