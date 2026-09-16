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
