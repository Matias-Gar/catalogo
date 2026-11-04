"""Start only the exact preserved original Auth container. No recreation/deletion."""
import datetime
import hashlib
import http.client
import json
import os
import pathlib
import pwd
import socket
import time
import urllib.request

ORIGINAL='63d7981cd9047ab677536109dc397e726369a96159b45ba9a20b66f44530cff3'
BASE=pathlib.Path('/srv/garblac/backend')
BACKUP=pathlib.Path('/dev/shm/catalogo-env-before-gmail-20261030-132647-4063960')
class Docker(http.client.HTTPConnection):
    def connect(self):
        self.sock=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM)
        self.sock.settimeout(12);self.sock.connect('/var/run/docker.sock')

def request(method,route):
    connection=Docker('localhost',timeout=12)
    try:
        connection.request(method,route)
        response=connection.getresponse();data=response.read()
        if response.status not in [200,204,304]:raise RuntimeError('Docker HTTP '+str(response.status))
        return json.loads(data) if data else None
    finally:connection.close()

report={'checked_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'production_changed':False,'containers_deleted':0,'containers_recreated':0,
        'original_auth_started':False,'auth_health_ok':False}
try:
    if os.geteuid()!=0:raise RuntimeError('Run with sudo')
    current=(BASE/'.env').read_bytes()
    if hashlib.sha256(current).digest()!=hashlib.sha256(BACKUP.read_bytes()).digest():
        raise RuntimeError('Backend environment differs from the restored backup')
    item=request('GET','/containers/'+ORIGINAL+'/json')
    labels=item['Config'].get('Labels',{})
    if (item['Name']!='/supabase-auth' or labels.get('com.docker.compose.service')!='auth'
        or labels.get('com.docker.compose.project')!='supabase'
        or labels.get('com.docker.compose.project.working_dir')!=str(BASE)):
        raise RuntimeError('Original Auth identity changed')
    environment=dict(value.split('=',1) for value in item['Config'].get('Env',[]) if '=' in value)
    if environment.get('GOTRUE_SMTP_HOST')!='supabase-mail':raise RuntimeError('Original SMTP configuration changed')
    if item['State']['Status'] not in ['exited','running']:raise RuntimeError('Unexpected original Auth state')
    if not item['State']['Running']:
        report['production_changed']=True
        report['last_step']='start_preserved_original_auth'
        request('POST','/containers/'+ORIGINAL+'/start')
    state=request('GET','/containers/'+ORIGINAL+'/json')['State']
    report['original_auth_started']=bool(state['Running'])
    report['container_state']=state['Status']
    values={k.strip():v.strip().strip(chr(34)).strip(chr(39)) for line in current.decode().splitlines()
            if '=' in line and not line.lstrip().startswith('#') for k,v in [line.split('=',1)]}
    report['last_step']='check_auth_health'
    for _ in range(10):
        try:
            req=urllib.request.Request('http://127.0.0.1:8000/auth/v1/health',headers={'apikey':values['ANON_KEY']})
            with urllib.request.urlopen(req,timeout=3) as response:
                report['auth_health_ok']=response.status==200
            if report['auth_health_ok']:break
        except Exception:pass
        time.sleep(2)
    report['status']='original_auth_recovered' if report['auth_health_ok'] else 'inspect_auth_health'
except Exception as error:
    report['status']='needs_inspection'
    report['error']=str(error) if isinstance(error,RuntimeError) else type(error).__name__
report['finished_utc']=datetime.datetime.now(datetime.timezone.utc).isoformat()
target=pathlib.Path('/dev/shm/catalogo-auth-recovery-result-20261030.json')
if os.geteuid()==0:
    target.write_text(json.dumps(report,indent=2));os.chmod(target,0o600)
    owner=pwd.getpwnam('matias');os.chown(target,owner.pw_uid,owner.pw_gid)
print(json.dumps(report,indent=2),flush=True)
