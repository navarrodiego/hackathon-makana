import { handoffRoute } from "@/lib/server/handoff/routes";

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return handoffRoute("POST /api/handoff", request, null);
}
