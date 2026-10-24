-- Fin de la espera común (rechazo de reportes del público) y del QR grande del proyector.
-- Control puede alargar ambos o volver a mostrar el QR sin reabrir la espera. Nulos con el canal cerrado.
ALTER TABLE "executions" ADD COLUMN "lobbyEndsAt" TIMESTAMPTZ(3);
ALTER TABLE "executions" ADD COLUMN "qrEndsAt" TIMESTAMPTZ(3);
UPDATE "executions" SET "lobbyEndsAt" = "channelOpenedAt" + interval '30 seconds', "qrEndsAt" = "channelOpenedAt" + interval '30 seconds'
  WHERE "channelOpenedAt" IS NOT NULL;
