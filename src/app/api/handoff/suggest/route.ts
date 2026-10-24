import { handleSuggest } from "@/lib/server/handoff-note/handle";
import { handoffNoteRuntime } from "@/lib/server/handoff-note/runtime";
import { invalidating } from "@/lib/server/execution/shared-state";

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return invalidating(() => handleSuggest(request, handoffNoteRuntime));
}
