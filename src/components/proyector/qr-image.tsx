import { cn } from "@/lib/utils";

export interface CanalQr { readonly url: string; readonly svg: string }

/** Imagen del QR ya generado en el servidor; el tamaño lo decide quien la usa. */
export function QrImage({ qr, className }: { qr: CanalQr; className?: string }) {
  return (
    <div role="img" aria-label={`Código QR que abre ${qr.url}`}
      className={cn("shrink-0 bg-white [&>svg]:size-full", className)} dangerouslySetInnerHTML={{ __html: qr.svg }} />
  );
}
