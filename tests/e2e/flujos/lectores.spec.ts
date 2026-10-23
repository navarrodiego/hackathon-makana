import { expect, test } from "@playwright/test";
import { BILLING, ORIGIN, activeCoverage, requireBackend, rows, scriptedReport, waitState } from "./support/flow";

/**
 * I07 · Sin lector no hay scheduler: un plazo vencido no se evalúa hasta la siguiente lectura de estado.
 * Al volver, lectores concurrentes producen una sola escalada y un solo aviso al siguiente candidato.
 */
requireBackend();

test("sin lector el vencimiento espera; diez lecturas concurrentes escalan una sola vez", async ({ request }) => {
  test.setTimeout(150_000);
  const { s } = await activeCoverage(request);
  await scriptedReport(request, BILLING);
  const pending = await waitState(request, x => x.incidents[0]?.status === "awaiting_ack", "incidente esperando acuse", 45_000);
  const incidentId = pending.incidents[0].id;
  const attempts = () => rows<{ status: string; candidateActorId: string }>(`select status, "candidateActorId" from incident_attempts where "incidentId"=$1 order by position`, [incidentId]);

  // Nadie lee el estado: el plazo de Paula vence sin que la base cambie (límite conocido, sin scheduler).
  await new Promise(resolve => setTimeout(resolve, 36_000));
  expect((await attempts()).map(a => a.status), "sin lector no se evalúa").toEqual(["pending"]);

  // Diez proyectores vuelven a la vez.
  const reads = await Promise.all(Array.from({ length: 10 }, () => request.get(`${ORIGIN}/api/state`)));
  expect(reads.map(r => r.status())).toEqual(Array(10).fill(200));
  await expect.poll(async () => (await attempts()).map(a => a.status), { timeout: 10_000 }).toEqual(["expired", "pending"]);
  const [escalations] = await rows<{ n: number }>(`select count(*)::int as n from events where "executionId"=$1 and kind='incident_escalated'`, [s.executionId]);
  expect(escalations.n, "una sola escalada").toBe(1);
  const tomas = (await attempts())[1].candidateActorId;
  const [notices] = await rows<{ n: number }>(`select count(*)::int as n from notification_intents where "executionId"=$1 and "recipientActorId"=$2`, [s.executionId, tomas]);
  expect(notices.n, "un solo aviso a Tomás").toBe(1);
});
