import type { Metadata } from "next";
import { ReceptorFailure } from "@/components/receptor/failure";
import { ReceptorView } from "@/components/receptor/receptor-view";
import { failureView } from "@/components/receptor/logic";
import { loadHandoffPackage } from "./load";

// Enlace tokenizado: sin caché y sin Referer hacia otros orígenes (C13).
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Revisión del relevo · Relevo", referrer: "no-referrer", robots: { index: false, follow: false } };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ token?: string | string[] }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const token = typeof query.token === "string" ? query.token : undefined;
  const result = await loadHandoffPackage(id, token);
  if (!result.ok) return <ReceptorFailure view={failureView(result.code)} />;
  // La clave rehace la revisión cuando el relevo cambió en el servidor (C11: versión vigente).
  return <ReceptorView key={`${result.value.executionId}:${result.value.handoff.version}`} pkg={result.value} token={token as string} />;
}
