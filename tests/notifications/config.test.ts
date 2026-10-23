import assert from "node:assert/strict";
import test from "node:test";
import { readNtfyConfig } from "../../src/lib/server/notifications/config";

const ok = { NTFY_ENABLED: "true", NTFY_BASE_URL: "https://ntfy.sh", NTFY_TOPIC: "secreto", APP_ORIGIN: "https://relevo.test" };
test("desactivado por defecto y ante cualquier valor distinto de true", () => {
  assert.equal(readNtfyConfig({}).state, "disabled");
  assert.equal(readNtfyConfig({ ...ok, NTFY_ENABLED: "1" }).state, "disabled");
});
test("habilitado con datos incompletos o inseguros falla cerrado", () => {
  assert.equal(readNtfyConfig({ ...ok, NTFY_TOPIC: "" }).state, "misconfigured");
  assert.equal(readNtfyConfig({ ...ok, APP_ORIGIN: "http://relevo.test" }).state, "misconfigured");
  assert.equal(readNtfyConfig({ ...ok, NTFY_BASE_URL: "https://u:p@ntfy.sh" }).state, "misconfigured");
  assert.equal(readNtfyConfig({ ...ok, APP_ORIGIN: "http://127.0.0.1:3000" }).state, "ready");
});
