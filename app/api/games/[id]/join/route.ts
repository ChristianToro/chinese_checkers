import { joinGame } from "@/lib/games-repo";
import { handle } from "@/lib/http";
import { requireUser } from "@/lib/session";

export async function POST(_request: Request, ctx: RouteContext<"/api/games/[id]/join">) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    return Response.json({ game: await joinGame(id, user.id) });
  });
}
