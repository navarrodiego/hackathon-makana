// Sumidero ntfy local para pruebas de flujo. Recibe el mismo JSON que publicaría la app en ntfy.sh
// y lo expone por GET /messages para que la prueba actúe como el teléfono. Solo escucha en loopback.
import { createServer } from "node:http";

const port = Number(process.env.E2E_NTFY_PORT || 34139);
const messages = [];

const server = createServer((req, res) => {
  const reply = (status, body) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
  if (req.method === "GET" && req.url === "/health") return reply(200, { ok: true });
  if (req.method === "GET" && req.url === "/messages") return reply(200, messages);
  if (req.method === "POST" && req.url === "/") {
    let raw = "";
    req.on("data", chunk => { raw += chunk; });
    req.on("end", () => {
      try {
        const id = `sink_${messages.length + 1}`;
        messages.push({ id, receivedAt: new Date().toISOString(), body: JSON.parse(raw) });
        reply(200, { id });
      } catch { reply(400, { error: "invalid json" }); }
    });
    return;
  }
  reply(404, {});
});

server.listen(port, "127.0.0.1");
