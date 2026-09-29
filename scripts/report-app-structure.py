from pathlib import Path
import re
p=Path('src/App.jsx')
s=p.read_text()
lines=s.splitlines()
# crude but useful top-level declaration report from column-zero declarations
pat=re.compile(r'^(function\s+([A-Za-z0-9_]+)|const\s+([A-Za-z0-9_]+)\s*=\s*(?:\(|async\s*\(|function|\([^)]*\)\s*=>|[A-Za-z0-9_]+\s*=>))')
for i,l in enumerate(lines,1):
    m=pat.match(l)
    if m:
        name=m.group(2) or m.group(3)
        print(f'{i:5d} {name}')
print('LINES',len(lines))
