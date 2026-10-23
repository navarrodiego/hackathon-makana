import { handleSuggest } from "@/lib/server/handoff-note/handle";
import { handoffNoteRuntime } from "@/lib/server/handoff-note/runtime";

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return handleSuggest(request, handoffNoteRuntime);
}
