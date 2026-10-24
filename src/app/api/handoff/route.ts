import { handoffRoute } from "@/lib/server/handoff/routes";
import { invalidating } from "@/lib/server/execution/shared-state";

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return invalidating(() => handoffRoute("POST /api/handoff", request, null));
}
