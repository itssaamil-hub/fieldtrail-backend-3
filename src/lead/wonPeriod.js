export const ADMIN_WON_PERIOD_STORAGE_KEY = "engage:admin-won-period";

export function normalizeAdminWonPeriod(value) {
  return value === "month" ? "month" : "all";
}

export function readAdminWonPeriod(storage = globalThis?.localStorage) {
  try {
    return normalizeAdminWonPeriod(storage?.getItem(ADMIN_WON_PERIOD_STORAGE_KEY));
  } catch {
    return "all";
  }
}

export function writeAdminWonPeriod(value, storage = globalThis?.localStorage) {
  const normalized = normalizeAdminWonPeriod(value);
  try { storage?.setItem(ADMIN_WON_PERIOD_STORAGE_KEY, normalized); } catch { /* optional preference */ }
  return normalized;
}

function istYearMonth(value) {
  if (!value) return null;
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw.slice(0, 7);
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return year && month ? `${year}-${month}` : null;
}

export function isWonDateInCurrentIstMonth(wonDate, now = new Date()) {
  const wonMonth = istYearMonth(wonDate);
  const currentMonth = istYearMonth(now);
  return Boolean(wonMonth && currentMonth && wonMonth === currentMonth);
}
