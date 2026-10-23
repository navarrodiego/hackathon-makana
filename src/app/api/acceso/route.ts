import { loadAuthConfig } from "@/lib/server/auth/config";
import { handleOperatorLogin } from "@/lib/server/auth/operator-http";

export const dynamic = "force-dynamic";

const pause = () => new Promise<void>(resolve => setTimeout(resolve, 400));

export function POST(request: Request) {
  return handleOperatorLogin({ config: loadAuthConfig(), nowMs: Date.now, failureDelay: pause }, request);
}
