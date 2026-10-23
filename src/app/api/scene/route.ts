import { commandRoute } from "@/lib/server/execution/runtime";

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return commandRoute("POST /api/scene", request);
}
