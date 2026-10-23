import { handoffRoute } from "@/lib/server/handoff/routes";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: RouteContext<"/api/handoff/[id]/reject">) {
  return handoffRoute("POST /api/handoff/[id]/reject", request, await context.params);
}
