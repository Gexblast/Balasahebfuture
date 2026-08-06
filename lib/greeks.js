// lib/greeks.js
// Black-Scholes Greeks: first order (delta, gamma, theta, vega, rho)
// and second order (vanna, charm, vomma, speed, color, zomma).

function normPdf(x) {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

function normCdf(x) {
  // Abramowitz-Stegun approximation
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + p * x);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

function d1d2(S, K, T, r, sigma) {
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  return { d1, d2 };
}

// isCall = true for CE, false for PE
function computeGreeks({ S, K, T, r = 0.065, sigma, isCall }) {
  if (T <= 0 || sigma <= 0) return null;
  const { d1, d2 } = d1d2(S, K, T, r, sigma);
  const pdf1 = normPdf(d1);
  const sqrtT = Math.sqrt(T);

  const delta = isCall ? normCdf(d1) : normCdf(d1) - 1;
  const gamma = pdf1 / (S * sigma * sqrtT);
  const vega = S * pdf1 * sqrtT / 100; // per 1% IV move
  const theta = isCall
    ? (-(S * pdf1 * sigma) / (2 * sqrtT) - r * K * Math.exp(-r * T) * normCdf(d2)) / 365
    : (-(S * pdf1 * sigma) / (2 * sqrtT) + r * K * Math.exp(-r * T) * normCdf(-d2)) / 365;
  const rho = isCall
    ? (K * T * Math.exp(-r * T) * normCdf(d2)) / 100
    : (-K * T * Math.exp(-r * T) * normCdf(-d2)) / 100;

  // ---- second order ----
  const vanna = -pdf1 * d2 / sigma; // d(delta)/d(vol)
  const charm = isCall
    ? -pdf1 * ((2 * r * T - d2 * sigma * sqrtT) / (2 * T * sigma * sqrtT))
    : -pdf1 * ((2 * r * T - d2 * sigma * sqrtT) / (2 * T * sigma * sqrtT));
  const vomma = vega * 100 * (d1 * d2) / sigma; // sensitivity of vega to vol
  const speed = -(gamma / S) * (d1 / (sigma * sqrtT) + 1); // d(gamma)/d(S)
  const zomma = gamma * ((d1 * d2 - 1) / sigma); // d(gamma)/d(vol)
  const color = -pdf1 / (2 * S * T * sigma * sqrtT) *
    (2 * r * T + 1 + (2 * r * T - d2 * sigma * sqrtT) * d1 / (sigma * sqrtT));

  return {
    delta: +delta.toFixed(4),
    gamma: +gamma.toFixed(6),
    theta: +theta.toFixed(4),
    vega: +vega.toFixed(4),
    rho: +rho.toFixed(4),
    vanna: +vanna.toFixed(6),
    charm: +charm.toFixed(6),
    vomma: +vomma.toFixed(4),
    speed: +speed.toFixed(8),
    zomma: +zomma.toFixed(6),
    color: +color.toFixed(8)
  };
}

// Newton-Raphson implied vol solver from option premium
function impliedVol({ price, S, K, T, r = 0.065, isCall, guess = 0.25 }) {
  let sigma = guess;
  for (let i = 0; i < 50; i++) {
    const { d1, d2 } = d1d2(S, K, T, r, sigma);
    const modelPrice = isCall
      ? S * normCdf(d1) - K * Math.exp(-r * T) * normCdf(d2)
      : K * Math.exp(-r * T) * normCdf(-d2) - S * normCdf(-d1);
    const vega = S * normPdf(d1) * Math.sqrt(T);
    if (vega < 1e-8) break;
    const diff = modelPrice - price;
    if (Math.abs(diff) < 1e-4) break;
    sigma -= diff / vega;
    if (sigma <= 0.001) sigma = 0.001;
    if (sigma > 5) sigma = 5;
  }
  return +sigma.toFixed(4);
}

module.exports = { computeGreeks, impliedVol, normCdf, normPdf };
