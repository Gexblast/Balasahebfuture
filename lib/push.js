// lib/push.js
const webpush = require("web-push");

let subscriptions = [];

function init() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:you@example.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

function addSubscription(sub) {
  const exists = subscriptions.find(s => s.endpoint === sub.endpoint);
  if (!exists) subscriptions.push(sub);
}

async function broadcast(payload) {
  const results = await Promise.allSettled(
    subscriptions.map(sub => webpush.sendNotification(sub, JSON.stringify(payload)))
  );
  // drop dead subscriptions
  subscriptions = subscriptions.filter((_, i) => results[i].status === "fulfilled");
  return results.length;
}

module.exports = { init, addSubscription, broadcast, subscriptions: () => subscriptions };
