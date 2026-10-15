import { resetGame } from "@/lib/games-repo";
import { handle } from "@/lib/http";

export async function POST(_request: Request, ctx: RouteContext<"/api/games/[id]/reset">) {
  return handle(async () => {
    const { id } = await ctx.params;
    return Response.json({ game: await resetGame(id) });
  });
}
