from pathlib import Path

script = Path('tools/remove_offline_deal_queue_once.py')
text = script.read_text()

old_submit = '''s = replace_once(
    s,
    "  const handleSubmit = async () => {\\n    if (!canSubmit) return;\\n",
    "  const handleSubmit = async () => {\\n    if (!canSubmit) return;\\n    if (!online) {\\n      setError(\\"No connection — this deal has not been saved. Reconnect and try again.\\");\\n      return;\\n    }\\n",
    "online-only submit guard",
)
'''
new_submit = '''marker = "function AddLeadModal({ session, online, onClose, onSubmit, onSaved }) {"
assert s.count(marker) == 1, "salesman AddLeadModal marker must be unique"
head, tail = s.split(marker, 1)
tail = replace_once(
    tail,
    "  const handleSubmit = async () => {\\n    if (!canSubmit) return;\\n",
    "  const handleSubmit = async () => {\\n    if (!canSubmit) return;\\n    if (!online) {\\n      setError(\\"No connection — this deal has not been saved. Reconnect and try again.\\");\\n      return;\\n    }\\n",
    "salesman online-only submit guard",
)
s = head + marker + tail
'''
assert text.count(old_submit) == 1, f'expected one submit-guard source block, found {text.count(old_submit)}'
text = text.replace(old_submit, new_submit, 1)

old_app = '''s = replace_once(s, "VerificationStamp, SyncBadge, NoLocationBadge", "VerificationStamp, NoLocationBadge", "App SyncBadge dependency")
'''
new_app = '''s = replace_once(s, "VerificationStamp, SyncBadge, NoLocationBadge, Overlay", "VerificationStamp, NoLocationBadge, Overlay", "App createLeadFeatures SyncBadge dependency")
'''
assert text.count(old_app) == 1, f'expected one App SyncBadge source block, found {text.count(old_app)}'
text = text.replace(old_app, new_app, 1)

script.write_text(text)
exec(compile(script.read_text(), str(script), 'exec'))
