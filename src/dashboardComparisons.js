import { getApiBase, getSession } from "./api.js";

const DEFAULT_DISPLAY_SETTINGS = Object.freeze({
  showAdminComparisons: true,
  showEmployeeComparisons: true,
  comparisonPeriod: "weekly",
});

async function dashboardRequest(path, options = {}) {
  const base = getApiBase();
  const session = getSession();
  if (!base) throw new Error("No backend configured yet.");
  if (!session?.token) throw new Error("Sign in again to load dashboard comparisons.");
  const response = await fetch(`${base}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.token}`,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  let data = null;
  try { data = await response.json(); } catch { /* ignored */ }
  if (!response.ok) throw new Error(data?.error || `Request failed (${response.status})`);
  return data || {};
}

export function normalizeDashboardDisplaySettings(value) {
  const raw = value && typeof value === "object" ? value : {};
  return {
    showAdminComparisons: raw.showAdminComparisons !== false,
    showEmployeeComparisons: raw.showEmployeeComparisons !== false,
    comparisonPeriod: raw.comparisonPeriod === "monthly" ? "monthly" : "weekly",
  };
}

export async function loadDashboardDisplaySettings() {
  const role = getSession()?.role;
  const path = role === "admin"
    ? "/admin/dashboard-comparisons/settings"
    : "/salesman/dashboard-display-settings";
  const result = await dashboardRequest(path);
  return normalizeDashboardDisplaySettings(result.displaySettings || DEFAULT_DISPLAY_SETTINGS);
}

export async function saveDashboardDisplaySettings(settings) {
  const result = await dashboardRequest("/admin/dashboard-comparisons/settings", {
    method: "PATCH",
    body: normalizeDashboardDisplaySettings(settings),
  });
  return normalizeDashboardDisplaySettings(result.displaySettings || settings);
}

export async function loadAdminDashboardComparisons(salesmanId = "all") {
  const params = new URLSearchParams();
  if (salesmanId && salesmanId !== "all") params.set("salesmanId", salesmanId);
  const suffix = params.toString() ? `?${params}` : "";
  return dashboardRequest(`/admin/dashboard-comparisons${suffix}`);
}

export async function loadEmployeeDashboardComparisons() {
  return dashboardRequest("/salesman/dashboard-comparisons");
}
