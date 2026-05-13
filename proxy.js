#!/usr/bin/env node
// Local CORS proxy that fetches an HPE OneView /rest/version endpoint
// while skipping TLS verification (appliances usually have self-signed
// certs). Bound to 127.0.0.1 only.
//
// Run:  node proxy.js
// Use:  curl 'http://127.0.0.1:8765/version?target=https://oneview1.example.com'

const http  = require("http");
const https = require("https");
const { URL } = require("url");

const PORT = Number(process.env.PORT) || 8765;
const HOST = "127.0.0.1";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function json(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

function safeJson(s) {
  try { return JSON.parse(s); } catch { return s; }
}

const server = http.createServer((req, res) => {
  cors(res);
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const u = new URL(req.url, `http://${HOST}:${PORT}`);
  if (u.pathname !== "/version") return json(res, 404, { error: "not found" });

  const target = u.searchParams.get("target");
  if (!target) return json(res, 400, { error: "missing ?target=<url>" });

  let upstream;
  try { upstream = new URL(target); }
  catch { return json(res, 400, { error: "invalid target URL" }); }
  if (upstream.protocol !== "https:") return json(res, 400, { error: "target must be https://" });

  const opts = {
    hostname: upstream.hostname,
    port: upstream.port || 443,
    path: "/rest/version",
    method: "GET",
    headers: { Accept: "application/json", "X-API-Version": "120" },
    rejectUnauthorized: false,   // skip TLS verification
    timeout: 8000,
  };

  console.log(`-> ${upstream.origin}/rest/version`);
  const upReq = https.request(opts, (upRes) => {
    let body = "";
    upRes.setEncoding("utf8");
    upRes.on("data", (c) => body += c);
    upRes.on("end", () => json(res, upRes.statusCode || 502, {
      status: upRes.statusCode,
      body: safeJson(body),
    }));
  });
  upReq.on("timeout", () => upReq.destroy(new Error("timeout")));
  upReq.on("error",   (err) => json(res, 502, { error: err.message }));
  upReq.end();
});

server.listen(PORT, HOST, () => {
  console.log(`oneview-status proxy at http://${HOST}:${PORT}`);
});
