import { PendingRow } from "@/components/relevo/pending-row";
import { TextField } from "@/components/ui/field";
import type { TicketDisposition } from "@/lib/contracts/client";
import { reasonIssue } from "./model";

export interface TicketDraft {
  readonly id: string; readonly reference: string; readonly text: string;
  readonly disposition: TicketDisposition; readonly reason: string;
  /** «ia»: propuesta guardada por la IA; «base»: dato de la ejecución; «tuyo»: ya lo corregiste. */
  readonly source: "ia" | "base" | "tuyo";
}

const LABEL: Record<TicketDisposition, string> = { puede_esperar: "Puede esperar", transferir: "Transferir" };
const SOURCE: Record<TicketDraft["source"], string> = { ia: "Propuesta de IA", base: "Sin propuesta de IA", tuyo: "Corregido por ti" };

export interface PendienteProps {
  ticket: TicketDraft;
  disabled: boolean;
  showErrors: boolean;
  onChange: (next: Partial<Pick<TicketDraft, "disposition" | "reason">>) => void;
}

/** Un pendiente con su propuesta corregible. Transferir no lo vuelve urgente. */
export function Pendiente({ ticket, disabled, showErrors, onChange }: PendienteProps) {
  const name = `disposition-${ticket.id}`;
  const issue = showErrors ? reasonIssue(ticket.reason) : null;
  return (
    <PendingRow
      ticketId={ticket.reference}
      title={ticket.text}
      proposal={<><span className="font-semibold">{LABEL[ticket.disposition]}</span> <span className="text-aux text-muted-foreground">· {SOURCE[ticket.source]}</span></>}
      controls={
        <div className="w-full space-y-3">
          <fieldset disabled={disabled} className="min-w-0">
            <legend className="text-aux text-muted-foreground">Qué hacer con {ticket.reference}</legend>
            <div className="mt-1 flex flex-wrap gap-x-6 gap-y-1">
              {(["puede_esperar", "transferir"] as const).map(value => (
                <label key={value} className="flex min-h-12 items-center gap-3 text-body">
                  <input type="radio" name={name} value={value} checked={ticket.disposition === value}
                    onChange={() => onChange({ disposition: value })} className="size-5 accent-primary" />
                  {LABEL[value]}
                </label>
              ))}
            </div>
          </fieldset>
          <TextField label={`Razón de ${ticket.reference}`} value={ticket.reason} disabled={disabled} error={issue ?? undefined}
            onChange={event => onChange({ reason: event.target.value })} autoComplete="off" />
        </div>
      }
    />
  );
}
