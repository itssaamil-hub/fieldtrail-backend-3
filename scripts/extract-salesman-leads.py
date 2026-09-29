from pathlib import Path

path = Path("src/App.jsx")
text = path.read_text()

def replace_once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    text = text.replace(old, new, 1)

replace_once(
    'import useSalesmanMessages from "./useSalesmanMessages.js";\n',
    'import useSalesmanMessages from "./useSalesmanMessages.js";\nimport useSalesmanLeads from "./useSalesmanLeads.js";\n',
    "salesman leads import",
)

replace_once(
    '  const [leads, setLeads] = useState([]);\n  const [loading, setLoading] = useState(true);\n  const [loadError, setLoadError] = useState("");\n',
    '  const [loadError, setLoadError] = useState("");\n',
    "lead state",
)

replace_once(
    '  const [queuedCount, setQueuedCount] = useState(getQueuedLeads().length);\n',
    "",
    "queued count state",
)

start = text.index("  const loadLeads = useCallback(async () => {")
end_marker = "  useEffect(() => { loadLeads(); }, [loadLeads]);\n"
end = text.index(end_marker, start) + len(end_marker)
text = text[:start] + text[end:]

flush_start = text.index("  // Flush the offline lead queue whenever we're online.")
show_closing = text.index("  const [showClosing,setShowClosing]=useState(false);", flush_start)
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
text = text[:flush_start] + hook + text[show_closing:]

handlers_start = text.index("  const handleAddLead = async (payload) => {")
handlers_end = text.index("  if (loading) {", handlers_start)
text = text[:handlers_start] + text[handlers_end:]

path.write_text(text)
print("salesman leads extracted")
