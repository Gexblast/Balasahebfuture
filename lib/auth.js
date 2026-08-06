// lib/auth.js
// Angel One SmartAPI login using auto-generated TOTP (no manual OTP entry needed).
const axios = require("axios");
const speakeasy = require("speakeasy");

const BASE = "https://apiconnect.angelone.in";

let session = {
  jwtToken: null,
  refreshToken: null,
  feedToken: null,
  clientCode: null,
  loggedInAt: null
};

function generateTotp() {
  return speakeasy.totp({
    secret: process.env.SMARTAPI_TOTP_SECRET,
    encoding: "base32"
  });
}

async function login() {
  const totp = generateTotp();
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-UserType": "USER",
    "X-SourceID": "WEB",
    "X-ClientLocalIP": "127.0.0.1",
    "X-ClientPublicIP": "127.0.0.1",
    "X-MACAddress": "00:00:00:00:00:00",
    "X-PrivateKey": process.env.SMARTAPI_API_KEY
  };

  const body = {
    clientcode: process.env.SMARTAPI_CLIENT_CODE,
    password: process.env.SMARTAPI_PASSWORD_OR_PIN,
    totp
  };

  const res = await axios.post(`${BASE}/rest/auth/angelbroking/user/v1/loginByPassword`, body, { headers });
  const data = res.data?.data;
  if (!data) throw new Error("SmartAPI login failed: " + JSON.stringify(res.data));

  session = {
    jwtToken: data.jwtToken,
    refreshToken: data.refreshToken,
    feedToken: data.feedToken,
    clientCode: process.env.SMARTAPI_CLIENT_CODE,
    loggedInAt: Date.now()
  };
  console.log("[auth] SmartAPI login OK at", new Date().toLocaleTimeString());
  return session;
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-UserType": "USER",
    "X-SourceID": "WEB",
    "X-ClientLocalIP": "127.0.0.1",
    "X-ClientPublicIP": "127.0.0.1",
    "X-MACAddress": "00:00:00:00:00:00",
    "X-PrivateKey": process.env.SMARTAPI_API_KEY,
    Authorization: `Bearer ${session.jwtToken}`
  };
}

async function ensureLoggedIn() {
  // re-login if never logged in or session older than 7 hours
  if (!session.jwtToken || Date.now() - session.loggedInAt > 7 * 60 * 60 * 1000) {
    await login();
  }
  return session;
}

async function getLTP(exchange, tradingsymbol, symboltoken) {
  await ensureLoggedIn();
  try {
    const res = await axios.post(
      `${BASE}/rest/secure/angelbroking/order/v1/getLtpData`,
      { exchange, tradingsymbol, symboltoken },
      { headers: authHeaders() }
    );
    return res.data?.data || null;
  } catch (e) {
    console.error("[auth] getLTP error:", e.response?.data || e.message);
    return null;
  }
}

module.exports = { login, ensureLoggedIn, authHeaders, getLTP, session: () => session, BASE };
