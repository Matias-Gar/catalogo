"""Catalogue-only installer. Root preflight is read-only; explicit approval required.

Usage: sudo python3 <this-file> <private-RAM-stage> <public-bundle-manifest-sha256>
No password/token is passed as an argument or printed. No email is sent here.
"""
import datetime
import grp
import hashlib
import ipaddress
import json
import os
import pathlib
import pwd
import re
import shutil
import smtplib
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
import zipfile

BASE = pathlib.Path('/srv/garblac/backend')
DEST = pathlib.Path('/srv/garblac/catalogo-gmail-relay')
UNIT = pathlib.Path('/etc/systemd/system/catalogo-gmail-relay.service')
RUN = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S') + '-' + str(os.getpid())
REPORT = pathlib.Path('/dev/shm/catalogo-gmail-result-' + RUN + '.json')
report = {'mail_sent': False, 'production_changed': False, 'smtp_applied': False, 'logos_applied': False, 'errors': []}
docker_env = None
resume_installation = os.environ.get('CATALOGO_RESUME_GMAIL') == '1'
ram_systemctl = None


def run(args, data=None, timeout=30, env=None):
    label = ' '.join([pathlib.Path(args[0]).name] + args[1:3])
    report['last_step'] = label
    if args[0] == 'systemctl' and ram_systemctl:
        args = [str(ram_systemctl)] + args[1:]
    if args[0] == 'docker':
        args = [args[0], '--host', 'unix:///var/run/docker.sock'] + args[1:]
        env = docker_env
    try:
        result = subprocess.run(args, input=data, text=True, capture_output=True, timeout=timeout, env=env)
    except subprocess.TimeoutExpired:
        raise RuntimeError('Timeout after '+str(timeout)+' seconds: '+label) from None
    if result.returncode:
        raise RuntimeError('Command failed: ' + args[0] + ' exit ' + str(result.returncode))
    return result.stdout


def digest(file): return hashlib.sha256(file.read_bytes()).hexdigest()


def env_values(text):
    return {k.strip(): v.strip().strip('"').strip("'") for line in text.splitlines()
        if '=' in line and not line.lstrip().startswith('#') for k, v in [line.split('=', 1)]}


def replace_env(text, replacements):
    rest = dict(replacements); lines = []
    for line in text.splitlines():
        key = line.split('=', 1)[0].strip() if '=' in line and not line.lstrip().startswith('#') else ''
        lines.append(key + '=' + rest.pop(key) if key in rest else line)
    lines.extend(k + '=' + v for k, v in rest.items())
    return '\n'.join(lines) + '\n'


def write_env(text):
    with tempfile.NamedTemporaryFile(mode='w', dir=BASE, prefix='.env.catalogo-mail-', delete=False) as file:
        os.chmod(file.name, 0o600); file.write(text); file.flush(); os.fsync(file.fileno())
        temporary = file.name
    os.replace(temporary, BASE / '.env')


def auth_healthy(env):
    request = urllib.request.Request('http://127.0.0.1:8000/auth/v1/health', headers={'apikey': env.get('ANON_KEY', '')})
    with urllib.request.urlopen(request, timeout=8) as response: return response.status == 200


def await_health(env):
    for _ in range(10):
        try:
            if auth_healthy(env): return True
        except Exception: pass
        time.sleep(2)
    return False


def verify_bundle(stage, expected):
    manifest = stage / 'bundle-manifest.json'
    if digest(manifest) != expected: raise RuntimeError('Bundle manifest differs from reviewed files')
    files = json.loads(manifest.read_text())
    for name, sha in files.items():
        file = (stage / name).resolve()
        if not file.is_relative_to(stage) or digest(file) != sha: raise RuntimeError('Bundle file integrity check failed')
    required = {'scripts/gmail_oauth_relay.py', 'scripts/catalogo_docker_metadata.py', 'scripts/finalize-dell-logo-settings.sql', 'wheels/manifest.json'}
    if not required.issubset(files): raise RuntimeError('Incomplete bundle')
    return files


def unpack(stage):
    (DEST / 'deps').mkdir(mode=0o755)
    for package in json.loads((stage / 'wheels/manifest.json').read_text()):
        source = stage / 'wheels' / package['file']
        if digest(source) != package['sha256']: raise RuntimeError('Dependency SHA mismatch')
        with zipfile.ZipFile(source) as archive:
            for item in archive.infolist():
                if not (DEST / 'deps' / item.filename).resolve().is_relative_to(DEST / 'deps'):
                    raise RuntimeError('Unsafe dependency path')
            archive.extractall(DEST / 'deps')
    for extracted in (DEST / 'deps').rglob('*'):
        os.chmod(extracted, 0o755 if extracted.is_dir() else 0o644)


