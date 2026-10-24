-- Hora operacional en que el canal pasó de cerrado a abierto: ancla común de la
-- espera previa al envío en /canal y del QR grande del proyector. Nula si está cerrado.
ALTER TABLE "executions" ADD COLUMN "channelOpenedAt" TIMESTAMPTZ(3);
