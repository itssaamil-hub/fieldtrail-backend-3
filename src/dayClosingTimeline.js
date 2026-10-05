export function filterTimelineForSession(events = [], session = {}, now = Date.now()) {
  const start = Date.parse(session?.start_day_at || session?.startedAt || '');
  if (!Number.isFinite(start)) return [];

  const explicitEnd = Date.parse(session?.end_day_at || session?.endedAt || '');
  const end = Number.isFinite(explicitEnd) ? explicitEnd : Number(now);
  if (!Number.isFinite(end) || end < start) return [];

  return (Array.isArray(events) ? events : []).filter((event) => {
    const at = Date.parse(event?.at || '');
    return Number.isFinite(at) && at >= start && at <= end;
  });
}
