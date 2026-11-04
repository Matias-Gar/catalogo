"""Emergency same-version Auth in preserved container network; no Docker restart."""
import ctypes
import datetime
import hashlib
import http.client
import json
import os
import pathlib
import pwd
import socket
import shutil
import sys
import time
import urllib.parse
import urllib.request

ORIGINAL='63d7981cd9047ab677536109dc397e726369a96159b45ba9a20b66f44530cff3'
BINARY=pathlib.Path('/dev/shm/catalogo-auth-ram')
HASH='f2aa147268461f74784ddc8b2240aa446ee71ceb9633bac41c30e7b852a860aa'
PIDFILE=pathlib.Path('/dev/shm/catalogo-auth-ram.pid')
class Docker(http.client.HTTPConnection):
    def connect(self):
        self.sock=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM);self.sock.settimeout(8)
        self.sock.connect('/var/run/docker.sock')
def get(route):
    connection=Docker('localhost',timeout=8)
    try:
        connection.request('GET',route);response=connection.getresponse()
        if response.status!=200:raise RuntimeError('Docker HTTP '+str(response.status))
        return json.load(response)
    finally:connection.close()

report={'started_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'temporary_recovery':True,'docker_restarted':False,'containers_deleted':0,'auth_health_ok':False}
try:
    if os.geteuid()!=0:raise RuntimeError('Run with sudo')
    if '--only-if-unhealthy' in sys.argv:
        initial_values={k.strip():v.strip().strip(chr(34)).strip(chr(39)) for line in pathlib.Path('/srv/garblac/backend/.env').read_text().splitlines()
            if '=' in line and not line.lstrip().startswith('#') for k,v in [line.split('=',1)]}
        try:
            initial_request=urllib.request.Request('http://127.0.0.1:8000/auth/v1/health',headers={'apikey':initial_values['ANON_KEY']})
            with urllib.request.urlopen(initial_request,timeout=3) as response:healthy=response.status==200
        except Exception:healthy=False
        if healthy:
            print(json.dumps({'status':'already_healthy_no_changes','auth_health_ok':True}),flush=True)
            raise SystemExit(0)
    if not BINARY.exists():
        persisted=pathlib.Path('/srv/garblac/auth-continuity/auth-v2.197.0')
        if hashlib.sha256(persisted.read_bytes()).hexdigest()!=HASH:
            raise RuntimeError('Persisted recovery binary hash mismatch')
        temporary=BINARY.with_suffix('.preparing')
        shutil.copyfile(persisted,temporary);os.chmod(temporary,0o755)
        if hashlib.sha256(temporary.read_bytes()).hexdigest()!=HASH:
            raise RuntimeError('RAM recovery copy mismatch')
        os.replace(temporary,BINARY)
    if hashlib.sha256(BINARY.read_bytes()).hexdigest()!=HASH:raise RuntimeError('Official Auth binary hash mismatch')
    auth=get('/containers/'+ORIGINAL+'/json')
    labels=auth['Config'].get('Labels',{})
    if labels.get('com.docker.compose.service')!='auth' or labels.get('com.docker.compose.project.working_dir')!='/srv/garblac/backend':
        raise RuntimeError('Unexpected original Auth identity')
    environment=dict(value.split('=',1) for value in auth['Config'].get('Env',[]) if '=' in value)
    original_command=(auth['Config'].get('Entrypoint') or [])+(auth['Config'].get('Cmd') or [])
    if not original_command or pathlib.PurePosixPath(original_command[0]).name!='auth':
        raise RuntimeError('Unexpected original Auth command')
    arguments=[str(BINARY)]+original_command[1:]
    network=get('/networks/supabase_default')
    databases=[value['IPv4Address'].split('/')[0] for value in network.get('Containers',{}).values() if value.get('Name')=='supabase-db']
    if len(databases)!=1:raise RuntimeError('Could not identify catalogue database IP')
    url=urllib.parse.urlsplit(environment['GOTRUE_DB_DATABASE_URL'])
    if url.hostname not in ['db','supabase-db']:raise RuntimeError('Unexpected database host')
    credentials=url.netloc.rsplit('@',1)[0]
    environment['GOTRUE_DB_DATABASE_URL']=urllib.parse.urlunsplit(url._replace(netloc=credentials+'@'+databases[0]+':'+str(url.port or 5432)))
    pid=auth['State'].get('Pid',0)
    if not pid:
        matches=[]
        for directory in pathlib.Path('/proc').iterdir():
            if not directory.name.isdigit():continue
            try:
                if (directory/'comm').read_text().strip()=='auth' and ORIGINAL in (directory/'cgroup').read_text():matches.append(int(directory.name))
            except (FileNotFoundError,PermissionError,ProcessLookupError):pass
        if len(matches)!=1:raise RuntimeError('Could not identify preserved Auth network namespace')
        pid=matches[0]
    relay=json.loads(pathlib.Path('/srv/garblac/catalogo-gmail-relay/config.json').read_text())
    environment.update({'GOTRUE_SMTP_HOST':relay['bind_host'],'GOTRUE_SMTP_PORT':str(relay['port']),
        'GOTRUE_SMTP_USER':relay['smtp_user'],'GOTRUE_SMTP_PASS':relay['smtp_password'],
        'GOTRUE_SMTP_ADMIN_EMAIL':relay['sender'],'GOTRUE_SMTP_SENDER_NAME':'Garblac'})
    environment['PATH']='/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
    namespace=os.open('/proc/'+str(pid)+'/ns/net',os.O_RDONLY)
    running=None
    if PIDFILE.exists():
        try:
            previous=int(PIDFILE.read_text());os.kill(previous,0)
            if pathlib.Path('/proc/'+str(previous)+'/exe').resolve()==BINARY:running=previous
        except (OSError,ValueError):pass
    if not running:
        os.chmod(BINARY,0o755)
        child=os.fork()
        if child==0:
            try:
                os.setsid()
                null=os.open('/dev/null',os.O_RDONLY);os.dup2(null,0)
                log=os.open('/dev/shm/catalogo-auth-ram-private.log',os.O_WRONLY|os.O_CREAT|os.O_APPEND,0o600)
                os.dup2(log,1);os.dup2(log,2)
                libc=ctypes.CDLL(None,use_errno=True)
                if libc.setns(namespace,0x40000000)!=0:os._exit(125)
                os.close(namespace)
                os.chdir('/dev/shm')
                os.execve(str(BINARY),arguments,environment)
            except Exception:os._exit(126)
        running=child
        PIDFILE.write_text(str(child));os.chmod(PIDFILE,0o600)
        report['ram_auth_launched']=True
    os.close(namespace)
    report['ram_auth_pid']=running
    values={k.strip():v.strip().strip(chr(34)).strip(chr(39)) for line in pathlib.Path('/srv/garblac/backend/.env').read_text().splitlines()
        if '=' in line and not line.lstrip().startswith('#') for k,v in [line.split('=',1)]}
    for _ in range(10):
        try:
            request=urllib.request.Request('http://127.0.0.1:8000/auth/v1/health',headers={'apikey':values['ANON_KEY']})
            with urllib.request.urlopen(request,timeout=3) as response:report['auth_health_ok']=response.status==200
            if report['auth_health_ok']:break
        except Exception:pass
        time.sleep(2)
    report['status']='access_recovered_temporarily' if report['auth_health_ok'] else 'recovery_not_confirmed'
except Exception as error:
    report['status']='recovery_not_confirmed'
    report['error']=str(error) if isinstance(error,RuntimeError) else type(error).__name__
target=pathlib.Path('/dev/shm/catalogo-auth-ram-result.json')
if os.geteuid()==0:
    target.write_text(json.dumps(report,indent=2));os.chmod(target,0o600)
    owner=pwd.getpwnam('matias');os.chown(target,owner.pw_uid,owner.pw_gid)
print(json.dumps(report,indent=2),flush=True)
