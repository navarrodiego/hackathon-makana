import type { Incident, Report } from "@/lib/contracts/domain";
import type { PublicReportDTO, ReportReceiptDTO } from "@/lib/contracts/public";

/** Misma derivación que el recibo de quien envió: la sala y el teléfono no se contradicen. */
export function reportStatus(report: Report, incident: Incident | null): ReportReceiptDTO["status"] {
  const route = report.decision?.route;
  return report.status === "processing" ? "processing"
    : incident ? "incident" : route === "review" ? "review" : route === "out_of_scope" ? "out_of_scope" : "queued";
}

/** Recorta por puntos de código (no parte emojis) y marca el corte con «…». */
export function clip(text: string, max: number): string {
  const chars = Array.from(text.trim());
  return chars.length <= max ? chars.join("") : `${chars.slice(0, max - 1).join("").trimEnd()}…`;
}

/**
 * Reportes de la sala para el proyector (decisión de Diego del 24-10-2026): apodo, texto recortado y qué pasó con él.
 * Lista explícita: sesión, principal, correlación, clasificación y decisión quedan fuera.
 */
export function publicReports(reports: readonly Report[], incidents: readonly Incident[], limit = 6): PublicReportDTO[] {
  return [...reports]
    .sort((a, b) => b.admissionSequence - a.admissionSequence)
    .slice(0, limit)
    .map(r => {
      const incident = r.incidentId ? incidents.find(i => i.id === r.incidentId) ?? null : null;
      return {
        id: r.id, nickname: clip(r.nickname, 40), text: clip(r.text, 100), status: reportStatus(r, incident),
        duplicate: incident ? incident.firstReportId !== r.id : false, narrativeAt: r.narrativeAt,
      };
    });
}
