import React, { useEffect, useRef, useState } from 'react';
import { Activity, RefreshCw, Flame, UserPlus, Pencil, Clock } from 'lucide-react';
import { api } from './api.js';

export default function ActivityFeed({ online }) {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [request, setRequest] = useState({ cursor: null, version: 0 });
  const pending = useRef(false);
  useEffect(() => {
    let cancelled = false;
    if (!online) { pending.current = false; setLoading(false); setError('You’re offline. Connect to load recent activity.'); return; }
    pending.current = true; setLoading(true); setError('');
    api.notificationsActivity(request.cursor).then(res => {
      if (cancelled) return;
      setItems(previous => request.cursor ? [...new Map([...previous, ...res.activities].map(item => [item.id, item])).values()] : res.activities);
      setCursor(res.nextCursor || null); setLoaded(true);
      if (!request.cursor && res.activities[0]) {
        api.notificationsMarkRead({ kind: 'activity', throughId: res.activities[0].id })
          .then(() => { if (!cancelled) window.dispatchEvent(new Event('fieldtrail:notifications-read')); })
          .catch(() => { /* Keep the badge unread if saving read state fails. */ });
      }
    }).catch(err => { if (!cancelled) setError(err.status === 401 ? 'Your session has expired. Sign in again.' : err.status === 403 ? 'Activity is available to admins only.' : err.status === 404 ? 'Activity is unavailable. Deploy the updated backend first.' : err.message || 'Could not load activity.'); })
      .finally(() => { if (!cancelled) { pending.current = false; setLoading(false); } });
    return () => { cancelled = true; pending.current = false; };
  }, [request, online]);
  const load = next => { if (pending.current) return; pending.current = true; setRequest(previous => ({ cursor: next, version: previous.version + 1 })); };
  return <section aria-label="Team activity">
    <div className="ft-notifications-caption"><span><Activity size={17} /> Team activity</span><button type="button" className="ft-notifications-icon" aria-label="Refresh activity" disabled={loading || !online} onClick={() => load(null)}><RefreshCw size={16} /></button></div>
    <div className="ft-notifications-date">All employees and admins · Newest first</div>
    {error && <div className="ft-notifications-error" role="alert"><p>{error}</p><button type="button" disabled={loading || !online} onClick={() => load(request.cursor)}>Retry activity</button></div>}
    {!error && loaded && !items.length && <p>No recorded activity yet. New leads and deal changes will appear here.</p>}
    <ol className="ft-activity-list">{items.map(item => {
      const Icon = item.toStatus === 'hot' ? Flame : item.action.includes('created') ? UserPlus : item.action.includes('attendance') ? Clock : Pencil;
      return <li key={item.id}><span className={`ft-activity-symbol${item.toStatus === 'hot' ? ' ft-activity-hot' : ''}`}><Icon size={16} aria-hidden="true" /></span><div><p>{item.description}</p><time className="ft-notifications-date" dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</time></div></li>;
    })}</ol>
    {loading && <p role="status">Loading activity…</p>}
    {!loading && !error && cursor && <button type="button" disabled={!online} onClick={() => load(cursor)}>Load older activity</button>}
  </section>;
}
