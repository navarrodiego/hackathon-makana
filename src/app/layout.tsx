import type { Metadata, Viewport } from "next";
import "@fontsource-variable/public-sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "Relevo",
  description: "Entrega el turno. Recupera la noche.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#102a2d" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-CL">
      <body>{children}</body>
    </html>
  );
}
