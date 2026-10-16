import { CELLS, HOME, PLAYERS } from "@/lib/game/board";
import type { Board as BoardState, CellKey, MoveOption } from "@/lib/game/types";
import {
  HOLE_R,
  MARBLE_R,
  MARBLES,
  Marble,
  MarbleGradients,
  PLAYER_MARBLE,
  StarBackdrop,
  VIEW_BOX,
  px,
  tint,
} from "./board-art";

const PREFIX = "board";
const HOMES = PLAYERS.map((p) => ({ cells: HOME[p], color: PLAYER_MARBLE[p] }));
const COLORS = PLAYERS.map((p) => PLAYER_MARBLE[p]);

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
  const selectedOccupant = selected ? board[selected] : undefined;
  const selectedColor = selectedOccupant ? PLAYER_MARBLE[selectedOccupant] : undefined;

  return (
    <svg
      viewBox={VIEW_BOX}
      className="h-auto w-full max-w-[640px] select-none"
      role="img"
      aria-label="Chinese Checkers board"
    >
      <MarbleGradients prefix={PREFIX} colors={COLORS} />
      <StarBackdrop prefix={PREFIX} homes={HOMES} />

      {lastPath && lastPath.length > 1 && (
        <polyline
          points={lastPath.map((k) => px(k).join(",")).join(" ")}
          fill="none"
          stroke="rgb(241 230 211 / 0.45)"
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
            className={interactive ? "group cursor-pointer outline-none" : undefined}
          >
            {/* Generous invisible hit area; its ring shows keyboard focus. */}
            <circle
              r={MARBLE_R + 4}
              fill="transparent"
              strokeWidth={3}
              className="stroke-transparent group-focus-visible:stroke-cream"
            />
            {occupant && <Marble prefix={PREFIX} color={PLAYER_MARBLE[occupant]} />}
            {canSelect && key !== selected && !disabled && (
              <circle
                r={MARBLE_R + 3}
                fill="none"
                stroke="rgb(241 230 211 / 0.55)"
                strokeWidth={2}
                strokeDasharray="4 4"
              />
            )}
            {key === selected && (
              <circle r={MARBLE_R + 4} fill="none" stroke="#e8bb6a" strokeWidth={4} />
            )}
            {isTarget && selectedColor && (
              <circle
                r={HOLE_R + 5}
                fill={tint(selectedColor, 0.5)}
                stroke={MARBLES[selectedColor].base}
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
