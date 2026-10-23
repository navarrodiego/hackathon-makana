import { stateRoute } from "@/lib/server/execution/runtime";

export const dynamic = "force-dynamic";

export function GET() {
  return stateRoute();
}
