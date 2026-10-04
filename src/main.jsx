import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./quotationDeletePolicy.js";
import App from "./App.jsx";
import AppErrorBoundary from "./AppErrorBoundary.jsx";
import AccountSettingsLauncher from "./AccountSettings.jsx";
import BusinessNameTopBar from "./BusinessNameTopBar.jsx";
import LateStartToast from "./LateStartToast.jsx";
import { startPushSubscriptionRecovery } from "./pushSubscriptionRecovery.js";
import "./index.css";
import "./salesman-dashboard-cards.css";
import "./admin-mobile-lead-trend.css";
import "./admin-team-activity.css";
import "./expense-report-enhance.css";
import "./employee-panel-enhance.css";
import "./performance-report-enhance.css";
import "./performance-report-mobile.css";
import "./performance-report-core-metrics.css";
import "./performance-insights-enhance.css";
import "./onboarding-live-share.css";
import "./quotation-settings-enhance.css";
import "./exception-centre-fixes.css";
import "./add-lead-polish.css";
import "./lead-status-colors.css";
import "./exception-snooze-yellow.css";
import "./collections-quick-pay.css";
import "./salesmanLeadsViewToggle.js";
import "./adminMobileDealsViewToggle.js";
import "./salesmanPerformanceEnhanced.jsx";

// If an installed PWA opens against an older deployment and one of Vite's
// generated chunks no longer exists, reload once so the browser picks up the
// current app shell instead of leaving the user on a blank screen.
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  const key = "engage:preload-recovery";
  const last = Number(sessionStorage.getItem(key) || 0);
  const now = Date.now();
  if (now - last < 15000) return;
  sessionStorage.setItem(key, String(now));
  window.location.reload();
});

// Silent auto-update: check for a new worker as soon as the app opens so an
// installed PWA does not stay on an older cached dashboard bundle.
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    registration?.update().catch(() => {});
  },
});

// Keep an already-authorized device attached to Web Push. This never asks for
// notification permission; it only repairs/re-syncs subscriptions after the
// user has already granted permission.
startPushSubscriptionRecovery();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
      <BusinessNameTopBar />
      <AccountSettingsLauncher />
      <LateStartToast />
    </AppErrorBoundary>
  </React.StrictMode>
);