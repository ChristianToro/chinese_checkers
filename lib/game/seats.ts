import type { Game, Player } from "./types";

/** The colour `userId` plays in `game`, or null for a spectator. */
export function seatOf(game: Game, userId: string): Player | null {
  if (game.red?.id === userId) return "red";
  if (game.blue?.id === userId) return "blue";
  return null;
}
