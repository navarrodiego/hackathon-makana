import { messageRoute } from "@/lib/server/messages/runtime";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return messageRoute(request);
}