def verify_resume_installation(stage, config, owner):
    if not DEST.is_dir() or DEST.is_symlink() or DEST.stat().st_uid != 0:
        raise RuntimeError('Expected root-owned partial relay installation')
    if not UNIT.is_file() or UNIT.is_symlink() or UNIT.stat().st_uid != 0:
        raise RuntimeError('Expected root-owned partial service unit')
    secret = DEST / 'config.json'
    if secret.is_symlink() or secret.stat().st_uid != owner.pw_uid or secret.stat().st_mode & 0o077:
        raise RuntimeError('Unexpected installed credential permissions')
    if json.loads(secret.read_text()) != config:
        raise RuntimeError('Installed relay settings differ; preserving existing installation')
    if digest(DEST / 'relay.py') != digest(stage / 'scripts/gmail_oauth_relay.py'):
        raise RuntimeError('Installed relay code differs')
    for package in json.loads((stage / 'wheels/manifest.json').read_text()):
        source = stage / 'wheels' / package['file']
        if digest(source) != package['sha256']: raise RuntimeError('Dependency SHA mismatch')
        with zipfile.ZipFile(source) as archive:
            for item in archive.infolist():
                if item.is_dir(): continue
                target = (DEST / 'deps' / item.filename).resolve()
                if not target.is_relative_to(DEST / 'deps'):
                    raise RuntimeError('Unsafe installed dependency path')
                if digest(target) != hashlib.sha256(archive.read(item)).hexdigest():
                    raise RuntimeError('Installed dependency differs or is incomplete')


