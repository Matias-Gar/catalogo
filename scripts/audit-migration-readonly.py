"""Run on Dell via stdin. Read only; credentials stay on Dell; outputs no secrets/PII."""
import json, pathlib, hashlib, datetime, collections, requests
from urllib.parse import urlparse

def env(path):
    result = {}
    for line in pathlib.Path(path).read_text().splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            k, v = line.split('=', 1)
            result[k.strip()] = v.strip().strip('"').strip("'")
    return result

config = env('/srv/garblac/scripts/storage.env')
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
sources = {'cloud': (config['CLOUD_URL'], config['CLOUD_SERVICE_KEY']),
           'dell': (config['LOCAL_URL'], config['LOCAL_SERVICE_KEY'])}

def request(source, path, params=None):
    base, key = sources[source]
    r = requests.get(base.rstrip('/') + path, headers={'apikey': key, 'Authorization': 'Bearer ' + key}, params=params, timeout=90)
    if not r.ok:
        raise RuntimeError('HTTP ' + str(r.status_code))
    return r.json()

def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False)

def digest(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()

report = {'started_utc': started, 'scope': 'REST tables and Auth; not a transactional snapshot', 'tables': {}, 'errors': []}
specs = {s: request(s, '/rest/v1/') for s in sources}
definitions = {s: specs[s].get('definitions', {}) for s in sources}
table_sets = {s: {p.strip('/') for p in specs[s].get('paths', {}) if p != '/' and not p.startswith('/rpc/')} for s in sources}
report['only_cloud_tables'] = sorted(table_sets['cloud'] - table_sets['dell'])
report['only_dell_tables'] = sorted(table_sets['dell'] - table_sets['cloud'])
cache = {s: {} for s in sources}

def rows(source, table, keys):
    result = []
    offset = 0
    while True:
        page = request(source, '/rest/v1/' + table, {'select': '*', 'order': ','.join(k + '.asc' for k in keys), 'offset': offset, 'limit': 500})
        if not isinstance(page, list): raise RuntimeError('Unexpected response')
        result.extend(page)
        if not page: break
        offset += len(page)
        # Continue until an empty page, even if the server caps pages below 500.
    return result

for table in sorted(table_sets['cloud'] | table_sets['dell']):
    props = {s: definitions[s].get(table, {}).get('properties', {}) for s in sources}
    keys = [k for k,v in props['cloud'].items() if 'Primary Key' in v.get('description', '')]
    if not keys: keys = ['id'] if 'id' in props['cloud'] else (['user_id'] if 'user_id' in props['cloud'] else sorted(props['cloud']))
    schema_diff = {}
    for column in props['cloud'].keys() | props['dell'].keys():
        differences = {field:{s:props[s].get(column,{}).get(field) for s in sources} for field in ['type','format','default','enum','maxLength'] if props['cloud'].get(column,{}).get(field) != props['dell'].get(column,{}).get(field)}
        if column not in props['cloud'] or column not in props['dell']: differences['present']={s:column in props[s] for s in sources}
        if differences: schema_diff[column]=differences
    entry = {'order': keys, 'primary_key_from_openapi': any('Primary Key' in v.get('description', '') for v in props['cloud'].values()), 'schema_equal_openapi': props['cloud'] == props['dell'], 'schema_column_differences':schema_diff, 'required_columns':{s:definitions[s].get(table,{}).get('required',[]) for s in sources}}
    for s in sources:
        if table not in table_sets[s]: continue
        try:
            cache[s][table] = rows(s, table, keys)
            entry[s + '_count'] = len(cache[s][table])
            entry[s + '_sha256'] = digest(cache[s][table])
        except Exception as exc:
            entry[s + '_error'] = str(exc)
    if table in cache['cloud'] and table in cache['dell']:
        def index(data): return {canonical([r.get(k) for k in keys]):r for r in data}
        a, b = index(cache['cloud'][table]), index(cache['dell'][table])
        entry['duplicate_keys'] = {'cloud': len(cache['cloud'][table])-len(a), 'dell':len(cache['dell'][table])-len(b)}
        entry['only_cloud_rows'] = len(a.keys()-b.keys())
        entry['only_dell_rows'] = len(b.keys()-a.keys())
        cols = collections.Counter()
        samples = []
        changed = 0
        for k in a.keys() & b.keys():
            diff = sorted(c for c in a[k].keys() | b[k].keys() if a[k].get(c) != b[k].get(c) or (c in a[k]) != (c in b[k]))
            if diff:
                changed += 1
                cols.update(diff)
                if len(samples)<20: samples.append({'key_sha256': digest(k), 'columns': diff})
        entry.update(changed_rows=changed, differing_columns=dict(cols), samples=samples)
    report['tables'][table] = entry
    print('TABLE ' + table + ' ' + canonical(entry), flush=True)

for source in sources:
    try:
        users = []
        page = 1
        while True:
            batch = request(source, '/auth/v1/admin/users', {'page': page, 'per_page': 100}).get('users', [])
            if not batch: break
            users.extend(batch)
            page += 1
        cache[source]['auth_users'] = users
        report[source + '_auth_count'] = len(users)
        report[source + '_auth_settings'] = request(source, '/auth/v1/settings')
    except Exception as exc: report['errors'].append({'source':source, 'auth':str(exc)})
if all('auth_users' in cache[s] for s in sources):
    a = {u['id']:u for u in cache['cloud']['auth_users']}
    b = {u['id']:u for u in cache['dell']['auth_users']}
    cols = collections.Counter()
    for k in a.keys() & b.keys():
        cols.update(c for c in a[k].keys() | b[k].keys() if a[k].get(c) != b[k].get(c))
    report['auth_comparison'] = {'only_cloud':len(a.keys()-b.keys()), 'only_dell':len(b.keys()-a.keys()), 'differing_columns':dict(cols), 'passwords_compared':False}

report['coffeemakers'] = {}
for s in sources:
    report['coffeemakers'][s] = {}
    for table, fields, match in [
        ('productos',['user_id','nombre','stock','stock_inicial','sucursal_id','pais_id','archivado'], lambda r:r.get('user_id') in [306,308]),
        ('producto_variantes',['id','producto_id','color','stock','stock_decimal','stock_inicial','activo','sku'],lambda r:r.get('producto_id') in [306,308]),
        ('ventas_detalle',['id','venta_id','producto_id','variante_id','cantidad','cantidad_base','precio_unitario','descripcion','created_at'],lambda r:r.get('producto_id') in [306,308]),
        ('stock_movimientos',['id','producto_id','variante_id','tipo','cantidad_base','stock_antes','stock_despues','venta_id','detalle_id','created_at'],lambda r:r.get('producto_id') in [306,308]),
        ('ventas',['id','estado','fecha','total','modo_pago','pago'],lambda r:r.get('id') in [40,50])]:
        report['coffeemakers'][s][table] = [{k:r.get(k) for k in fields} for r in cache[s].get(table,[]) if match(r)]
report['new_dell_operations']={}
for table, fields in {
    'ventas':['id','fecha','estado','total','modo_pago'],
    'ventas_detalle':['id','venta_id','producto_id','variante_id','cantidad_base','precio_unitario','created_at'],
    'ventas_pagos':['id','venta_id','monto','metodo','created_at'],
    'productos':['user_id','nombre','stock','created_at'],
    'producto_variantes':['id','producto_id','color','stock_decimal','created_at'],
    'stock_movimientos':['id','producto_id','variante_id','tipo','cantidad_base','stock_antes','stock_despues','venta_id','created_at'],
    'carritos_pendientes':['id','created_at','estado','venta_id','descartado_at'],
    'business_audit_events':['id','created_at','action','entity_type','entity_id'],
}.items():
    key='user_id' if table=='productos' else 'id'
    old={r.get(key) for r in cache['cloud'].get(table,[])}
    report['new_dell_operations'][table]=[{k:r.get(k) for k in fields} for r in cache['dell'].get(table,[]) if r.get(key) not in old]

report['image_url_changes']={}
for table,key,column in [('productos','user_id','imagen_url'),('producto_imagenes','id','imagen_url'),('perfiles','id','foto_perfil')]:
    a={r[key]:r for r in cache['cloud'].get(table,[])}
    changed=[]
    for r in cache['dell'].get(table,[]):
        if r[key] in a and a[r[key]].get(column)!=r.get(column):
            x,y=urlparse(a[r[key]].get(column) or ''),urlparse(r.get(column) or '')
            changed.append({'path_equal':x.path==y.path,'cloud_host':x.netloc,'dell_host':y.netloc,'query_equal':x.query==y.query})
    report['image_url_changes'][table]={'changed':len(changed),'same_path':sum(r['path_equal'] for r in changed),'host_pairs':dict(collections.Counter(r['cloud_host']+' -> '+r['dell_host'] for r in changed))}

report['integrity']={}
for s in sources:
    c=cache[s]; problems=[]
    products={r['user_id']:r for r in c.get('productos',[])}
    variants={r['id']:r for r in c.get('producto_variantes',[])}
    sales={r['id']:r for r in c.get('ventas',[])}
    sums=collections.defaultdict(float)
    for r in variants.values():
        qty=float(r.get('stock_decimal') if r.get('stock_decimal') is not None else r.get('stock') or 0)
        if qty<0: problems.append({'type':'negative_variant','id':r['id']})
        if r.get('activo') is not False: sums[r['producto_id']]+=qty
        if r['producto_id'] not in products: problems.append({'type':'orphan_variant','id':r['id']})
    for r in products.values():
        stock=float(r.get('stock') or 0)
        if stock<0: problems.append({'type':'negative_product','id':r['user_id']})
        if r['user_id'] in sums and abs(stock-sums[r['user_id']])>0.0001: problems.append({'type':'variant_sum_mismatch','id':r['user_id'],'stock':stock,'variant_sum':sums[r['user_id']]})
    for r in c.get('ventas_detalle',[]):
        if r.get('venta_id') not in sales: problems.append({'type':'orphan_sale_detail','id':r['id']})
        if r.get('producto_id') is not None and r['producto_id'] not in products: problems.append({'type':'orphan_detail_product','id':r['id']})
        if r.get('variante_id') is not None:
            v=variants.get(r['variante_id'])
            if not v or v.get('producto_id')!=r.get('producto_id'): problems.append({'type':'detail_variant_product_mismatch','id':r['id']})
    for r in c.get('ventas_pagos',[]):
        if r.get('venta_id') not in sales: problems.append({'type':'orphan_payment','id':r['id']})
    report['integrity'][s]={'problems':problems,'counts':dict(collections.Counter(p['type'] for p in problems)),'ledger_statuses':dict(collections.Counter(r.get('estado') for r in c.get('inventory_reconciliation',[]))),'payment_columns':sorted(c.get('ventas_pagos',[{}])[0]) if c.get('ventas_pagos') else []}
report['integrity']['only_new_dell_problems']=[r for r in report['integrity']['dell']['problems'] if r not in report['integrity']['cloud']['problems']]
report['finished_utc'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
print('REPORT_JSON ' + canonical(report), flush=True)
