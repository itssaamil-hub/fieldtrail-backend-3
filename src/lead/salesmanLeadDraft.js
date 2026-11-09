// Salesman Add Deal is online-first: a local draft is not a submitted lead.
// Keep each employee's unfinished form on this browser only. Never persist GPS.
export const EMPTY_SALESMAN_LEAD_FORM = Object.freeze({
  business: "", subLocation: "", posName: "", renewalMonth: "", renewalDate: "",
  owner: "", phone: "", category: "", status: "cold", notes: "",
  dealValue: "", nextFollowUpDate: "",
});
const FIELDS = Object.keys(EMPTY_SALESMAN_LEAD_FORM);
const VERSION = 1;
const MAX_PHOTO_BASE64_CHARS = 210000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function salesmanLeadDraftKey(employeeId) {
  return `engage:salesman-add-lead-draft:v1:${encodeURIComponent(String(employeeId || ""))}`;
}

function storageOrDefault(storage) {
  if (storage) return storage;
  return typeof window === "undefined" ? null : window.localStorage;
}

function normalizedForm(input) {
  const form = {...EMPTY_SALESMAN_LEAD_FORM};
  if (!input || typeof input !== "object" || Array.isArray(input)) return form;
  for (const field of FIELDS) {
    if (typeof input[field] === "string") form[field] = input[field].slice(0, 10000);
  }
  return form;
}

function normalizedPhoto(photo) {
  if (!photo || typeof photo !== "object") return null;
  if (typeof photo.base64 !== "string" || !photo.base64.length ||
      photo.base64.length > MAX_PHOTO_BASE64_CHARS ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(photo.base64)) return null;
  const bytes = Number(photo.bytes);
  if (!Number.isInteger(bytes) || bytes <= 0 || bytes > 150 * 1024) return null;
  return {
    base64: photo.base64, bytes,
    width: Number(photo.width) || 0, height: Number(photo.height) || 0,
  };
}

export function loadSalesmanLeadDraft(employeeId, storage) {
  if (!employeeId) return null;
  try {
    const raw = storageOrDefault(storage)?.getItem(salesmanLeadDraftKey(employeeId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== VERSION || !UUID.test(parsed.clientUuid || "")) return null;
    return {
      form: normalizedForm(parsed.form),
      photo: normalizedPhoto(parsed.photo),
      clientUuid: parsed.clientUuid,
    };
  } catch {
    // Private browsing, storage disabled, or malformed old draft.
    return null;
  }
}

export function saveSalesmanLeadDraft(employeeId, draft, storage) {
  if (!employeeId) return false;
  try {
    const target = storageOrDefault(storage);
    if (!target) return false;
    const form = normalizedForm(draft?.form);
    const photo = normalizedPhoto(draft?.photo);
    const key = salesmanLeadDraftKey(employeeId);
    const filled = FIELDS.some(field =>
      field !== "status" && String(form[field] || "").trim() !== ""
    ) || !!photo || form.status !== "cold";
    if (!filled) {
      target.removeItem(key);
      return true;
    }
    if (!UUID.test(draft?.clientUuid || "")) return false;
    target.setItem(key, JSON.stringify({version:VERSION, clientUuid:draft.clientUuid, form, photo}));
    return true;
  } catch {
    // If storage is unavailable or full, lead creation itself remains untouched.
    return false;
  }
}

export function clearSalesmanLeadDraft(employeeId, storage) {
  if (!employeeId) return false;
  try {
    storageOrDefault(storage)?.removeItem(salesmanLeadDraftKey(employeeId));
    return true;
  } catch {
    return false;
  }
}
