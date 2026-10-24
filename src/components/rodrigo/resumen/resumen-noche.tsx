import type { ActorDTO, PublicStateDTO } from "@/lib/contracts/client";
import { ContinuityLine } from "@/components/relevo/continuity-line";
import type { FollowUp } from "../model";
import { summarize } from "./model";

/** Vista de mañana: avisos a Rodrigo, quién quedó con la cobertura y quién tomó cada incidente. Sin registro ni conteos del proyector. */
export function ResumenNoche({ state, follow, outgoing }: { state: PublicStateDTO; follow: FollowUp; outgoing: ActorDTO }) {
  const s = summarize(state);
  return (
    <section aria-label="Resumen de la noche" className="space-y-6">
      <p className="text-people font-semibold">Avisos a Rodrigo: {s.outgoingNotices}</p>
      <div className="space-y-3 border-y border-line py-4">
        <ContinuityLine emphasis outgoing={outgoing} incoming={follow.incoming} state={follow.state} startsAtLabel={follow.startsAtLabel} />
        {follow.coverageNotice ? <p role="status" className="text-body">{follow.coverageNotice}</p> : null}
      </div>
      {s.taken.length > 0 ? (
        <ul aria-label="Incidentes con responsable" className="divide-y divide-line border-b border-line">
          {s.taken.map(t => <li key={t.id} className="py-3 text-body">{t.text}</li>)}
        </ul>
      ) : state.incidents.length === 0 ? <p className="text-body">No se registraron incidentes.</p> : null}
    </section>
  );
}
