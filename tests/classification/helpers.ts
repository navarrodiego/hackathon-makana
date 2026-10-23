import type { CommandContext } from "../../src/lib/contracts/auth";
import type { AsyncFence } from "../../src/lib/contracts/core";
import type { Classification, ClassificationOutput, ProviderResult, StructuredProvider } from "../../src/lib/contracts/classification";
import type { Report } from "../../src/lib/contracts/domain";

export const output = (patch: Partial<ClassificationOutput> = {}): ClassificationOutput => ({
  service: "facturacion", condition: "caida", scope: "local_equipo", pc: 0.8, manipulation: false, blocksBilling: false,
  evidence: { location: "Local 7", resource: "caja 2", problem: "no emite boletas" }, sufficientInformation: true, ...patch,
});
export const provenance = { provider: "openrouter", api: "decisions", model: "m", configurationId: "c" } as const;
export const model = (patch: Partial<ClassificationOutput> = {}): Classification =>
  ({ mode: "model", reportId: "report_1", output: output(patch), provenance });
export const context = {
  executionId: "execution_1", executionVersion: 1, principal: { kind: "system" }, actorId: null, origin: "web",
  operationalNow: "2026-10-23T22:00:00.000Z", narrativeNow: "2026-10-23T22:00:00.000Z", correlationId: "correlation_1",
} as CommandContext;
export const report = { id: "report_1", version: 1, text: "Facturación caída" } as unknown as Report;
export const providerReturning = (make: (fence: AsyncFence) => ProviderResult<ClassificationOutput>): StructuredProvider => ({
  classify: async request => make(request.fence), suggest: async () => { throw new Error("no usado"); },
});
