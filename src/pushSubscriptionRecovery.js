import { api, getSession } from "./api.js";

let recoveryInFlight = null;
let lastRecoveryAt = 0;

function supported() {
  return typeof window !== "undefined"
    && "serviceWorker" in navigator
    && "PushManager" in window
    && typeof Notification !== "undefined";
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) output[i] = rawData.charCodeAt(i);
  return output;
}

export function applicationServerKeysMatch(existingKey, currentKey) {
  if (!existingKey) return null;
  const existing = new Uint8Array(existingKey);
  if (existing.length !== currentKey.length) return false;
  for (let i = 0; i < existing.length; i += 1) {
    if (existing[i] !== currentKey[i]) return false;
  }
  return true;
}

export async function recoverPushSubscription({ force = false } = {}) {
  if (!supported() || Notification.permission !== "granted" || !getSession()?.token) return false;

  const now = Date.now();
  if (!force && now - lastRecoveryAt < 60000) return false;
  if (recoveryInFlight) return recoveryInFlight;

  recoveryInFlight = (async () => {
    const registration = await navigator.serviceWorker.register("/push/push-sw.js", { scope: "/push/" });
    const { publicKey } = await api.notificationsVapidKey();
    if (!publicKey) throw new Error("Push public key is unavailable.");
    const currentKey = urlBase64ToUint8Array(publicKey);

    let subscription = await registration.pushManager.getSubscription();
    const keyMatch = applicationServerKeysMatch(subscription?.options?.applicationServerKey, currentKey);

    // A browser subscription is permanently bound to the VAPID public key
    // used when it was created. If the server key has changed, replace the
    // local subscription instead of repeatedly sending with an incompatible key.
    if (subscription && keyMatch === false) {
      await subscription.unsubscribe();
      subscription = null;
    }

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: currentKey,
      });
    }

    // Backend upsert is idempotent by endpoint, so this also restores a row
    // that was removed after a 404/410 without creating duplicates.
    await api.notificationsSubscribe(subscription.toJSON());
    lastRecoveryAt = Date.now();
    return true;
  })().finally(() => {
    recoveryInFlight = null;
  });

  return recoveryInFlight;
}

export function startPushSubscriptionRecovery() {
  if (!supported()) return () => {};

  let lastSessionKey = "";
  const checkSession = () => {
    const session = getSession();
    const sessionKey = session?.token ? `${session.id || ""}:${session.token}` : "";
    if (!sessionKey) {
      lastSessionKey = "";
      return;
    }
    if (sessionKey !== lastSessionKey) {
      lastSessionKey = sessionKey;
      recoverPushSubscription({ force: true }).catch(() => {});
    }
  };
  const recoverOnWake = () => {
    checkSession();
    if (document.visibilityState !== "hidden") recoverPushSubscription().catch(() => {});
  };

  checkSession();
  // Login/logout happens inside the SPA, so cheaply watch only session identity;
  // no push/network call is made unless the account actually changes.
  const sessionTimer = window.setInterval(checkSession, 2000);
  window.addEventListener("focus", recoverOnWake);
  window.addEventListener("online", recoverOnWake);
  document.addEventListener("visibilitychange", recoverOnWake);

  return () => {
    window.clearInterval(sessionTimer);
    window.removeEventListener("focus", recoverOnWake);
    window.removeEventListener("online", recoverOnWake);
    document.removeEventListener("visibilitychange", recoverOnWake);
  };
}
