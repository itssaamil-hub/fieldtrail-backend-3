import { ApiError, getApiBase, getSession } from "./api.js";

async function attendanceRequest(path, { method = "GET", body } = {}) {
  const base = getApiBase();
  if (!base) throw new ApiError("No backend configured yet.", 0);

  const token = getSession()?.token;
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Could not reach the server — check your connection.", 0);
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    // Some successful endpoints may not return JSON.
  }

  if (!response.ok) {
    throw new ApiError(data?.error || `Request failed (${response.status})`, response.status);
  }
  return data;
}

function queryString(params = {}) {
  const entries = Object.entries(params).filter(([, value]) => value != null && value !== "");
  const query = new URLSearchParams(entries).toString();
  return query ? `?${query}` : "";
}

export const attendanceApi = {
  settings: (params = {}) => attendanceRequest(`/day-closing/attendance-settings${queryString(params)}`),
  saveCompany: (body) => attendanceRequest("/day-closing/attendance-settings/company", { method: "PUT", body }),
  saveEmployee: (id, body) => attendanceRequest(`/day-closing/attendance-settings/employee/${id}`, { method: "PUT", body }),
  saveException: (body) => attendanceRequest("/day-closing/attendance-settings/exceptions", { method: "POST", body }),
  deleteException: (id) => attendanceRequest(`/day-closing/attendance-settings/exceptions/${id}`, { method: "DELETE" }),
};