try:
    if os.geteuid() != 0: raise RuntimeError('Run this installer with sudo')
    if len(sys.argv) != 3 or not re.fullmatch('[a-f0-9]{64}', sys.argv[2]): raise RuntimeError('Expected stage and manifest SHA-256')
    stage = pathlib.Path(sys.argv[1]).resolve()
    if stage.parent != pathlib.Path('/dev/shm') or not stage.name.startswith('catalogo-gmail-prep-'):
        raise RuntimeError('Expected private catalogue staging in RAM')
    owner = pwd.getpwnam('matias')
    if stage.stat().st_uid != owner.pw_uid or stage.stat().st_mode & 0o077:
        raise RuntimeError('Staging must be private to matias')
    files = verify_bundle(stage, sys.argv[2])
    if os.environ.get('CATALOGO_USE_RAM_SYSTEMCTL') == '1':
        ram_systemctl = stage / 'systemctl-ram'
        if ram_systemctl.is_symlink() or digest(ram_systemctl) != '37ec607113f55f1b385b4fa75588a43402aec0de57927500763b267713f10f63':
            raise RuntimeError('RAM systemctl differs from the checked installed binary')
    secret = stage / 'relay-config.json'
    if secret.is_symlink() or secret.stat().st_uid != owner.pw_uid or secret.stat().st_mode & 0o077:
        raise RuntimeError('Credential file must be owned by matias and mode 600')
    secret_hash = digest(secret); config = json.loads(secret.read_text())
    if set(config) != {'client_id','client_secret','refresh_token','sender','smtp_user','smtp_password'}:
        raise RuntimeError('Unexpected credential fields')
    if config['sender'] != 'garblac01@gmail.com' or config['smtp_user'] != 'catalogo-auth' or not re.fullmatch('[a-f0-9]{96}', config['smtp_password']):
        raise RuntimeError('Unexpected catalogue sender or SMTP credentials')
    if (DEST.exists() or UNIT.exists()) and not resume_installation:
        raise RuntimeError('Relay installation already exists; use reviewed resume mode')
    if resume_installation and (not DEST.exists() or not UNIT.exists()):
        raise RuntimeError('No complete partial installation to resume')
    # The daemon's /version call hung during the previous preflight while the
    # direct container read returned immediately. Never guess an API version.
    sys.path.insert(0, str(stage/'scripts'))
    from catalogo_docker_metadata import read_metadata, cli_environment
    report['last_step'] = 'Read Auth metadata directly from the local Docker socket'
    auth, api_version = read_metadata('/containers/supabase-auth/json')
    docker_env = cli_environment(api_version)
    report['docker_api_version'] = api_version
    print('Comprobando cliente Docker con la version API anunciada por el servidor...', flush=True)
    if run(['docker','inspect','--format','{{.State.Status}}','supabase-auth'],timeout=12).strip() != 'running':
        raise RuntimeError('Auth not running or Docker CLI read failed')
    report['docker_cli_read_verified'] = True
    run(['docker','compose','version','--short'], timeout=12)
    report['docker_compose_client_available'] = True
    labels = auth['Config'].get('Labels', {})
    project = labels.get('com.docker.compose.project', '')
    if (labels.get('com.docker.compose.service') != 'auth' or not project or 'milmoldes' in project.lower() or
        pathlib.Path(labels.get('com.docker.compose.project.working_dir', '')).resolve() != BASE):
        raise RuntimeError('Auth is not the expected catalogue project')
    compose_files = [pathlib.Path(p).resolve() for p in labels.get('com.docker.compose.project.config_files', '').split(',') if p]
    if not compose_files or any(not p.is_relative_to(BASE) for p in compose_files): raise RuntimeError('Unexpected Compose paths')
    compose_hashes = {str(p): digest(p) for p in compose_files}
    runtime = dict(item.split('=',1) for item in auth['Config'].get('Env',[]) if '=' in item)
    if runtime.get('GOTRUE_SMTP_HOST') != 'supabase-mail': raise RuntimeError('SMTP changed since audit; inspect before changing it')
    networks = []
    for name in auth['NetworkSettings']['Networks']:
        report['last_step'] = 'Read network metadata for the catalogue Auth container'
        network, network_api = read_metadata('/networks/'+name)
        if network_api != api_version: raise RuntimeError('Docker API version changed during preflight')
        if network.get('Driver') == 'bridge' and network.get('Labels', {}).get('com.docker.compose.project') == project:
            networks.extend((name, row) for row in network.get('IPAM', {}).get('Config', [])
                if row.get('Gateway') and row.get('Subnet') and ipaddress.ip_network(row['Subnet']).version == 4)
    if len(networks) != 1: raise RuntimeError('Could not identify one exclusive catalogue IPv4 bridge')
    network_name, subnet = networks[0]
    config.update({'bind_host': subnet['Gateway'], 'allowed_cidr': subnet['Subnet'], 'port': 2526})
    if resume_installation:
        report['last_step'] = 'Verify the existing partial relay installation'
        verify_resume_installation(stage, config, owner)
        report['existing_installation_verified'] = True
    with socket.socket() as probe: probe.bind((config['bind_host'], config['port']))
    original = (BASE / '.env').read_text(); original_hash = digest(BASE / '.env'); current = env_values(original)
    if not auth_healthy(current): raise RuntimeError('Auth was not healthy before changes')
    check_env = dict(os.environ, PYTHONPATH=str(stage/'deps'), PYTHONDONTWRITEBYTECODE='1')
    checked = json.loads(run(['/usr/bin/python3',str(stage/'scripts/gmail_oauth_relay.py'),'--config',str(secret),'--check'], timeout=35, env=check_env))
    if not checked.get('oauth_refresh_verified'): raise RuntimeError('Gmail authorization did not refresh from Dell')
    report['oauth_refresh_verified_from_dell'] = True
    print(json.dumps({'plan': {'sender': config['sender'], 'new_service': UNIT.stem, 'private_network': network_name,
        'bind_only': config['bind_host']+':2526', 'auth_container_recreated': 'supabase-auth', 'compose_project': project,
        'logo_urls_updated': 3, 'business_data_or_cart_permissions_changes': False, 'emails_sent_by_installer': 0}}, indent=2), flush=True)
    print('Tu instruccion exige autorizacion antes de modificar produccion. Se instalara el adaptador Gmail y se recreara SOLO Auth; puede interrumpir brevemente nuevos inicios de sesion. Docker tuvo timeouts durante esta auditoria. Se conservara la configuracion anterior y se intentara rollback si falla. Google ya muestra En produccion y la cuenta se reautorizo. Escribe APLICAR CATALOGO GMAIL para autorizar este plan; Enter sale sin cambios.', flush=True)
    if input().strip() != 'APLICAR CATALOGO GMAIL':
        report['status'] = 'not_authorized_no_changes'
    else:
        verify_bundle(stage, sys.argv[2])
        if digest(secret) != secret_hash or digest(BASE/'.env') != original_hash or any(digest(pathlib.Path(p)) != sha for p,sha in compose_hashes.items()):
            raise RuntimeError('Configuration changed while awaiting approval')
        rollback = pathlib.Path('/dev/shm/catalogo-env-before-gmail-'+RUN)
        with os.fdopen(os.open(rollback,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600),'w') as file: file.write(original)
        report['rollback_env_private_path'] = str(rollback)
        if not resume_installation:
            DEST.mkdir(mode=0o750); os.chown(DEST,0,owner.pw_gid)
            report['production_changed'] = True
            unpack(stage)
            shutil.copyfile(stage/'scripts/gmail_oauth_relay.py',DEST/'relay.py'); os.chmod(DEST/'relay.py',0o644)
            with os.fdopen(os.open(DEST/'config.json',os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600),'w') as file: json.dump(config,file)
            os.chown(DEST/'config.json',owner.pw_uid,owner.pw_gid)
        unit = f'''[Unit]
Description=Catalogue Auth Gmail delivery adapter
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=simple
User=matias
Group={grp.getgrgid(owner.pw_gid).gr_name}
WorkingDirectory={DEST}
Environment=PYTHONPATH={DEST}/deps
Environment=PYTHONDONTWRITEBYTECODE=1
ExecStart=/usr/bin/python3 -u {DEST}/relay.py --config {DEST}/config.json
Restart=on-failure
RestartSec=10
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
CapabilityBoundingSet=
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
MemoryMax=128M

[Install]
WantedBy=multi-user.target
'''
        if resume_installation:
            if UNIT.read_text() != unit: raise RuntimeError('Existing service unit differs; no overwrite')
        else:
            with UNIT.open('x') as file: file.write(unit)
            os.chmod(UNIT,0o644)
        report['production_changed'] = True
        run(['systemctl','daemon-reload']); run(['systemctl','enable','--now',UNIT.stem],timeout=35)
        smtp_ready = False
        for _ in range(15):
            try:
                checked = json.loads(run([sys.executable, str(stage/'scripts/catalogo_smtp_probe.py'),
                                          str(auth['State']['Pid'])], timeout=10))
                if not checked.get('smtp_authentication_verified'):
                    raise RuntimeError('Auth network SMTP authentication failed')
                smtp_ready = True; break
            except Exception: time.sleep(1)
        if not smtp_ready:
            run(['systemctl','disable','--now',UNIT.stem]); raise RuntimeError('Relay did not become ready; Auth unchanged')
        report['private_smtp_auth_verified'] = True
        command = ['docker','compose','--project-name',project,'--project-directory',str(BASE),'--env-file',str(BASE/'.env')]
        for file in compose_files: command += ['-f',str(file)]
        command += ['up','-d','--no-deps','--no-build','--pull','never','auth']
        changes = {'SMTP_HOST':config['bind_host'],'SMTP_PORT':str(config['port']),'SMTP_USER':config['smtp_user'],
            'SMTP_PASS':config['smtp_password'],'SMTP_ADMIN_EMAIL':config['sender'],'SMTP_SENDER_NAME':'Garblac'}
        write_env(replace_env(original,changes))
        try:
            run(command,timeout=120)
            if not await_health(current): raise RuntimeError('Auth health did not recover')
            report['smtp_applied'] = True; report['auth_health_ok'] = True
        except Exception:
            write_env(original); report['rollback_attempted'] = True
            try:
                run(command,timeout=120); report['rollback_health_ok'] = await_health(current)
                if report['rollback_health_ok']: run(['systemctl','disable','--now',UNIT.stem])
            except Exception: report['rollback_health_ok'] = False
            raise RuntimeError('Auth update failed; old env restored; inspect rollback_health_ok') from None
        run(['docker','exec','-i','supabase-db','psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],
            (stage/'scripts/finalize-dell-logo-settings.sql').read_text(),timeout=35)
        report['logos_applied'] = True
        report['status'] = 'applied_requires_real_recovery_and_published_app_verification'
except Exception as error:
    report['status'] = 'failed_or_partial'
    report['errors'].append(str(error) if isinstance(error,RuntimeError) else type(error).__name__)
report['finished_utc'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
report['report_path'] = str(REPORT)
with os.fdopen(os.open(REPORT,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600),'w') as file: json.dump(report,file,indent=2)
os.chown(REPORT,pwd.getpwnam('matias').pw_uid,pwd.getpwnam('matias').pw_gid)
print(json.dumps(report,indent=2),flush=True)
