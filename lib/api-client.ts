import type { CellKey, Game, Move, Player } from "./game/types";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`);
  }
  return data as T;
}

export interface SubmitMoveBody {
  from: CellKey;
  to: CellKey;
  player?: Player;
  expectedMoveCount?: number;
}

export const api = {
  createGame: () => request<{ game: Game }>("/api/games", { method: "POST" }),
  getGame: (id: string) => request<{ game: Game }>(`/api/games/${id}`),
  getMoves: (id: string) => request<{ moves: Move[] }>(`/api/games/${id}/moves`),
  submitMove: (id: string, body: SubmitMoveBody) =>
    request<{ game: Game; move: Move }>(`/api/games/${id}/moves`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  resetGame: (id: string) =>
    request<{ game: Game }>(`/api/games/${id}/reset`, { method: "POST" }),
};
