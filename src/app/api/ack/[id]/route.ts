import { ackRoute } from "@/lib/server/incidents/routes";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: RouteContext<"/api/ack/[id]">) {
  return ackRoute(request, await context.params);
}
