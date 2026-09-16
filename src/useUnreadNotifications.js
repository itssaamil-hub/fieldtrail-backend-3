import { useEffect, useState } from 'react';
import { api } from './api.js';
export default function useUnreadNotifications(session, online) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let cancelled = false, sequence = 0;
    setCount(0);
    if (!session || !online) return;
    const refresh = async () => {
      if (document.visibilityState === 'hidden') return;
      const current = ++sequence;
      try {
        const result = await api.notificationsUnread();
        if (!cancelled && current === sequence) setCount(Math.max(0, Number(result.count) || 0));
      } catch { /* No fake badge on an unavailable backend. Retry when active. */ }
    };
    refresh();
    const timer = setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    window.addEventListener('fieldtrail:notifications-read', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      cancelled = true; clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('fieldtrail:notifications-read', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [session?.id, session?.token, online]);
  return count;
}
