export type ApiResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly code: string; readonly network: boolean };

interface Envelope<T> { ok: boolean; data?: T; error?: { code?: string } }

async function parse<T>(response: Response): Promise<ApiResult<T>> {
  try {
    const body = (await response.json()) as Envelope<T>;
    if (body.ok && body.data !== undefined) return { ok: true, data: body.data };
    return { ok: false, code: body.error?.code ?? "UNKNOWN", network: false };
  } catch {
    return { ok: false, code: "UNKNOWN", network: false };
  }
}

/** POST de navegador: JSON, mismo origen y la cookie de sesión de operador. */
export async function postJson<T>(url: string, body: unknown): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store",
    });
    return await parse<T>(response);
  } catch {
    return { ok: false, code: "NETWORK", network: true };
  }
}

