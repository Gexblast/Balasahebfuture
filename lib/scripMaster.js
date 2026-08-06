// lib/scripMaster.js
// Loads Angel One's public instrument/scrip master JSON and provides lookups.
const axios = require("axios");

const SCRIP_MASTER_URL = "https://margincalculator.angelone.in/OpenAPI_File/files/OpenAPIScripMaster.json";

let scripMaster = [];
let lastLoadedAt = null;

async function loadScripMaster() {
  const res = await axios.get(SCRIP_MASTER_URL, { timeout: 30000 });
  scripMaster = res.data || [];
  lastLoadedAt = Date.now();
  console.log(`[scripMaster] loaded ${scripMaster.length} instruments`);
  return scripMaster.length;
}

function all() {
  return scripMaster;
}

function getFnOStockList() {
  const futs = scripMaster.filter(s => s.instrumenttype === "FUTSTK");
  return [...new Set(futs.map(s => s.name))];
}

function nearestFuture(underlying, isIndex) {
  const type = isIndex ? "FUTIDX" : "FUTSTK";
  const matches = scripMaster
    .filter(s => s.instrumenttype === type && s.name === underlying)
    .sort((a, b) => new Date(a.expiry) - new Date(b.expiry));
  return matches[0] || null;
}

function spotToken(underlying, isIndex, spotExch) {
  if (isIndex) {
    return scripMaster.find(
      s => s.symbol === underlying && s.exch_seg === (spotExch || "NSE")
    );
  }
  return scripMaster.find(
    s => s.name === underlying && s.instrumenttype === "EQ" && s.exch_seg === "NSE"
  );
}

function optionChainTokens(underlying, expiry) {
  return scripMaster.filter(
    s => s.name === underlying && s.expiry === expiry && (s.instrumenttype === "OPTSTK" || s.instrumenttype === "OPTIDX")
  );
}

module.exports = {
  loadScripMaster,
  all,
  getFnOStockList,
  nearestFuture,
  spotToken,
  optionChainTokens,
  lastLoadedAt: () => lastLoadedAt
};
