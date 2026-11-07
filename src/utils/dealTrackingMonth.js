export function currentTrackingMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit",
  }).formatToParts(now);
  return parts.find(part => part.type === "year").value + "-" +
    parts.find(part => part.type === "month").value;
}

export function trackingMonthOptions(count = 6, now = new Date()) {
  const [year, month] = currentTrackingMonth(now).split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const first = new Date(Date.UTC(year, month - 1 - i, 1));
    return {
      value: first.toISOString().slice(0, 7),
      label: new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }).format(first),
    };
  });
}

export function applyTrackedDealFilters(deals, filters) {
  const {
    employeeId = "all", city = "", status = "all", date = "",
    search = "", cityByEmployee = new Map(),
  } = filters;
  const needle = search.trim().toLowerCase();
  const cityNeedle = city.trim().toLowerCase();
  return deals.filter(lead =>
    (employeeId === "all" || lead.salesmanId === employeeId) &&
    (!cityNeedle || String(cityByEmployee.get(lead.salesmanId) || "").toLowerCase().includes(cityNeedle)) &&
    (status === "all" || lead.status === status) &&
    (!date || lead.createdAt?.toISOString().slice(0, 10) === date) &&
    (!needle || [lead.business, lead.owner, lead.phone, lead.subLocation].some(
      item => item && String(item).toLowerCase().includes(needle)
    ))
  );
}
