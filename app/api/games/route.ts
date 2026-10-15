import { createGame } from "@/lib/games-repo";
import { handle } from "@/lib/http";

export async function POST() {
  return handle(async () => Response.json({ game: await createGame() }, { status: 201 }));
}
