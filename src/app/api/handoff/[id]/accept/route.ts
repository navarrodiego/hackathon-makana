import { handoffRoute } from "@/lib/server/handoff/routes";
import { invalidating } from "@/lib/server/execution/shared-state";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: RouteContext<"/api/handoff/[id]/accept">) {
  const params = await context.params;
  return invalidating(() => handoffRoute("POST /api/handoff/[id]/accept", request, params));
}
