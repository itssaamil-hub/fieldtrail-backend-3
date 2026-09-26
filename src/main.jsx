import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.jsx";
import "./index.css";
import "./salesman-dashboard-cards.css";
import "./admin-mobile-lead-trend.css";
import "./admin-team-activity.css";
import "./expense-report-enhance.css";
import "./employee-panel-enhance.css";
import "./performance-report-enhance.css";
import "./performance-insights-enhance.css";
import "./onboarding-live-share.css";
import "./quotation-settings-enhance.css";
import "./exception-centre-fixes.css";
import "./add-lead-polish.css";

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
