import os
import re

with open('backup.md', 'r', encoding='utf-8') as f:
    backup_code = f.read()

# Check all API endpoints called in backup.md
api_calls = re.findall(r'fetch\([\'\"](/api/[^\'\"]+)[\'\"]', backup_code)
api_calls = set([a.split('?')[0] for a in api_calls])
print(f'API endpoints called in backup.md: {len(api_calls)}')
for api in sorted(api_calls):
    # Check if route.ts exists
    route_path = 'src/app' + api + '/route.ts'
    exists = os.path.exists(route_path)
    print(f'  {api} -> {route_path} (exists: {exists})')

# Check all useEffect hooks in backup.md
effects_backup = re.findall(r'useEffect\(\(\)\s*=>\s*\{([\s\S]*?)\},\s*\[(.*?)\]\);', backup_code)
print(f'\nTotal useEffect in backup.md: {len(effects_backup)}')

with open('src/app/page.tsx', 'r', encoding='utf-8') as f:
    page_code = f.read()

effects_page = re.findall(r'useEffect\(\(\)\s*=>\s*\{([\s\S]*?)\},\s*\[(.*?)\]\);', page_code)
print(f'Total useEffect in src/app/page.tsx: {len(effects_page)}')

# Check every modal in backup.md
print('\nVerifying Modals:')
modal_matches = re.findall(r'\{([a-zA-Z0-9_]+Modal|[a-zA-Z0-9_]+Open)\s*&&', backup_code)
for m in set(modal_matches):
    in_modals_file = m in open('src/components/modals/AllModals.tsx', 'r', encoding='utf-8').read()
    in_page_file = m in page_code
    in_comp_files = any(m in open(os.path.join('src/components', sub, f), 'r', encoding='utf-8').read() 
                        for sub in os.listdir('src/components') if os.path.isdir(os.path.join('src/components', sub))
                        for f in os.listdir(os.path.join('src/components', sub)) if f.endswith('.tsx'))
    print(f'  {m} -> in AllModals: {in_modals_file}, in page.tsx: {in_page_file}, in components: {in_comp_files}')
