"""Static inventory only. Reading a file is not a functional certification."""
import pathlib, json, hashlib, re

root = pathlib.Path(__file__).resolve().parent.parent
result = []
for folder in ['app', 'components', 'hooks', 'lib', 'services', 'types', 'scripts', 'tests', 'supabase']:
    for path in sorted((root / folder).rglob('*')):
        if not path.is_file() or path.suffix not in ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.sql', '.py']:
            continue
        content = path.read_text(encoding='utf-8-sig')
        row = {'file': path.relative_to(root).as_posix(), 'lines': len(content.splitlines()),
               'sha256': hashlib.sha256(content.encode()).hexdigest(), 'inspection': 'static inventory and pattern scan',
               'tables': sorted(set(re.findall(r'\.from\([\'\"]([^\'\"]+)', content))),
               'rpc': sorted(set(re.findall(r'\.rpc\([\'\"]([^\'\"]+)', content)))}
        if path.name in ['route.js', 'route.ts']:
            row.update(methods=re.findall(r'export async function (\w+)', content),
                       access_guard=bool(re.search('requireAdmin|requireAuth|getUserIdFromRequest|x-hub-signature', content)))
        result.append(row)
out = root / 'docs/audit-2026-11-04/source-inventory.json'
out.write_text(json.dumps(result, indent=2), encoding='utf-8')
print(json.dumps({'files': len(result), 'lines': sum(x['lines'] for x in result), 'routes': sum('methods' in x for x in result)}))
