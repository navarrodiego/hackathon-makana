import { Button } from "@/components/ui/button";
import { TextAreaField } from "@/components/ui/field";
import { LIMITS } from "@/lib/contracts/client";
import { countWords, noteIssue } from "./model";

export interface NotaEditorProps {
  note: string;
  disabled: boolean;
  regenerating: boolean;
  showErrors: boolean;
  onChange: (value: string) => void;
  onRegenerate: () => void;
}

/**
 * Edición de la nota opcional de hasta 60 palabras. Vive plegada bajo la nota de solo lectura del cierre.
 * El contador es texto estático para lector de pantalla; no anuncia cada tecla.
 */
export function NotaEditor({ note, disabled, regenerating, showErrors, onChange, onRegenerate }: NotaEditorProps) {
  const words = countWords(note);
  const over = words > LIMITS.noteWords;
  const error = over || showErrors ? noteIssue(note) : null;
  return (
    <div className="space-y-3">
      <TextAreaField label="Nota del relevo" value={note} disabled={disabled || regenerating} error={error ?? undefined}
        onChange={event => onChange(event.target.value)} rows={5}
        hint={<>{words} de {LIMITS.noteWords} palabras. No incluyas causas ni compromisos que no estén en los pendientes.</>} />
      <Button variant="secondary" disabled={disabled} loading={regenerating} loadingLabel="Regenerando nota…" onClick={onRegenerate}>
        Regenerar
      </Button>
      <p className="text-aux text-muted-foreground">Regenerar hace una llamada nueva a la IA y reemplaza la nota y los pendientes destacados.</p>
    </div>
  );
}
