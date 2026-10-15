import { GameError, getGame } from "@/lib/games-repo";
import { handle } from "@/lib/http";

export async function GET(_request: Request, ctx: RouteContext<"/api/games/[id]">) {
  return handle(async () => {
    const { id } = await ctx.params;
    const game = getGame(id);
    if (!game) throw new GameError(404, `Game ${id} not found`);
    return Response.json({ game });
  });
}
