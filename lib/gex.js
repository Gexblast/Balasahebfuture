// lib/gex.js
// Per-strike GEX/DEX aggregation, Call/Put walls, Gamma Flip point.
const { computeGreeks } = require("./greeks");

const LOT_SIZE_DEFAULT = 25; // override per-symbol from scripMaster.lotsize where available

/**
 * chainRows: [{ strike, ce: { oi, price }, pe: { oi, price } }, ...]
 * spot, T (years to expiry), lotSize
 */
function computeGexDex({ chainRows, spot, T, lotSize = LOT_SIZE_DEFAULT, r = 0.065 }) {
  let totalGEX = 0, totalDEX = 0;
  const perStrike = [];

  for (const row of chainRows) {
    const { strike, ce, pe } = row;
    let ceGamma = 0, ceDelta = 0, peGamma = 0, peDelta = 0;

    if (ce?.oi && ce?.iv) {
      const g = computeGreeks({ S: spot, K: strike, T, r, sigma: ce.iv, isCall: true });
      if (g) { ceGamma = g.gamma; ceDelta = g.delta; }
    }
    if (pe?.oi && pe?.iv) {
      const g = computeGreeks({ S: spot, K: strike, T, r, sigma: pe.iv, isCall: false });
      if (g) { peGamma = g.gamma; peDelta = g.delta; }
    }

    // dealer is assumed short options -> dealer gamma exposure is negative of customer long gamma
    const strikeGEX = -1 * ((ceGamma * (ce?.oi || 0)) + (peGamma * (pe?.oi || 0))) * lotSize * spot * spot * 0.01;
    const strikeDEX = -1 * ((ceDelta * (ce?.oi || 0)) + (peDelta * (pe?.oi || 0))) * lotSize;

    perStrike.push({
      strike,
      ceOI: ce?.oi || 0,
      peOI: pe?.oi || 0,
      gex: +strikeGEX.toFixed(0),
      dex: +strikeDEX.toFixed(0)
    });

    totalGEX += strikeGEX;
    totalDEX += strikeDEX;
  }

  const callWall = perStrike.reduce((a, b) => (b.ceOI > (a?.ceOI || 0) ? b : a), null);
  const putWall = perStrike.reduce((a, b) => (b.peOI > (a?.peOI || 0) ? b : a), null);

  // Gamma flip: strike where cumulative GEX crosses zero, sorted by strike
  const sorted = [...perStrike].sort((a, b) => a.strike - b.strike);
  let cum = 0, flipStrike = null;
  for (let i = 0; i < sorted.length; i++) {
    const prevCum = cum;
    cum += sorted[i].gex;
    if (prevCum < 0 && cum >= 0) { flipStrike = sorted[i].strike; break; }
    if (prevCum > 0 && cum <= 0) { flipStrike = sorted[i].strike; break; }
  }

  return {
    totalGEX: +totalGEX.toFixed(0),
    totalDEX: +totalDEX.toFixed(0),
    regime: totalGEX >= 0 ? "positive_gex_range_bound" : "negative_gex_trending",
    callWall: callWall?.strike ?? null,
    putWall: putWall?.strike ?? null,
    gammaFlip: flipStrike,
    perStrike: sorted
  };
}

module.exports = { computeGexDex };
