import { ApiError, getApiBase, getSession } from "./api.js";

function qs(params = {}) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value != null && value !== "")).toString();
  return query ? `?${query}` : "";
}

async function request(path, { method = "GET", body, blob = false } = {}) {
  const base = getApiBase();
  if (!base) throw new ApiError("No backend configured yet.", 0);
  const token = getSession()?.token || "";
  let response;
  try {
    response = await fetch(`${base}${path}`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Could not reach the server — check your connection.", 0);
  }
  if (blob && response.ok) return response.blob();
  let data = null;
  try { data = await response.json(); } catch { /* no JSON body */ }
  if (!response.ok) throw new ApiError(data?.error || `Request failed (${response.status})`, response.status);
  return data;
}

export const attendanceV2Api = {
  report: (params) => request(`/attendance-v2/report${qs(params)}`),
  settings: (params) => request(`/attendance-v2/settings${qs(params)}`),
  lateStartUi: () => request("/attendance-v2/late-start-ui"),
  saveLateStartUi: (body) => request("/attendance-v2/late-start-ui", { method: "PUT", body }),
  saveCompany: (body) => request("/attendance-v2/settings/company", { method: "PUT", body }),
  saveEmployee: (id, body) => request(`/attendance-v2/settings/employee/${id}`, { method: "PUT", body }),
  saveException: (body) => request("/attendance-v2/exceptions", { method: "POST", body }),
  deleteException: (id) => request(`/attendance-v2/exceptions/${id}`, { method: "DELETE" }),
  audit: (params) => request(`/attendance-v2/exceptions/audit${qs(params)}`),
  closeSession: (id, body) => request(`/attendance-v2/sessions/${id}/close`, { method: "POST", body }),
  export: (params) => request(`/attendance-v2/export${qs(params)}`, { blob: true }),
};

export function saveAttendanceExport(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
