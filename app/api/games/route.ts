import { createGame } from "@/lib/games-repo";
import { handle } from "@/lib/http";

export async function POST() {
  return handle(() => Response.json({ game: createGame() }, { status: 201 }));
}
