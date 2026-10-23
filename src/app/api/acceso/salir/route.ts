import { handleOperatorLogout } from "@/lib/server/auth/operator-http";

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return handleOperatorLogout(request);
}
