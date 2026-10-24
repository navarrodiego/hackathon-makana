import { TextAreaField } from "@/components/ui/field";
import { LIMITS } from "@/lib/contracts/client";
import { countWords, noteIssue } from "./model";

export interface NotaEditorProps {
  note: string;
  disabled: boolean;
  showErrors: boolean;
  onChange: (value: string) => void;
}

/**
 * Edición de la nota opcional de hasta 60 palabras. Vive plegada bajo la nota de solo lectura del cierre.
 * El contador es texto estático para lector de pantalla; no anuncia cada tecla.
 */
export function NotaEditor({ note, disabled, showErrors, onChange }: NotaEditorProps) {
  const words = countWords(note);
  const over = words > LIMITS.noteWords;
  const error = over || showErrors ? noteIssue(note) : null;
  return (
    <div className="space-y-3">
      <TextAreaField label="Nota del relevo" value={note} disabled={disabled} error={error ?? undefined}
        onChange={event => onChange(event.target.value)} rows={5}
        hint={<>{words} de {LIMITS.noteWords} palabras. No incluyas causas ni compromisos que no estén en los pendientes.</>} />
    </div>
  );
}
