from pathlib import Path

path = Path("src/App.jsx")
text = path.read_text()

import_old = 'import useSalesmanMessages from "./useSalesmanMessages.js";\n'
import_new = import_old + 'import useSalesmanLeads from "./useSalesmanLeads.js";\n'
if text.count(import_old) != 1:
    raise SystemExit(f"salesman leads import: expected 1 match, found {text.count(import_old)}")
text = text.replace(import_old, import_new, 1)

app_start = text.index("function SalesmanApp({ session, online, page, notificationLead }) {")
app_end = text.index("\nfunction adHocLeadFromPayload", app_start)
segment = text[app_start:app_end]

def replace_segment(old, new, label):
    global segment
    count = segment.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match in SalesmanApp, found {count}")
    segment = segment.replace(old, new, 1)

replace_segment(
    '  const [leads, setLeads] = useState([]);\n  const [loading, setLoading] = useState(true);\n  const [loadError, setLoadError] = useState("");\n',
    '  const [loadError, setLoadError] = useState("");\n',
    "lead state",
)
replace_segment(
    '  const [queuedCount, setQueuedCount] = useState(getQueuedLeads().length);\n',
    "",
    "queued count state",
)

load_start = segment.index("  const loadLeads = useCallback(async () => {")
load_end_marker = "  useEffect(() => { loadLeads(); }, [loadLeads]);\n"
load_end = segment.index(load_end_marker, load_start) + len(load_end_marker)
segment = segment[:load_start] + segment[load_end:]

flush_start = segment.index("  // Flush the offline lead queue whenever we're online.")
show_closing = segment.index("  const [showClosing,setShowClosing]=useState(false);", flush_start)
hook = '''  const {
    leads,
    loading,
    queuedCount,
    handleAddLead,
    handleUpdateLeadStatus,
    handleUpdateLeadDetails,
  } = useSalesmanLeads({
    online,
    session,
    setLoadError,
    makeQueuedLead: (payload) => adHocLeadFromPayload(payload, session),
  });

'''
segment = segment[:flush_start] + hook + segment[show_closing:]

handlers_start = segment.index("  const handleAddLead = async (payload) => {")
handlers_end = segment.index("  if (loading) {", handlers_start)
segment = segment[:handlers_start] + segment[handlers_end:]

text = text[:app_start] + segment + text[app_end:]
path.write_text(text)
print("salesman leads extracted")
