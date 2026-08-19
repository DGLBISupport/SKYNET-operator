import re

with open('backup.md', 'r', encoding='utf-8') as f:
    backup_code = f.read()

with open('src/app/page.tsx', 'r', encoding='utf-8') as f:
    page_code = f.read()

backup_handles = re.findall(r'const\s+(handle\w+)\s*=', backup_code)
page_handles = re.findall(r'const\s+(handle\w+)\s*=', page_code)

print('Handles in backup.md:', len(backup_handles), sorted(set(backup_handles)))
print('Handles in page.tsx:', len(page_handles), sorted(set(page_handles)))

missing = set(backup_handles) - set(page_handles)
print('Missing in page.tsx:', missing)
