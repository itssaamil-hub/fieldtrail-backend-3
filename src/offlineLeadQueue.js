const LEGACY_KEY = 'fieldtrail:queuedLeads';
const queueKey = userId => {
  if (!userId || typeof userId !== 'string') throw new Error('Sign in before saving an offline deal.');
  return `${LEGACY_KEY}:${userId}`;
};
function read(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  const entries = JSON.parse(raw);
  if (!Array.isArray(entries)) throw new Error('Offline deals could not be read. Stored data has been preserved.');
  return entries;
}
export function getQueuedLeads(userId) { try { return read(queueKey(userId)); } catch { return []; } }
export function queueReadError(userId) { try { read(queueKey(userId)); return ""; } catch { return "Offline deals could not be read. Stored data has been preserved."; } }
export function setQueuedLeads(list, userId) { const key = queueKey(userId); read(key); localStorage.setItem(key, JSON.stringify(list)); }
export function pushQueuedLead(payload, userId) {
  const list = getQueuedLeads(userId);
  if (!list.some(item => item.clientUuid === payload.clientUuid)) list.push(payload);
  setQueuedLeads(list, userId);
}
export function removeQueuedLead(clientUuid, userId) {
  setQueuedLeads(getQueuedLeads(userId).filter(item => item.clientUuid !== clientUuid), userId);
}
// Old shared entries have no reliable owner. Preserve them without submitting
// them as whichever employee happens to sign in after this update.
export function legacyQueueCount() { try { return read(LEGACY_KEY).length; } catch { return 1; } }
export async function flushOfflineLeads({userId,isCurrent,createLead,onSynced,onError}) {
  for (const payload of getQueuedLeads(userId)) {
    if (!isCurrent()) break;
    try {
      const result = await createLead(payload, userId);
      if (!result?.lead?.id || result.lead.salesman_id !== userId) throw new Error('The server did not confirm this deal for its owner.');
      removeQueuedLead(payload.clientUuid, userId);
      if (isCurrent()) onSynced(result, payload);
    } catch (err) {
      if (isCurrent()) onError(err);
      // Validation errors remain saved for correction; other queued deals can
      // still sync. Authentication, throttling and connectivity errors pause.
      if (![400,409,422].includes(err.status)) break;
    }
  }
}
