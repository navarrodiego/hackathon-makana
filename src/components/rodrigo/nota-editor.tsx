import { Button } from "@/components/ui/button";
import { TextAreaField } from "@/components/ui/field";
import { LIMITS } from "@/lib/contracts/client";
import { countWords, noteIssue } from "./model";

export interface NotaEditorProps {
  note: string;
  disabled: boolean;
  regenerating: boolean;
  showErrors: boolean;
  origin: string;
  onChange: (value: string) => void;
  onRegenerate: () => void;
}

/** Nota editable de hasta 60 palabras. El contador es texto estático para lector de pantalla; no anuncia cada tecla. */
export function NotaEditor({ note, disabled, regenerating, showErrors, origin, onChange, onRegenerate }: NotaEditorProps) {
  const words = countWords(note);
  const over = words > LIMITS.noteWords;
  const error = over || showErrors ? noteIssue(note) : null;
  return (
    <section aria-labelledby="nota" className="space-y-3">
      <h2 id="nota" className="text-section font-semibold">Nota para quien entra</h2>
      <p className="text-aux text-muted-foreground">Borrador de IA · revisa antes de enviar. {origin}</p>
      <TextAreaField label="Nota del relevo" value={note} disabled={disabled || regenerating} error={error ?? undefined}
        onChange={event => onChange(event.target.value)} rows={5}
        hint={<>{words} de {LIMITS.noteWords} palabras. No incluyas causas ni compromisos que no estén en los pendientes.</>} />
      <Button variant="secondary" disabled={disabled} loading={regenerating} loadingLabel="Regenerando nota…" onClick={onRegenerate}>
        Regenerar
      </Button>
      <p className="text-aux text-muted-foreground">Regenerar hace una llamada nueva a la IA y reemplaza la nota y las propuestas de arriba.</p>
    </section>
  );
}
