from pathlib import Path

path = Path('src/admin/useAdminData.js')
text = path.read_text()

old = '  if (row.full_name != null || row.last_seen_at != null) return mapSalesmanRow(row);'
new = '  if (row.full_name != null) return mapSalesmanRow(row);'
if text.count(old) != 1:
    raise SystemExit(f'salesman mapper marker mismatch: {text.count(old)}')
text = text.replace(old, new, 1)

old = '  const loadAllInFlightRef = useRef(null);\n  const lastRefreshAtRef = useRef(0);'
new = '  const loadAllInFlightRef = useRef(null);\n  const summaryInFlightRef = useRef(null);\n  const lastRefreshAtRef = useRef(0);'
if text.count(old) != 1:
    raise SystemExit(f'ref marker mismatch: {text.count(old)}')
text = text.replace(old, new, 1)

old = '''  const refreshSummary = useCallback(async () => {
    try {
      const summary = await api.adminSummary();
      setConversationCount(summary?.conversationLeads ?? null);
    } catch {
      // A targeted summary refresh is best-effort; the safety refresh will reconcile it.
    }
  }, []);
'''
new = '''  const refreshSummary = useCallback(() => {
    if (summaryInFlightRef.current) return summaryInFlightRef.current;
    const request = api.adminSummary()
      .then((summary) => setConversationCount(summary?.conversationLeads ?? null))
      .catch(() => null);
    summaryInFlightRef.current = request.finally(() => {
      summaryInFlightRef.current = null;
    });
    return summaryInFlightRef.current;
  }, []);
'''
if text.count(old) != 1:
    raise SystemExit(f'summary block mismatch: {text.count(old)}')
text = text.replace(old, new, 1)

old = '''  const onDeleteLead = useCallback(async (id) => {
    let previous = null;
    setLeads((prev) => {
      previous = prev;
      return prev.filter((lead) => lead.id !== id);
    });
    try {
      await api.adminDeleteLead(id);
      refreshSummary();
    } catch (err) {
      if (previous) setLeads(previous);
      setLoadError(errorMessage(err, "Couldn't delete the lead."));
      loadAll();
    }
  }, [loadAll, refreshSummary]);
'''
new = '''  const onDeleteLead = useCallback(async (id) => {
    setLeads((prev) => prev.filter((lead) => lead.id !== id));
    try {
      await api.adminDeleteLead(id);
      refreshSummary();
    } catch (err) {
      setLoadError(errorMessage(err, "Couldn't delete the lead."));
      loadAll();
    }
  }, [loadAll, refreshSummary]);
'''
if text.count(old) != 1:
    raise SystemExit(f'delete lead block mismatch: {text.count(old)}')
text = text.replace(old, new, 1)

path.write_text(text)
print('Admin controller edge cases hardened')
