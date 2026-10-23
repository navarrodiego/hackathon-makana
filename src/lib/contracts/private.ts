import type { ActorId, ExecutionId, Instant, PreparationStatus, TicketDisposition, TicketId, Version } from "./core";
import type { NoteOutput, ProviderProvenance } from "./classification";
import type { ActorDTO, CoverageDTO, HandoffSummaryDTO, IncidentSummaryDTO, PublicStateDTO } from "./public";

export interface TicketDTO {
  readonly id: TicketId; readonly reference: string; readonly text: string;
  readonly disposition: TicketDisposition; readonly reason: string;
}
export interface NoteDTO {
  readonly status: PreparationStatus;
  readonly saved: { readonly output: NoteOutput; readonly provenance: ProviderProvenance; readonly generatedAt: Instant } | null;
}
export interface HandoffPackageDTO {
  readonly audience: "recipient"; readonly executionId: ExecutionId;
  readonly handoff: HandoffSummaryDTO; readonly outgoing: ActorDTO;
  readonly tickets: readonly TicketDTO[]; readonly note: string; readonly coverage: CoverageDTO;
}
export interface RodrigoViewDTO {
  readonly audience: "outgoing"; readonly executionId: ExecutionId; readonly actorId: ActorId;
  readonly draftVersion: Version; readonly tickets: readonly TicketDTO[]; readonly note: NoteDTO;
  readonly handoff: HandoffSummaryDTO | null; readonly coverage: CoverageDTO | null;
  readonly activeIncidents: readonly IncidentSummaryDTO[];
}
export interface ControlViewDTO {
  readonly audience: "control"; readonly state: PublicStateDTO;
  readonly preparation: PreparationStatus;
  readonly sceneOptions: readonly { readonly id: import("./core").SceneId; readonly label: string; readonly narrativeAt: Instant }[];
  readonly representedActors: readonly ActorDTO[];
}
export interface PageViewMap {
  readonly "/canal": import("./public").ChannelViewDTO;
  readonly "/rodrigo": RodrigoViewDTO;
  readonly "/relevo/[id]": HandoffPackageDTO;
  readonly "/proyector": PublicStateDTO;
  readonly "/control": ControlViewDTO;
}
