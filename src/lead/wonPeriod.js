export const ADMIN_WON_PERIOD_STORAGE_KEY = "engage:admin-won-period";
export const ADMIN_WON_PERIOD_CHANGE_EVENT = "engage-admin-won-period";

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
  if (storage === globalThis?.localStorage && typeof globalThis?.dispatchEvent === "function" && typeof globalThis?.CustomEvent === "function") {
    globalThis.dispatchEvent(new CustomEvent(ADMIN_WON_PERIOD_CHANGE_EVENT, { detail: { period: normalized } }));
  }
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

export function adminWonScopeMetrics(leads = [], period = "all", resolvedWonDates = {}, now = new Date()) {
  const normalizedPeriod = normalizeAdminWonPeriod(period);
  const currentWon = leads.filter((lead) => lead?.status === "won");
  if (normalizedPeriod === "all") {
    return {
      ready: true,
      leads: currentWon,
      count: currentWon.length,
      value: currentWon.reduce((sum, lead) => sum + (Number(lead?.dealValue) || 0), 0),
    };
  }

  let ready = true;
  const scoped = [];
  for (const lead of currentWon) {
    const hasResolvedFallback = Object.prototype.hasOwnProperty.call(resolvedWonDates || {}, lead.id);
    const canonicalWonDate = lead.wonDate || (hasResolvedFallback ? resolvedWonDates[lead.id] : undefined);
    if (!canonicalWonDate) {
      ready = false;
      continue;
    }
    if (isWonDateInCurrentIstMonth(canonicalWonDate, now)) scoped.push(lead);
  }

  return {
    ready,
    leads: scoped,
    count: ready ? scoped.length : null,
    value: ready ? scoped.reduce((sum, lead) => sum + (Number(lead?.dealValue) || 0), 0) : null,
  };
}
