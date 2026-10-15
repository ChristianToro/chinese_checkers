import { listMoves, submitMove } from "@/lib/games-repo";
import { handle, readJson } from "@/lib/http";

export async function GET(_request: Request, ctx: RouteContext<"/api/games/[id]/moves">) {
  return handle(async () => {
    const { id } = await ctx.params;
    return Response.json({ moves: await listMoves(id) });
  });
}

export async function POST(request: Request, ctx: RouteContext<"/api/games/[id]/moves">) {
  return handle(async () => {
    const { id } = await ctx.params;
    const { from, to, player, expectedMoveCount } = await readJson(request);
    return Response.json(await submitMove(id, { from, to, player, expectedMoveCount }));
  });
}
