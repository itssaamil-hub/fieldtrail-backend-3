import { test, expect } from '@playwright/test';
import { api } from '../src/api.js';
import { recoverPushSubscription } from '../src/pushSubscriptionRecovery.js';

function installPushGlobals({ existingSubscription = null, createdSubscription }) {
  const originals = {
    window: globalThis.window,
    navigator: globalThis.navigator,
    Notification: globalThis.Notification,
    localStorage: globalThis.localStorage,
  };

  let subscribeCalls = 0;
  const registration = {
    pushManager: {
      getSubscription: async () => existingSubscription,
      subscribe: async () => {
        subscribeCalls += 1;
        return createdSubscription;
      },
    },
  };

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      PushManager: function PushManager() {},
      atob: value => Buffer.from(value, 'base64').toString('binary'),
    },
  });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { serviceWorker: { register: async () => registration } },
  });
  Object.defineProperty(globalThis, 'Notification', {
    configurable: true,
    value: { permission: 'granted' },
  });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: key => key === 'fieldtrail:session'
        ? JSON.stringify({ id: 'user-1', token: 'token-1', role: 'admin' })
        : null,
    },
  });

  return {
    get subscribeCalls() { return subscribeCalls; },
    restore() {
      for (const [key, value] of Object.entries(originals)) {
        if (value === undefined) delete globalThis[key];
        else Object.defineProperty(globalThis, key, { configurable: true, value });
      }
    },
  };
}

const jsonSubscription = endpoint => ({
  endpoint,
  keys: { p256dh: 'p256dh', auth: 'auth' },
});

test('silently recreates a missing push subscription when permission is already granted', async () => {
  const created = {
    options: { applicationServerKey: new Uint8Array([1, 2, 3]).buffer },
    toJSON: () => jsonSubscription('https://push.example/new'),
  };
  const globals = installPushGlobals({ createdSubscription: created });
  const originalVapid = api.notificationsVapidKey;
  const originalSubscribe = api.notificationsSubscribe;
  const saved = [];
  api.notificationsVapidKey = async () => ({ publicKey: 'AQID' });
  api.notificationsSubscribe = async value => { saved.push(value); return { ok: true }; };

  try {
    await expect(recoverPushSubscription({ force: true })).resolves.toBe(true);
    expect(globals.subscribeCalls).toBe(1);
    expect(saved).toEqual([jsonSubscription('https://push.example/new')]);
  } finally {
    api.notificationsVapidKey = originalVapid;
    api.notificationsSubscribe = originalSubscribe;
    globals.restore();
  }
});

test('replaces a browser subscription created with a different VAPID public key', async () => {
  let unsubscribed = 0;
  const oldSubscription = {
    options: { applicationServerKey: new Uint8Array([9, 9, 9]).buffer },
    unsubscribe: async () => { unsubscribed += 1; return true; },
    toJSON: () => jsonSubscription('https://push.example/old'),
  };
  const replacement = {
    options: { applicationServerKey: new Uint8Array([1, 2, 3]).buffer },
    toJSON: () => jsonSubscription('https://push.example/replacement'),
  };
  const globals = installPushGlobals({ existingSubscription: oldSubscription, createdSubscription: replacement });
  const originalVapid = api.notificationsVapidKey;
  const originalSubscribe = api.notificationsSubscribe;
  const saved = [];
  api.notificationsVapidKey = async () => ({ publicKey: 'AQID' });
  api.notificationsSubscribe = async value => { saved.push(value); return { ok: true }; };

  try {
    await expect(recoverPushSubscription({ force: true })).resolves.toBe(true);
    expect(unsubscribed).toBe(1);
    expect(globals.subscribeCalls).toBe(1);
    expect(saved).toEqual([jsonSubscription('https://push.example/replacement')]);
  } finally {
    api.notificationsVapidKey = originalVapid;
    api.notificationsSubscribe = originalSubscribe;
    globals.restore();
  }
});
