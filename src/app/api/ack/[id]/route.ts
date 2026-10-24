import { ackRoute } from "@/lib/server/incidents/routes";
import { invalidating } from "@/lib/server/execution/shared-state";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: RouteContext<"/api/ack/[id]">) {
  const params = await context.params;
  return invalidating(() => ackRoute(request, params));
}
