import { PendingRow } from "@/components/relevo/pending-row";
import type { TicketDisposition } from "@/lib/contracts/client";

export interface TicketDraft {
  readonly id: string; readonly reference: string; readonly text: string;
  readonly disposition: TicketDisposition; readonly reason: string;
}

/** Pendiente de solo lectura. Quien entra recibe todos; la IA solo destaca los que necesitan seguimiento. */
export function Pendiente({ ticket }: { ticket: TicketDraft }) {
  return (
    <PendingRow
      ticketId={ticket.reference}
      title={ticket.text}
      proposal={ticket.disposition === "transferir"
        ? <><span className="font-semibold">Para seguimiento.</span> {ticket.reason}</>
        : null}
    />
  );
}
