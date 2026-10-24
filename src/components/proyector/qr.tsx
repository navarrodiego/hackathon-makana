import QRCode from "qrcode";
import type { CanalQr } from "./qr-image";

/** QR a /canal desde APP_ORIGIN, generado en el servidor. Sin origen configurado no inventa una URL. */
export async function canalQr(): Promise<CanalQr | null> {
  const origin = process.env.APP_ORIGIN?.replace(/\/+$/, "");
  if (!origin) return null;
  const url = `${origin}/canal`;
  const svg = await QRCode.toString(url, { type: "svg", margin: 2, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
  return { url, svg };
}
