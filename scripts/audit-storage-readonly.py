"""Read all buckets/objects on Cloud and Dell and hash bytes; never upload or modify."""
import pathlib, json, hashlib, collections, datetime, tarfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import quote
import requests

config = {}
for line in pathlib.Path('/srv/garblac/scripts/storage.env').read_text().splitlines():
    if '=' in line and not line.lstrip().startswith('#'):
        k,v=line.split('=',1); config[k.strip()]=v.strip().strip('"').strip("'")
sources={'cloud':(config['CLOUD_URL'],config['CLOUD_SERVICE_KEY']), 'dell':(config['LOCAL_URL'],config['LOCAL_SERVICE_KEY'])}

def call(source, method, path, body=None, stream=False):
    base,key=sources[source]
    r=requests.request(method,base.rstrip('/')+path, headers={'apikey':key,'Authorization':'Bearer '+key},json=body,timeout=(15,120),stream=stream)
    if not r.ok: raise RuntimeError('HTTP '+str(r.status_code))
    return r

def list_objects(source,bucket):
    stack=['']; seen=set(); objects={}
    while stack:
        prefix=stack.pop()
        if prefix in seen: continue
        seen.add(prefix); offset=0
        while True:
            page=call(source,'POST','/storage/v1/object/list/'+quote(bucket,safe=''),{'prefix':prefix,'limit':100,'offset':offset,'sortBy':{'column':'name','order':'asc'}}).json()
            if not page: break
            for row in page:
                path=prefix+row['name']
                if row.get('id') is None: stack.append(path+'/')
                else: objects[path]=row
            offset+=len(page)
    return objects

def sha_stream(stream):
    h=hashlib.sha256(); count=0
    for chunk in stream:
        h.update(chunk); count+=len(chunk)
    return h.hexdigest(), count

report={'started_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'buckets':{},'objects':[],'errors':[]}
buckets={s:{b['id']:b for b in call(s,'GET','/storage/v1/bucket').json()} for s in sources}
report['only_cloud_buckets']=sorted(buckets['cloud'].keys()-buckets['dell'].keys())
report['only_dell_buckets']=sorted(buckets['dell'].keys()-buckets['cloud'].keys())
work=[]
for bucket in sorted(buckets['cloud'].keys() | buckets['dell'].keys()):
    inventory={s:list_objects(s,bucket) if bucket in buckets[s] else {} for s in sources}
    fields=['public','file_size_limit','allowed_mime_types']
    entry={s:{f:buckets[s].get(bucket,{}).get(f) for f in fields} for s in sources}
    entry.update(cloud_count=len(inventory['cloud']),dell_count=len(inventory['dell']),only_cloud=len(inventory['cloud'].keys()-inventory['dell'].keys()),only_dell=len(inventory['dell'].keys()-inventory['cloud'].keys()))
    report['buckets'][bucket]=entry
    print('BUCKET '+bucket+' '+json.dumps(entry),flush=True)
    for path in sorted(inventory['cloud'].keys() | inventory['dell'].keys()): work.append((bucket,path,inventory))

def verify(item):
    bucket,path,inventory=item
    row={'bucket':bucket,'path_sha256':hashlib.sha256(path.encode()).hexdigest()}
    for s in sources:
        if path not in inventory[s]: continue
        try:
            with call(s,'GET','/storage/v1/object/authenticated/'+quote(bucket,safe='')+'/'+quote(path,safe='/'),stream=True) as r:
                sha,size=sha_stream(r.iter_content(1024*1024))
                row[s]={'sha256':sha,'bytes':size,'http_mime':r.headers.get('Content-Type'),'metadata_mime':inventory[s][path].get('metadata',{}).get('mimetype')}
        except Exception as exc: row[s+'_error']=str(exc)
    row['content_equal']=all(s in row for s in sources) and row['cloud']['sha256']==row['dell']['sha256']
    row['mime_equal']=all(s in row for s in sources) and row['cloud']['http_mime']==row['dell']['http_mime']
    return row

with ThreadPoolExecutor(max_workers=4) as pool:
    for future in as_completed([pool.submit(verify,item) for item in work]):
        report['objects'].append(future.result())
        if len(report['objects'])%50==0: print('HASHED '+str(len(report['objects']))+'/'+str(len(work)),flush=True)

# Preserve the complete object evidence before touching a potentially unreadable archive.
report['summary']={'objects':len(report['objects']),'equal_content':sum(r['content_equal'] for r in report['objects']),'equal_mime':sum(r['mime_equal'] for r in report['objects'])}
print('OBJECT_REPORT_JSON '+json.dumps(report,sort_keys=True),flush=True)

backup=pathlib.Path('/srv/garblac/backups/automaticos/garblac-imagenes-20261029_060001.tar.gz')
try:
    hashes=collections.Counter(); total=0; regular=0
    with tarfile.open(backup,'r|gz') as archive:
        for member in archive:
            if member.isfile():
                f=archive.extractfile(member)
                sha,size=sha_stream(iter(lambda:f.read(1024*1024),b''))
                hashes[sha]+=1; total+=size; regular+=1
    report['backup']={'path':str(backup),'regular_files_read':regular,'uncompressed_bytes':total,'archive_fully_read':True,'cloud_objects_with_matching_content':sum(1 for r in report['objects'] if r.get('cloud',{}).get('sha256') in hashes),'dell_objects_with_matching_content':sum(1 for r in report['objects'] if r.get('dell',{}).get('sha256') in hashes),'limitation':'Content presence only; no path/metadata restore proven'}
except Exception as exc: report['errors'].append({'backup_error':str(exc)})
report['summary']={'objects':len(report['objects']),'equal_content':sum(r['content_equal'] for r in report['objects']),'equal_mime':sum(r['mime_equal'] for r in report['objects'])}
report['finished_utc']=datetime.datetime.now(datetime.timezone.utc).isoformat()
report['objects'].sort(key=lambda r:(r['bucket'],r['path_sha256']))
print('REPORT_JSON '+json.dumps(report,sort_keys=True),flush=True)
