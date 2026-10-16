import { CELLS, CELL_MAP } from "@/lib/game/board";
import type { CellKey, Player } from "@/lib/game/types";

/**
 * The board's look, shared by the playable board and the landing page hero:
 * geometry, the marble palette, and the static layers (star, home tints, holes).
 */

/** Pixels per hex-size unit; adjacent holes sit √3 units apart. */
export const UNIT = 30;
export const MARBLE_R = 21;
export const HOLE_R = 7;
const MARGIN = 34;

export function px(key: CellKey): [number, number] {
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

/** The padded outline of one star point, from its ten cells. */
function pointTriangle(cells: ReadonlySet<CellKey>): string {
  const xy = [...cells].map(px);
  const cx = xy.reduce((s, p) => s + p[0], 0) / xy.length;
  const cy = xy.reduce((s, p) => s + p[1], 0) / xy.length;
  // A triangle's three corner cells are the ones farthest from its centre.
  const corners = xy
    .sort((a, b) => Math.hypot(b[0] - cx, b[1] - cy) - Math.hypot(a[0] - cx, a[1] - cy))
    .slice(0, 3);
  return padTriangle(corners, MARBLE_R + 4);
}

// The star is the union of two big triangles (see lib/game/board.ts).
const STAR_TRIANGLES = [
  padTriangle([axialPx(-4, -4), axialPx(-4, 8), axialPx(8, -4)], MARGIN),
  padTriangle([axialPx(4, 4), axialPx(4, -8), axialPx(-8, 4)], MARGIN),
];

const EXTENT_X = 6 * Math.sqrt(3) * UNIT + MARGIN * 2;
const EXTENT_Y = 12 * UNIT + MARGIN * 2;
export const VIEW_BOX = `${-EXTENT_X} ${-EXTENT_Y} ${EXTENT_X * 2} ${EXTENT_Y * 2}`;

export type MarbleColor = "ruby" | "sapphire" | "jade" | "topaz" | "amethyst" | "pearl";

/** `rgb` is the base colour as space-separated channels, for `rgb(... / alpha)`. */
export const MARBLES: Record<MarbleColor, { light: string; base: string; dark: string; rgb: string }> = {
  ruby: { light: "#f7a39a", base: "#c8323a", dark: "#5e0f16", rgb: "200 50 58" },
  sapphire: { light: "#a5c4ff", base: "#2f63c9", dark: "#10285e", rgb: "47 99 201" },
  jade: { light: "#a6e8c6", base: "#2e9a6a", dark: "#0d4630", rgb: "46 154 106" },
  topaz: { light: "#ffe1a3", base: "#dd9c2c", dark: "#7a4a08", rgb: "221 156 44" },
  amethyst: { light: "#dab8ff", base: "#8a4fc4", dark: "#3a1866", rgb: "138 79 196" },
  pearl: { light: "#ffffff", base: "#d9d0c0", dark: "#857a67", rgb: "217 208 192" },
};

/** The two playable colours. */
export const PLAYER_MARBLE: Record<Player, MarbleColor> = { red: "ruby", blue: "sapphire" };

export function tint(color: MarbleColor, alpha: number): string {
  return `rgb(${MARBLES[color].rgb} / ${alpha})`;
}

/** Gradient defs for `<Marble>`; `prefix` keeps ids unique per SVG. */
export function MarbleGradients({ prefix, colors }: { prefix: string; colors: readonly MarbleColor[] }) {
  return (
    <defs>
      {colors.map((c) => (
        <radialGradient key={c} id={`${prefix}-marble-${c}`} cx="35%" cy="30%" r="72%">
          <stop offset="0%" stopColor={MARBLES[c].light} />
          <stop offset="48%" stopColor={MARBLES[c].base} />
          <stop offset="100%" stopColor={MARBLES[c].dark} />
        </radialGradient>
      ))}
      <radialGradient id={`${prefix}-wood`} cx="50%" cy="45%" r="60%">
        <stop offset="0%" stopColor="#4a3322" />
        <stop offset="100%" stopColor="#2a1c12" />
      </radialGradient>
    </defs>
  );
}

/** A glass marble centred on the origin, with a contact shadow and a glint. */
export function Marble({ prefix, color }: { prefix: string; color: MarbleColor }) {
  return (
    <>
      <circle r={MARBLE_R} cx={1.5} cy={3} fill="rgb(0 0 0 / 0.45)" />
      <circle r={MARBLE_R} fill={`url(#${prefix}-marble-${color})`} />
      <ellipse cx={-7} cy={-8} rx={6} ry={4} fill="rgb(255 255 255 / 0.45)" transform="rotate(-30 -7 -8)" />
    </>
  );
}

export interface HomePoint {
  cells: ReadonlySet<CellKey>;
  color: MarbleColor;
}

/** Walnut star with a brass rim, tinted home points, and every hole. */
export function StarBackdrop({ prefix, homes }: { prefix: string; homes: readonly HomePoint[] }) {
  const homeOf = new Map<CellKey, MarbleColor>();
  for (const { cells, color } of homes) for (const key of cells) homeOf.set(key, color);

  return (
    <g>
      {STAR_TRIANGLES.map((points, i) => (
        <polygon
          key={i}
          points={points}
          fill="#2a1c12"
          stroke="#a87a3c"
          strokeWidth={7}
          strokeLinejoin="round"
        />
      ))}
      {/* Second fill pass hides the inner strokes where the triangles overlap. */}
      {STAR_TRIANGLES.map((points, i) => (
        <polygon key={`fill-${i}`} points={points} fill={`url(#${prefix}-wood)`} strokeLinejoin="round" />
      ))}
      {homes.map(({ cells, color }) => (
        <polygon
          key={color}
          points={pointTriangle(cells)}
          fill={tint(color, 0.16)}
          stroke={tint(color, 0.35)}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      ))}
      {CELLS.map(({ key }) => {
        const [x, y] = px(key);
        const home = homeOf.get(key);
        return (
          <g key={key} transform={`translate(${x} ${y})`}>
            <circle r={HOLE_R + 1.5} cy={1} fill="rgb(255 230 190 / 0.07)" />
            <circle
              r={HOLE_R}
              fill="#140d08"
              stroke={home ? tint(home, 0.7) : "rgb(0 0 0 / 0.5)"}
              strokeWidth={home ? 2 : 1.5}
            />
          </g>
        );
      })}
    </g>
  );
}

/** A small CSS marble for lists and labels. */
export function MarbleDot({ color, className = "size-3" }: { color: MarbleColor; className?: string }) {
  const { light, base, dark } = MARBLES[color];
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 rounded-full ${className}`}
      style={{
        background: `radial-gradient(circle at 35% 30%, ${light}, ${base} 48%, ${dark})`,
        boxShadow: "0 1px 2px rgb(0 0 0 / 0.5)",
      }}
    />
  );
}
