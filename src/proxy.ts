import { NextResponse, type NextRequest } from "next/server";

/**
 * C12: Rodrigo entra con HTTP Basic. Sin cabecera, el navegador necesita un 401 con desafío para pedir la
 * credencial y reenviarla en la página y en sus POST. Solo comprueba presencia; la validación real ocurre
 * en el servicio de autorización (T05), que además falla cerrado si falta la configuración.
 */
export function proxy(request: NextRequest) {
  if (request.headers.has("authorization")) return NextResponse.next();
  return new NextResponse("Ingresa con la credencial de Rodrigo para abrir el cierre de turno.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Relevo · cierre de Rodrigo", charset="UTF-8"',
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

export const config = { matcher: "/rodrigo" };
