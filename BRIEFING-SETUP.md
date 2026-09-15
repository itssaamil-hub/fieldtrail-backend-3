# Daily briefing and notification bell

## What changed

- A bell next to Settings opens the Notifications panel.
- Salesmen see their own personalized, natural-language briefing, focus for today, and up to five priority leads. View lead opens the existing lead drawer on the dashboard.
- Admins can select an active employee to read their briefing and see priority contacts.
- Morning push notifications point to /#sales-briefing. Opening a notification brings up the same panel, including when another app tab is already open. Logged-out users sign in first and then see their briefing.
- The panel displays the latest CRM data, not a historical snapshot of the push. Hello is used so the greeting works throughout the day.
- Settings → Notifications includes Daily sales briefing. Turning it off disables scheduled briefing pushes, not access to the panel.
- Loading, offline, API-error/retry, empty-pipeline and no-active-employee states are handled. No fake unread counts are displayed.

## Deploy both projects

1. Deploy the matching updated backend ZIP to your existing backend service first. Its npm start runs migration 015. Keep the existing database, CRON_SECRET, and VAPID environment values.
2. Deploy this frontend through your existing frontend repository/hosting workflow: npm install, npm run build; publish dist. Keep your VITE_API_BASE_URL or existing in-app backend setting.
3. Reopen/refresh the installed app after deployment so it loads the new app bundle and push worker.
4. Add a daily 9:00 AM Asia/Kolkata cron job: POST https://fieldtrail-backend.onrender.com/notifications/run-sales-briefing with x-cron-secret set to your existing CRON_SECRET. Existing daily-reminder and noon-digest schedules remain separate.
5. Sign in as a salesman, tap the bell, and verify the summary against actual leads. Enable push in Settings to receive morning notifications. An admin can inspect briefings without receiving employee morning pushes.

This uploaded frontend repository also contains older Express backend source files. They are preserved unchanged; they are not the current backend and must not replace the separate updated backend project. The root package.json is the Vite/React frontend package.

## Files changed

src/App.jsx, src/api.js, src/NotificationsPanel.jsx, src/notifications.css, public/push/push-sw.js, public/push-sw.js. package-lock.json pins the frontend dependencies used for the build. test/push-navigation.test.cjs covers service worker routing.

## Checks

npm run build
node --test test/push-navigation.test.cjs

The matching backend includes nine tests for briefing logic and scheduler behavior. Real push delivery and production database migrations still need deployment checks with your configured service and a subscribed device.

Validation completed: production build; four push-worker unit tests; DOM integration with mocked API responses covering notification bell, narrative rendering, priority lead drawer, signed-out notification link through login, warm hash navigation, close/Escape, API-error retry, and admin employee selection. A rendered browser/device check was not completed because the browser download timed out.
