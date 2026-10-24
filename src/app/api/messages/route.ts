import { messageRoute } from "@/lib/server/messages/runtime";
import { invalidating } from "@/lib/server/execution/shared-state";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return invalidating(() => messageRoute(request));
}
