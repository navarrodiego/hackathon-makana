import QRCode from "qrcode";
import { DegradedNotice } from "@/components/ui/feedback";

/** QR a /canal desde APP_ORIGIN, generado en el servidor. Sin origen configurado no inventa una URL. */
export async function Qr() {
  const origin = process.env.APP_ORIGIN?.replace(/\/+$/, "");
  if (!origin) {
    return <DegradedNotice title="QR no disponible"><p>Falta configurar la dirección pública de la aplicación. Nadie puede enviar reportes desde este QR.</p></DegradedNotice>;
  }
  const url = `${origin}/canal`;
  const svg = await QRCode.toString(url, { type: "svg", margin: 2, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
  return (
    <section aria-labelledby="qr-titulo" className="flex flex-col gap-3">
      <h2 id="qr-titulo" className="text-section font-semibold">Envía un reporte</h2>
      <div role="img" aria-label={`Código QR que abre ${url}`} className="size-56 [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="break-all text-aux text-muted-foreground">{url}</p>
    </section>
  );
}
