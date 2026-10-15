import { createGame } from "@/lib/games-repo";
import { handle } from "@/lib/http";
import { requireUser } from "@/lib/session";

export async function POST() {
  return handle(async () => {
    const user = await requireUser();
    return Response.json({ game: await createGame(user.id) }, { status: 201 });
  });
}
