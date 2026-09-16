# Brief / Activity slider

Admin → notification bell → small slider beside Close:

- Left: Brief, the existing employee briefing.
- Right: Activity, the team's recent actions.
- Click again to switch back. Keyboard Space/Enter also toggles it.

Activity shows names, lead additions/edits/deletions, deal status changes (including Hot), day starts/ends and other supported team events. Newest entries come first. Refresh reloads the newest page; Load older activity loads the next page. Activity covers all employees and admins independently of the briefing employee selector. Historical data is limited to previously recorded audit events.

The slider is admin-only. The salesman panel, main dashboard, App.jsx, existing notification bell size and other UI are preserved from this upload.

Deploy the matching backend first (migration 016 adds an activity-log index), then deploy this frontend with the existing npm run build → dist workflow. No new cron job or environment variable is required. Existing push notification destinations and the daily briefing remain unchanged.

Changed existing frontend files: src/NotificationsPanel.jsx, src/notifications.css, src/api.js. New component: src/ActivityFeed.jsx.

Validation: production Vite/PWA build; DOM integration with mocked API for toggling both ways, actor/status display, older-page loading, retry and salesman isolation. Existing push-navigation tests are retained. No production deployment or real browser screenshot verification was performed for this change.


## Unread badge update

The bell now matches Settings (30 × 30 button, 14px icon). A small red count sits above it; zero is hidden and values above 99 display 99+.

Admins: the count covers new Activity events. Opening Brief does not clear Activity. Loading the newest Activity page marks events through the newest displayed event as seen, including older pages; later arrivals remain unread. Refresh the Activity feed to see and acknowledge subsequent events.

Salesmen: the badge indicates today's delivered daily briefing until it is opened. It does not count every legacy reminder/status push or previous days' briefings. A briefing opened before it was delivered does not pre-clear the future notification.

Read state is saved per user in PostgreSQL and shared across their devices. Existing historical activity is not turned into an unread backlog when this migration is installed. Existing activity stays available in the feed. The badge refreshes once per minute while the app is visible, on focus, and after a read receipt. No new cron job is needed.

Deploy backend first: migration 017 creates notification_read_state. The normal npm start applies migrations. Then deploy the updated frontend and refresh the installed app. Production migrations/device behavior have not been run here.

Checks: 20 backend tests; frontend production build; DOM checks of badge 1 → 0, 30px button/14px icon, panel navigation, slider/pagination/retry and role isolation.
