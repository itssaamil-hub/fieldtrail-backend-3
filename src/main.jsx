import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.jsx";
import "./index.css";
import "./dashboardComparisons.js";
import "./dashboardTaskCard.js";
import "./dashboardGreeting.js";
import "./dashboardMapControls.js";
import "./salesmanDashboardCards.js";
import "./salesman-dashboard-cards.css";
import "./onboardingLiveShare.js";
import "./onboarding-live-share.css";
import "./quotationSettingsEnhance.js";
import "./quotation-settings-enhance.css";
import "./exceptionCentreMount.jsx";
import "./exceptionCentreUxFix.js";
import "./exception-centre-fixes.css";
import "./exceptionLeadDrawer.jsx";

// Silent auto-update: check for a new worker as soon as the app opens so an
// installed PWA does not stay on an older cached dashboard bundle.
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    registration?.update().catch(() => {});
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
