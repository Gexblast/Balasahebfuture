# Gamma X — Full Backend (new standalone repo)

एका महत्त्वाच्या गोष्टीबद्दल स्पष्ट सांगतो: तुझ्या जुन्या `finalultimate01` backend चा actual source code माझ्याकडे कधीच नव्हता (फक्त त्याचं वर्णन माझ्या नोट्समध्ये होतं). त्यामुळे हा एक **fresh backend** आहे — जुन्या backend मधले सगळे described features (Greeks, second-order Greeks, GEX/DEX/walls, Gamma Flip) मी standard formulas वापरून पुन्हा बांधले आहेत. Logic आणि output shape सारखं असेल, पण exact जुनी implementation नाही.

**यात नाहीये (जुन्यात होतं, पण माझ्याकडे त्याचे exact source/credentials/URLs नव्हते):**
- FII/DII flow scraping from NSE — वेगळं module म्हणून नंतर सांग, बनवून देतो
- Google Sheet auto win-rate logging — यासाठी तुझा Google Service Account JSON + Sheet ID लागेल

## काय आहे

- `lib/auth.js` — Angel One SmartAPI auto-TOTP login (speakeasy वापरून, manual OTP नाही)
- `lib/scripMaster.js` — scrip master load + token lookup (spot, nearest future, option chain)
- `lib/greeks.js` — Black-Scholes: delta/gamma/theta/vega/rho + second order (vanna, charm, vomma, speed, zomma, color) + implied vol solver
- `lib/gex.js` — per-strike GEX/DEX, Call Wall, Put Wall, Gamma Flip point, regime (positive/negative GEX)
- `lib/push.js` — VAPID web push for alarms
- `lib/premarketScanner.js` — तुझा नवीन future-vs-spot scanner (9:08 lock → 9:15 open capture → live scan)
- `server.js` — सगळं जोडणारा Express app

## Render वर deploy करताना Environment Variables (Settings → Environment)

`.env.example` मधले सगळे paste कर, फक्त तुझे actual values भरून:

```
SMARTAPI_CLIENT_CODE=
SMARTAPI_PASSWORD_OR_PIN=
SMARTAPI_API_KEY=
SMARTAPI_TOTP_SECRET=
VAPID_PUBLIC_KEY=BByS86iIClTXjmenmNkYJjLTc8qumjlf_Ex4dJ59X4LMbxNtHTCMX_p_eXuvSQ4cnU0g9PTUEkfAUBuLNG8QH3E
VAPID_PRIVATE_KEY=H_Qr_pd63mp2GWfvl_j0yXf-ymWZU1-IzTaMg2cFETk
VAPID_SUBJECT=mailto:you@example.com
PORT=3000
```

**VAPID keys वरती दिलेल्या copy-paste करून वापर — या backend साठी नवीन generate केलेल्या आहेत, तुझ्या जुन्या PWA च्या hardcoded key शी match होणार नाहीत (ते वेगळं बरं आहे, कारण जुनी issue तीच होती). PWA मध्ये हार्डकोड न करता `/vapid-public-key` वरून live fetch कर.**

## Render Build/Start commands

- Build Command: `npm install`
- Start Command: `npm start`

## Deploy steps (तुझ्या नेहमीच्या workflow प्रमाणे)

1. GitHub वर नवीन repo बनव, हे सगळे files "Upload files" ने टाक (मोठे files paste ऐवजी upload वापर)
2. Render वर नवीन Web Service → त्या repo ला connect कर
3. वरचे Environment Variables टाक
4. Deploy — logs मध्ये `[boot] Gamma X full backend ready` दिसलं की backend तयार

## Routes

- `GET /health` — login status, scrip count
- `GET /ltp?exchange=&tradingsymbol=&symboltoken=`
- `POST /greeks` — `{S,K,T,sigma,isCall}` → all Greeks incl. second order
- `POST /implied-vol` — `{price,S,K,T,isCall}`
- `POST /gex-dex` — `{chainRows,spot,T,lotSize}` → GEX/DEX/walls/gamma flip
- `GET /vapid-public-key`, `POST /subscribe`, `POST /broadcast`
- `GET /premarket-scan`, `GET /open-scan`, `GET /live-scan` (+ `/trigger` variants for manual testing)
- `GET /fno-stock-list`, `GET /nearest-future?underlying=&isIndex=`

PWA फक्त इतकंच करायचं: Netlify वर deploy → backend URL ची render.com link `gx_backend_url` म्हणून save कर → "Add to Home Screen" ने standalone install.
