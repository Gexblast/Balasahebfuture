// server.js — Gamma X Full Backend
require("dotenv").config();
const express = require("express");
const cors = require("cors");

const auth = require("./lib/auth");
const sm = require("./lib/scripMaster");
const { computeGreeks, impliedVol } = require("./lib/greeks");
const { computeGexDex } = require("./lib/gex");
const push = require("./lib/push");
const scanner = require("./lib/premarketScanner");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ---------------- boot ----------------
(async () => {
  try {
    await auth.login();
    await sm.loadScripMaster();
    push.init();
    scanner.startScheduler();
    console.log("[boot] Gamma X full backend ready");
  } catch (e) {
    console.error("[boot] startup error:", e.message);
  }
})();

// ---------------- health ----------------
app.get("/", (req, res) => res.json({ ok: true, service: "gamma-x-full-backend", time: Date.now() }));
app.get("/health", (req, res) => res.json({
  loggedIn: !!auth.session().jwtToken,
  scripCount: sm.all().length,
  scripLoadedAt: sm.lastLoadedAt()
}));

// ---------------- LTP / quote ----------------
app.get("/ltp", async (req, res) => {
  const { exchange, tradingsymbol, symboltoken } = req.query;
  if (!exchange || !tradingsymbol || !symboltoken) {
    return res.status(400).json({ error: "exchange, tradingsymbol, symboltoken required" });
  }
  const data = await auth.getLTP(exchange, tradingsymbol, symboltoken);
  res.json(data || { error: "lookup failed" });
});

// ---------------- Greeks ----------------
// POST { S, K, T, sigma, isCall }  -- T in YEARS (e.g. 7 days = 7/365)
app.post("/greeks", (req, res) => {
  const { S, K, T, sigma, isCall, r } = req.body;
  const g = computeGreeks({ S, K, T, sigma, isCall, r });
  if (!g) return res.status(400).json({ error: "invalid inputs" });
  res.json(g);
});

// POST { price, S, K, T, isCall } -> implied vol
app.post("/implied-vol", (req, res) => {
  const { price, S, K, T, isCall, r } = req.body;
  const iv = impliedVol({ price, S, K, T, isCall, r });
  res.json({ iv });
});

// ---------------- GEX / DEX ----------------
// POST { chainRows: [{strike, ce:{oi,iv}, pe:{oi,iv}}], spot, T, lotSize }
app.post("/gex-dex", (req, res) => {
  const { chainRows, spot, T, lotSize, r } = req.body;
  if (!chainRows || !spot || !T) return res.status(400).json({ error: "chainRows, spot, T required" });
  const result = computeGexDex({ chainRows, spot, T, lotSize, r });
  res.json(result);
});

// ---------------- Push / alarms ----------------
app.get("/vapid-public-key", (req, res) => res.json({ key: process.env.VAPID_PUBLIC_KEY }));

app.post("/subscribe", (req, res) => {
  push.addSubscription(req.body);
  res.json({ ok: true, total: push.subscriptions().length });
});

app.post("/broadcast", async (req, res) => {
  const sent = await push.broadcast(req.body);
  res.json({ ok: true, sent });
});

// ---------------- Premarket / Open / Live scanner ----------------
app.get("/premarket-scan", (req, res) => {
  res.json({
    status: scanner.PM_STATE.status,
    lockedAt: scanner.PM_STATE.premarketLockedAt,
    indexLocked: scanner.PM_STATE.indexSpotLocked,
    stockCount: Object.keys(scanner.PM_STATE.stockSpotLocked).length
  });
});

app.get("/open-scan", (req, res) => {
  res.json({
    status: scanner.PM_STATE.status,
    capturedAt: scanner.PM_STATE.openCapturedAt,
    index: scanner.PM_STATE.indexResults,
    stocks: scanner.PM_STATE.stockResults
  });
});

app.get("/live-scan", (req, res) => {
  res.json({
    status: scanner.PM_STATE.status,
    lastScanAt: scanner.PM_STATE.lastLiveScanAt,
    results: scanner.PM_STATE.liveResults
  });
});

// manual triggers for testing without waiting for the clock
app.get("/premarket-scan/trigger", async (req, res) => {
  await scanner.lockPremarketSpot();
  res.json({ ok: true, status: scanner.PM_STATE.status });
});
app.get("/open-scan/trigger", async (req, res) => {
  await scanner.captureFutureOpen();
  res.json({ ok: true, results: scanner.PM_STATE.stockResults.length });
});
app.get("/live-scan/trigger", async (req, res) => {
  await scanner.liveScan();
  res.json({ ok: true, results: scanner.PM_STATE.liveResults.length });
});

// ---------------- scrip master lookup helpers (used by frontends) ----------------
app.get("/fno-stock-list", (req, res) => res.json({ list: sm.getFnOStockList() }));
app.get("/nearest-future", (req, res) => {
  const { underlying, isIndex } = req.query;
  res.json(sm.nearestFuture(underlying, isIndex === "true") || {});
});

app.listen(PORT, () => console.log(`[server] listening on ${PORT}`));
