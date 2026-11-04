"""GET-only smoke checks and anonymous access checks; never creates carts/users."""
import pathlib,json,requests,datetime
from urllib.parse import quote
env={}
for line in pathlib.Path('/srv/garblac/scripts/storage.env').read_text().splitlines():
    if '=' in line and not line.lstrip().startswith('#'):
        k,v=line.split('=',1);env[k.strip()]=v.strip().strip('"').strip("'")
app={}
for line in pathlib.Path('/srv/garblac/app/.env.local').read_text().splitlines():
    if '=' in line and not line.lstrip().startswith('#'):
        k,v=line.split('=',1);app[k.strip()]=v.strip().strip('"').strip("'")
out={'started_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pages':[],'anonymous_reads':{}}
for origin in ['https://garblac.duckdns.org','https://catalogo-sigma-one.vercel.app']:
    for path in ['/','/productos','/login','/reset-password']:
        try:
            r=requests.get(origin+path,timeout=35)
            out['pages'].append({'url':origin+path,'status':r.status_code,'final_url':r.url,'server':r.headers.get('server'),'vercel':bool(r.headers.get('x-vercel-id')),'contains_cloud_host':'gzvtuenpwndodnetnmzi.supabase.co' in r.text,'contains_private_api':'192.168.0.17:8000' in r.text})
        except requests.RequestException as e: out['pages'].append({'url':origin+path,'error':type(e).__name__})
base=env['LOCAL_URL'].rstrip('/');key=app['NEXT_PUBLIC_SUPABASE_ANON_KEY']
out['configured_app_api']=app['NEXT_PUBLIC_SUPABASE_URL']
for table in ['password_resets','perfiles','ventas','ventas_detalle','ventas_pagos','stock_movimientos','carritos_pendientes']:
    # Counts only, no personal row values or reset codes leave the server.
    try:
        r=requests.get(base+'/rest/v1/'+table,params={'select':'*','limit':0},headers={'apikey':key,'Authorization':'Bearer '+key,'Prefer':'count=exact'},timeout=30)
        out['anonymous_reads'][table]={'status':r.status_code,'content_range':r.headers.get('Content-Range')}
    except requests.RequestException as e: out['anonymous_reads'][table]={'error':type(e).__name__}
headers={'apikey':env['LOCAL_SERVICE_KEY'],'Authorization':'Bearer '+env['LOCAL_SERVICE_KEY']}
r=requests.post(env['LOCAL_URL'].rstrip('/')+'/storage/v1/object/list/imagenes',json={'prefix':'','limit':100,'offset':0,'sortBy':{'column':'name','order':'asc'}},headers=headers,timeout=30)
sample=next((x['name'] for x in r.json() if x.get('id') is not None),None)
if sample:
    url='https://garblac.duckdns.org/storage/v1/object/public/imagenes/'+quote(sample,safe='/')
    out['image_checks']=[]
    for target in [url,'https://catalogo-sigma-one.vercel.app/_next/image?url='+quote(url,safe='')+'&w=640&q=75']:
        try:
            r=requests.get(target,timeout=45)
            out['image_checks'].append({'optimizer':'/_next/image?' in target,'status':r.status_code,'mime':r.headers.get('Content-Type'),'bytes':len(r.content)})
        except requests.RequestException as e: out['image_checks'].append({'error':type(e).__name__})
print(json.dumps(out,sort_keys=True))
