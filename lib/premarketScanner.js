// lib/premarketScanner.js
const auth = require("./auth");
const sm = require("./scripMaster");

const PM_STATE = {
  indexSpotLocked: {},
  stockSpotLocked: {},
  indexResults: [],
  stockResults: [],
  liveResults: [],
  premarketLockedAt: null,
  openCapturedAt: null,
  lastLiveScanAt: null,
  status: "idle"
};

const PM_INDEXES = [
  { name: "NIFTY", spotSymbol: "Nifty 50", spotExch: "NSE", futName: "NIFTY" },
  { name: "BANKNIFTY", spotSymbol: "Nifty Bank", spotExch: "NSE", futName: "BANKNIFTY" },
  { name: "SENSEX", spotSymbol: "SENSEX", spotExch: "BSE", futName: "SENSEX" }
];

async function lockPremarketSpot() {
  PM_STATE.status = "locking_premarket";

  for (const idx of PM_INDEXES) {
    const tok = sm.spotToken(idx.spotSymbol, true, idx.spotExch);
    if (!tok) continue;
    const d = await auth.getLTP(tok.exch_seg, tok.symbol, tok.token);
    if (d?.ltp) PM_STATE.indexSpotLocked[idx.name] = { price: d.ltp, time: Date.now() };
  }

  const stocks = sm.getFnOStockList();
  for (const symName of stocks) {
    const tok = sm.spotToken(symName, false);
    if (!tok) continue;
    const d = await auth.getLTP(tok.exch_seg, tok.symbol, tok.token);
    if (d?.ltp) PM_STATE.stockSpotLocked[symName] = { price: d.ltp, time: Date.now() };
  }

  PM_STATE.premarketLockedAt = Date.now();
  PM_STATE.status = "waiting_open";
  console.log(`[premarket] locked ${Object.keys(PM_STATE.stockSpotLocked).length} stocks + ${Object.keys(PM_STATE.indexSpotLocked).length} indexes`);
}

async function captureFutureOpen() {
  PM_STATE.status = "capturing_open";
  const indexRows = [];
  const stockRows = [];

  for (const idx of PM_INDEXES) {
    const fut = sm.nearestFuture(idx.futName, true);
    const lock = PM_STATE.indexSpotLocked[idx.name];
    if (!fut || !lock) continue;
    const d = await auth.getLTP(fut.exch_seg, fut.symbol, fut.token);
    if (!d?.ltp) continue;
    const diffPct = ((d.ltp - lock.price) / lock.price) * 100;
    indexRows.push({
      name: idx.name, spotOpen: lock.price, futureOpen: d.ltp,
      diffPct: +diffPct.toFixed(3), match: d.ltp < lock.price
    });
  }

  for (const symName of Object.keys(PM_STATE.stockSpotLocked)) {
    const fut = sm.nearestFuture(symName, false);
    const lock = PM_STATE.stockSpotLocked[symName];
    if (!fut) continue;
    const d = await auth.getLTP(fut.exch_seg, fut.symbol, fut.token);
    if (!d?.ltp) continue;
    if (d.ltp < lock.price) {
      const diffPct = ((d.ltp - lock.price) / lock.price) * 100;
      stockRows.push({ name: symName, spotOpen: lock.price, futureOpen: d.ltp, diffPct: +diffPct.toFixed(3), match: true });
    }
  }

  PM_STATE.indexResults = indexRows;
  PM_STATE.stockResults = stockRows.sort((a, b) => a.diffPct - b.diffPct);
  PM_STATE.openCapturedAt = Date.now();
  PM_STATE.status = "live";
  console.log(`[open-capture] ${stockRows.length} stocks matched future<spot`);
}

async function liveScan() {
  const rows = [];
  const all = [
    ...PM_INDEXES.map(i => ({ name: i.name, isIndex: true })),
    ...Object.keys(PM_STATE.stockSpotLocked).map(s => ({ name: s, isIndex: false }))
  ];

  for (const item of all) {
    const idxCfg = PM_INDEXES.find(i => i.name === item.name);
    const fut = sm.nearestFuture(item.isIndex ? idxCfg.futName : item.name, item.isIndex);
    const spotTok = item.isIndex
      ? sm.spotToken(idxCfg.spotSymbol, true, idxCfg.spotExch)
      : sm.spotToken(item.name, false);
    if (!fut || !spotTok) continue;

    const [spotD, futD] = await Promise.all([
      auth.getLTP(spotTok.exch_seg, spotTok.symbol, spotTok.token),
      auth.getLTP(fut.exch_seg, fut.symbol, fut.token)
    ]);
    if (!spotD?.ltp || !futD?.ltp) continue;

    const diffPct = ((futD.ltp - spotD.ltp) / spotD.ltp) * 100;
    rows.push({
      name: item.name, isIndex: item.isIndex, spot: spotD.ltp, future: futD.ltp,
      diffPct: +diffPct.toFixed(3), match: futD.ltp < spotD.ltp
    });
  }

  PM_STATE.liveResults = rows.sort((a, b) => a.diffPct - b.diffPct);
  PM_STATE.lastLiveScanAt = Date.now();
}

function startScheduler() {
  let firedPremarket = false, firedOpen = false;
  setInterval(async () => {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const h = now.getHours(), m = now.getMinutes();

    if (h === 9 && m === 8 && !firedPremarket) {
      firedPremarket = true;
      lockPremarketSpot();
    }
    if (h === 9 && m === 15 && !firedOpen) {
      firedOpen = true;
      setTimeout(captureFutureOpen, 5000);
    }
    if (h === 9 && m >= 15 || (h > 9 && h < 15) || (h === 15 && m <= 30)) {
      if (PM_STATE.status === "live") liveScan();
    }
    if (h === 9 && m === 5) {
      firedPremarket = false;
      firedOpen = false;
    }
  }, 20000);
}

module.exports = { PM_STATE, lockPremarketSpot, captureFutureOpen, liveScan, startScheduler };
