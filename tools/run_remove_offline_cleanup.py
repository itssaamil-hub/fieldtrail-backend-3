from pathlib import Path

script = Path('tools/remove_offline_deal_queue_once.py')
text = script.read_text()
old = '''s = replace_once(
    s,
    "  const handleSubmit = async () => {\\n    if (!canSubmit) return;\\n",
    "  const handleSubmit = async () => {\\n    if (!canSubmit) return;\\n    if (!online) {\\n      setError(\\"No connection — this deal has not been saved. Reconnect and try again.\\");\\n      return;\\n    }\\n",
    "online-only submit guard",
)
'''
new = '''marker = "function AddLeadModal({ session, online, onClose, onSubmit, onSaved }) {"
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
assert text.count(old) == 1, f'expected one submit-guard source block, found {text.count(old)}'
script.write_text(text.replace(old, new, 1))
exec(compile(script.read_text(), str(script), 'exec'))
