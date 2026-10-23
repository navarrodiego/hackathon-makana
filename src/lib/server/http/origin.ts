export interface OriginCheck {
  readonly origin: string | null;
  readonly appOrigin: string | undefined;
  /** Solo el POST ack con bearer de incidente puede omitir Origin (acción ntfy, C12). */
  readonly allowMissing: boolean;
}

/** Igualdad exacta con APP_ORIGIN; un Origin presente y ajeno se rechaza siempre. */
export function checkOrigin({ origin, appOrigin, allowMissing }: OriginCheck): boolean {
  if (!appOrigin) return false;
  if (origin === null) return allowMissing;
  return origin === appOrigin;
}
