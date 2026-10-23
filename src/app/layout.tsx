import type { Metadata, Viewport } from "next";
import "@fontsource-variable/public-sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "Relevo",
  description: "Entrega el turno. Recupera la noche.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#102a2d", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-CL">
      <body>
        <a
          href="#contenido"
          className="sr-only rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
        >
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
