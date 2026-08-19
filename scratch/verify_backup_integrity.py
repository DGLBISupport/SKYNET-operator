import os
import re

with open('backup.md', 'r', encoding='utf-8') as f:
    backup_code = f.read()

# Collect all files in src
src_files = {}
all_src_code = ''
for root, dirs, files in os.walk('src'):
    for file in files:
        if file.endswith(('.ts', '.tsx', '.js', '.jsx')):
            p = os.path.join(root, file)
            with open(p, 'r', encoding='utf-8', errors='ignore') as f:
                c = f.read()
                src_files[p] = c
                all_src_code += '\n' + c

# 1. Compare functions between lines 1..3692 in backup vs page.tsx
return_idx = backup_code.find('return (')
backup_header_code = backup_code[:return_idx]

backup_functions = re.findall(r'(?:const|function|async function)\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|(?:function|async function)\s+([a-zA-Z0-9_]+)\s*\(', backup_header_code)
backup_func_names = set([f[0] or f[1] for f in backup_functions if f[0] or f[1]])

# Filter out React hooks and component name
backup_func_names = {f for f in backup_func_names if f not in ['useState', 'useRef', 'useEffect', 'useCallback', 'WorkstationDashboard']}

print(f'Total internal functions in backup.md: {len(backup_func_names)}')
missing_funcs = [f for f in backup_func_names if f not in all_src_code]
print('Missing functions:', missing_funcs)

# 2. Check all JSX text / headings / modal titles
headings = re.findall(r'>([^<>{}\n\r]{4,})<', backup_code)
headings = set([h.strip() for h in headings if len(h.strip()) >= 5 and not h.strip().startswith('//')])
print(f'Found {len(headings)} distinctive JSX text nodes in backup.md')

missing_headings = []
for h in headings:
    if h not in all_src_code:
        missing_headings.append(h)

print(f'Missing JSX text nodes in current src: {len(missing_headings)}')
for h in missing_headings:
    print('  - ', repr(h))
