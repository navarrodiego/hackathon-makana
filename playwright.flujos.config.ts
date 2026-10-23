import { defineConfig, devices } from "@playwright/test";

/**
 * Flujos integrados (T18): varias superficies contra el servidor de producción local, la base del worktree y
 * un sumidero ntfy en loopback que reemplaza a ntfy.sh. Puertos propios para no chocar con `pnpm test:e2e`.
 * Requiere `pnpm build` previo y RODRIGO_* y CONTROL_* en `.env`. Plazos reales de 30 s: serial y un worker.
 */
const port = Number(process.env.E2E_FLOWS_PORT || 34138);
const sinkPort = Number(process.env.E2E_NTFY_PORT || 34139);
const baseURL = `http://127.0.0.1:${port}`;
process.env.APP_ORIGIN = baseURL;
process.env.E2E_NTFY_URL = `http://127.0.0.1:${sinkPort}`;

export default defineConfig({
  testDir: "./tests/e2e/flujos",
  fullyParallel: false,
  workers: 1,
  timeout: 240_000,
  expect: { timeout: 15_000 },
  reporter: "list",
  use: { baseURL, channel: process.env.PLAYWRIGHT_CHANNEL, trace: "retain-on-failure" },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: [
    {
      command: "node tests/e2e/flujos/support/ntfy-sink.mjs",
      url: `http://127.0.0.1:${sinkPort}/health`,
      env: { E2E_NTFY_PORT: String(sinkPort) },
      reuseExistingServer: false,
    },
    {
      command: `pnpm start --port ${port}`,
      url: baseURL,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        APP_ORIGIN: baseURL,
        NTFY_ENABLED: "true",
        NTFY_BASE_URL: `http://127.0.0.1:${sinkPort}`,
        NTFY_TOPIC: "e2e-local",
      },
    },
  ],
});
