// Display-only renewal countdown for the existing KPI and renewal lists.
// Calendar days use India time, not a rolling 24-hour interval.
const DAY_MS = 86400000;
function todayInIndia(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return value.year + "-" + value.month + "-" + value.day;
}
function isoDay(value) {
  if (!value) return null;
  const day = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const [year, month, date] = day.split("-").map(Number);
  const utc = Date.UTC(year, month - 1, date);
  if (!Number.isFinite(utc) || new Date(utc).toISOString().slice(0, 10) !== day) return null;
  return utc;
}
export function daysUntilRenewal(renewalDate, now = new Date()) {
  const due = isoDay(renewalDate);
  const today = isoDay(todayInIndia(now));
  return due === null || today === null ? null : Math.round((due - today) / DAY_MS);
}
export function renewalCountdown(renewalDate, now = new Date()) {
  const days = daysUntilRenewal(renewalDate, now);
  if (days === null) return "";
  if (days === 0) return "Due today";
  if (days < 0) return Math.abs(days) + " day" + (days === -1 ? "" : "s") + " overdue";
  return days + " day" + (days === 1 ? "" : "s") + " left";
}
export function nearestRenewalCountdown(leads = [], now = new Date()) {
  let nearest = null;
  for (const lead of leads) {
    const days = daysUntilRenewal(lead?.renewalDate, now);
    if (days !== null && days >= 0 && (nearest === null || days < nearest)) nearest = days;
  }
  if (nearest === null) return "";
  return nearest === 0 ? "Due today" : nearest + " day" + (nearest === 1 ? "" : "s") + " left";
}
