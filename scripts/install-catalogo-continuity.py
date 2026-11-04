"""Persist verified Auth recovery without replacing or restarting working Auth."""
import datetime
import hashlib
import json
import os
import pathlib
import pwd
import shutil
import subprocess
import urllib.request

EXPECTED = {"auth-v2.197.0":"f2aa147268461f74784ddc8b2240aa446ee71ceb9633bac41c30e7b852a860aa","recover.py":"c650c2dea70754f5c29e36244845783b0cf298e7b757325f5d68430df862a3df","supervisor.py":"4517d8bb759872a3d59c6a627d19570ca563180d4ecf62ba7dfca769a40939df"}
DEST=pathlib.Path('/srv/garblac/auth-continuity')
UNIT=pathlib.Path('/etc/systemd/system/catalogo-auth-continuity.service')
SYSTEMCTL=pathlib.Path('/dev/shm/catalogo-gmail-prep-20261029-2227/systemctl-ram')
report={'started_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'auth_restarted':False,'docker_restarted':False,'containers_deleted':0,'continuity_installed':False}
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def run(args,timeout=30,**kwargs):
    result=subprocess.run(args,capture_output=True,text=True,timeout=timeout,**kwargs)
    if result.returncode:raise RuntimeError('Command failed: '+pathlib.Path(args[0]).name)
    return result.stdout

try:
    if os.geteuid()!=0:raise RuntimeError('Run with sudo')
    sources={'auth-v2.197.0':pathlib.Path('/dev/shm/catalogo-auth-ram'),
             'recover.py':pathlib.Path('/dev/shm/catalogo-continuity-recover.py'),
             'supervisor.py':pathlib.Path('/dev/shm/catalogo-continuity-supervisor.py')}
    if set(EXPECTED)!=set(sources):raise RuntimeError('Incomplete recovery manifest')
    for name,source in sources.items():
        if source.is_symlink() or digest(source)!=EXPECTED[name]:raise RuntimeError('Recovery integrity mismatch: '+name)
    if digest(SYSTEMCTL)!='37ec607113f55f1b385b4fa75588a43402aec0de57927500763b267713f10f63':
        raise RuntimeError('Unexpected RAM systemctl')
    values={k.strip():v.strip().strip(chr(34)).strip(chr(39)) for line in pathlib.Path('/srv/garblac/backend/.env').read_text().splitlines()
        if '=' in line and not line.lstrip().startswith('#') for k,v in [line.split('=',1)]}
    request=urllib.request.Request('http://127.0.0.1:8000/auth/v1/health',headers={'apikey':values['ANON_KEY']})
    with urllib.request.urlopen(request,timeout=5) as response:
        if response.status!=200:raise RuntimeError('Auth must already be healthy; preserving current state')
    if DEST.is_symlink():raise RuntimeError('Unexpected continuity directory')
    DEST.mkdir(mode=0o700,exist_ok=True)
    if DEST.stat().st_uid!=0 or DEST.stat().st_mode&0o077:raise RuntimeError('Continuity directory must be private to root')
    for name,source in sources.items():
        target=DEST/name
        if target.exists():
            if target.is_symlink() or digest(target)!=EXPECTED[name]:raise RuntimeError('Existing recovery file differs; preserving it')
        else:
            temporary=DEST/(name+'.preparing')
            with source.open('rb') as incoming,temporary.open('xb') as outgoing:
                os.chmod(temporary,0o700 if name.startswith('auth-') else 0o600)
                shutil.copyfileobj(incoming,outgoing);outgoing.flush();os.fsync(outgoing.fileno())
            if digest(temporary)!=EXPECTED[name]:raise RuntimeError('Persisted recovery copy mismatch')
            os.replace(temporary,target)
    health=DEST/'health.json'
    if health.exists():
        if json.loads(health.read_text())!={'anon_key':values['ANON_KEY']}:raise RuntimeError('Existing health configuration differs')
    else:
        with os.fdopen(os.open(health,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600),'w') as file:
            json.dump({'anon_key':values['ANON_KEY']},file)
    unit='''[Unit]
Description=Catalogue Auth continuity supervisor
After=network-online.target docker.service catalogo-gmail-relay.service
Wants=network-online.target docker.service

[Service]
Type=simple
User=root
WorkingDirectory=/srv/garblac/auth-continuity
Environment=PYTHONDONTWRITEBYTECODE=1
ExecStart=/usr/bin/python3 -u /srv/garblac/auth-continuity/supervisor.py
Restart=on-failure
RestartSec=10
UMask=0077

[Install]
WantedBy=multi-user.target
'''
    if UNIT.exists():
        if UNIT.is_symlink() or UNIT.read_text()!=unit:raise RuntimeError('Existing unit differs; preserving it')
    else:
        with UNIT.open('x') as file:file.write(unit)
        os.chmod(UNIT,0o644)
    print('Recuperacion conservada en disco. Habilitando supervision sin reiniciar Auth...',flush=True)
    run([str(SYSTEMCTL),'daemon-reload'])
    run([str(SYSTEMCTL),'enable','--now',UNIT.stem])
    report['continuity_state']=run([str(SYSTEMCTL),'show',UNIT.stem,'--property=ActiveState,SubState,UnitFileState','--no-pager']).strip()
    report['continuity_installed']='ActiveState=active' in report['continuity_state'] and 'UnitFileState=enabled' in report['continuity_state']
    report['persistent_files_verified']=all(digest(DEST/name)==sha for name,sha in EXPECTED.items())
    print('Conservando respaldo SQL actualizado con las ventas recientes...',flush=True)
    backup=pathlib.Path('/dev/shm/catalogo-cierre-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S')+'.sql')
    environment=dict(os.environ,DOCKER_API_VERSION='1.52')
    with os.fdopen(os.open(backup,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600),'wb') as file:
        result=subprocess.run(['docker','--host','unix:///var/run/docker.sock','exec','supabase-db','pg_dump',
            '-U','postgres','-d','postgres','--schema=public','--schema=auth','--schema=storage','--no-owner','--no-privileges'],
            stdout=file,stderr=subprocess.PIPE,timeout=60,env=environment)
    if result.returncode:raise RuntimeError('Updated SQL backup failed; partial file preserved')
    owner=pwd.getpwnam('matias');os.chown(backup,owner.pw_uid,owner.pw_gid)
    report['updated_sql_backup']={'path':str(backup),'bytes':backup.stat().st_size,'sha256':digest(backup)}
    report['status']='software_continuity_installed_requires_backup_download_and_mail_receipt'
except Exception as error:
    report['status']='partial_review_report'
    report['error']=str(error) if isinstance(error,RuntimeError) else type(error).__name__
report['finished_utc']=datetime.datetime.now(datetime.timezone.utc).isoformat()
target=pathlib.Path('/dev/shm/catalogo-continuity-result.json')
if os.geteuid()==0:
    target.write_text(json.dumps(report,indent=2));os.chmod(target,0o600)
    owner=pwd.getpwnam('matias');os.chown(target,owner.pw_uid,owner.pw_gid)
print(json.dumps(report,indent=2),flush=True)
