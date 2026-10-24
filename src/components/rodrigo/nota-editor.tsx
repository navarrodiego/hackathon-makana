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
 * Nota opcional de hasta 60 palabras, editable desde el inicio con el resumen del turno ya escrito. El campo crece
 * con el texto (sin scroll interno) y parte con altura para el resumen completo, así enfocar no mueve la página.
 * El contador es texto estático para lector de pantalla; no anuncia cada tecla.
 */
export function NotaEditor({ note, disabled, showErrors, onChange }: NotaEditorProps) {
  const words = countWords(note);
  const over = words > LIMITS.noteWords;
  const error = over || showErrors ? noteIssue(note) : null;
  return (
    <div className="space-y-3">
      <TextAreaField label="Nota para quien entra (opcional)" value={note} disabled={disabled} error={error ?? undefined}
        onChange={event => onChange(event.target.value)} rows={7} className="min-h-40 resize-none [field-sizing:content]"
        hint={<>Resumen del turno: puedes enviarlo tal cual, editarlo o dejarlo vacío. {words} de {LIMITS.noteWords} palabras.</>} />
    </div>
  );
}
