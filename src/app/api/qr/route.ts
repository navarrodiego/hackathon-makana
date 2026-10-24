import { commandRoute } from "@/lib/server/execution/runtime";
import { invalidating } from "@/lib/server/execution/shared-state";

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return invalidating(() => commandRoute("POST /api/qr", request));
}
