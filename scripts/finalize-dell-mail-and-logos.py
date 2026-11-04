"""Explicit, interactive production approval required. Only catalogue Auth SMTP
and the three audited logo settings change. No other projects or data migrations.
Credentials must be placed privately in RAM; never pass passwords as arguments.
"""
import os,sys,json,pathlib,subprocess,hashlib,smtplib,ssl,re,datetime,tempfile,time,urllib.request

BASE=pathlib.Path('/srv/garblac/backend')
CREDS=pathlib.Path('/dev/shm/catalogo-smtp-credentials.json')
LOGOS=pathlib.Path('/dev/shm/catalogo-logo-fix.sql')
RUN_ID=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S')+'-'+str(os.getpid())
RESULT=pathlib.Path('/dev/shm/catalogo-finalization-result-'+RUN_ID+'.json')
report={'started_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'smtp_applied':False,'logos_applied':False,'errors':[]}

def run(args, data=None, timeout=90):
 r=subprocess.run(args,input=data,text=True,capture_output=True,timeout=timeout)
 if r.returncode: raise RuntimeError('Command failed: '+args[0]+' exit '+str(r.returncode))
 return r.stdout

def parse_env(text):
 out={}
 for line in text.splitlines():
  if '=' in line and not line.lstrip().startswith('#'):
   k,v=line.split('=',1);out[k.strip()]=v.strip().strip('"').strip("'")
 return out

def health(env):
 req=urllib.request.Request('http://127.0.0.1:8000/auth/v1/health',headers={'apikey':env.get('ANON_KEY','')})
 with urllib.request.urlopen(req,timeout=10) as response:return response.status==200

def write_env(text):
 with tempfile.NamedTemporaryFile(mode='w',dir=BASE,prefix='.env.audit-',delete=False) as f:
  temporary=pathlib.Path(f.name);os.chmod(temporary,0o600);f.write(text);f.flush();os.fsync(f.fileno())
 os.replace(temporary,BASE/'.env')

try:
 if os.geteuid()!=0:raise RuntimeError('Run with sudo')
 if len(sys.argv)!=2 or not re.fullmatch('[a-fA-F0-9]{64}',sys.argv[1]):raise RuntimeError('Expected audited logo SQL SHA-256 argument')
 if hashlib.sha256(LOGOS.read_bytes()).hexdigest()!=sys.argv[1].lower():raise RuntimeError('Logo SQL differs from audited file')
 if CREDS.stat().st_mode & 0o077:raise RuntimeError('SMTP credential file must be mode 600')
 credentials=json.loads(CREDS.read_text(encoding='utf-8-sig'))
 if set(credentials)!={'SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASS','SMTP_ADMIN_EMAIL','SMTP_SENDER_NAME'}:raise RuntimeError('Unexpected credential fields; refusing broader environment changes')
 if credentials.get('SMTP_HOST')!='smtp.gmail.com' or credentials.get('SMTP_PORT')!='587' or credentials.get('SMTP_USER')!='garblac01@gmail.com' or credentials.get('SMTP_ADMIN_EMAIL')!='garblac01@gmail.com':raise RuntimeError('SMTP settings differ from the reviewed Gmail plan')
 if not re.fullmatch('[A-Za-z0-9]{16}',credentials.get('SMTP_PASS','')) or credentials.get('SMTP_SENDER_NAME')!='Garblac':raise RuntimeError('Expected the reviewed sender and a Google application password')
 inspected=json.loads(run(['docker','inspect','supabase-auth']))[0]
 labels=inspected['Config'].get('Labels',{})
 if labels.get('com.docker.compose.service')!='auth' or pathlib.Path(labels.get('com.docker.compose.project.working_dir','')).resolve()!=BASE:raise RuntimeError('Auth does not belong to the expected catalogue compose project')
 files=[pathlib.Path(p).resolve() for p in labels.get('com.docker.compose.project.config_files','').split(',') if p]
 if not files or any(not p.is_relative_to(BASE) for p in files):raise RuntimeError('Compose files outside catalogue backend')
 project=labels.get('com.docker.compose.project','')
 if not project or 'milmoldes' in project.lower():raise RuntimeError('Unexpected compose project')
 runtime={k:v for item in inspected['Config'].get('Env',[]) if '=' in item for k,v in [item.split('=',1)]}
 if runtime.get('GOTRUE_SMTP_HOST')!='supabase-mail':raise RuntimeError('SMTP changed since audit; inspect before overwriting')
 source=(BASE/'.env').read_text();source_hash=hashlib.sha256(source.encode()).hexdigest();current=parse_env(source)
 with smtplib.SMTP('smtp.gmail.com',587,timeout=20) as smtp:
  smtp.ehlo();smtp.starttls(context=ssl.create_default_context());smtp.ehlo();smtp.login(credentials['SMTP_USER'],credentials['SMTP_PASS'])
 report['smtp_auth_from_dell_verified']=True
 print(json.dumps({'plan':{'smtp_host':'smtp.gmail.com','smtp_port':587,'sender':'garblac01@gmail.com','restart_only':'supabase-auth','compose_project':project,'logo_urls':3,'no_stock_sales_accounts_or_cart_permissions_changes':True,'smtp_connection_verified':True}},indent=2),flush=True)
 print('Tu instruccion exige autorizacion antes de modificar produccion. Se recreara solo Auth. Docker ya agoto tiempos al crear contenedores durante la auditoria; si falla, se intentara restaurar la configuracion anterior. Escribe APLICAR CATALOGO para autorizar este plan, o Enter para salir.',flush=True)
 if input().strip()!='APLICAR CATALOGO':
  report['status']='not_authorized_no_changes'
 else:
  if hashlib.sha256((BASE/'.env').read_text().encode()).hexdigest()!=source_hash:raise RuntimeError('Backend environment changed while awaiting approval')
  stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S')
  backup=pathlib.Path('/dev/shm/catalogo-backend-before-smtp-'+stamp+'.env')
  fd=os.open(backup,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
  with os.fdopen(fd,'w') as f:f.write(source)
  report['rollback_config_private_path']=str(backup)
  lines=[];remaining=dict(credentials)
  for line in source.splitlines():
   key=line.split('=',1)[0].strip() if '=' in line and not line.lstrip().startswith('#') else ''
   if key in remaining:lines.append(key+'='+remaining.pop(key))
   else:lines.append(line)
  lines.extend(k+'='+v for k,v in remaining.items())
  command=['docker','compose','--project-name',project,'--project-directory',str(BASE),'--env-file',str(BASE/'.env')]
  for file in files:command+=['-f',str(file)]
  command+=['up','-d','--no-deps','--no-build','--pull','never','auth']
  write_env('\n'.join(lines)+'\n')
  try:
   run(command,timeout=120)
   ready=False
   for attempt in range(12):
    try:
     if health(current):ready=True;break
    except Exception:pass
    time.sleep(2)
   if not ready:raise RuntimeError('Auth health did not recover')
   report['smtp_applied']=True;report['auth_health_ok']=True
  except Exception:
   write_env(source);report['rollback_attempted']=True
   try:run(command,timeout=120);report['rollback_health_ok']=health(current)
   except Exception:report['rollback_health_ok']=False
   raise RuntimeError('Auth update failed; previous config restored; inspect rollback health')
  run(['docker','exec','-i','supabase-db','psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],LOGOS.read_text(),timeout=30)
  report['logos_applied']=True;report['status']='applied_requires_live_and_recovery_verification'
except Exception as error:
 report['status']='failed_or_partial';report['errors'].append(type(error).__name__+': '+str(error) if isinstance(error,RuntimeError) else type(error).__name__)
report['finished_utc']=datetime.datetime.now(datetime.timezone.utc).isoformat()
report['report_path']=str(RESULT)
fd=os.open(RESULT,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w') as f:json.dump(report,f,indent=2)
os.chown(RESULT,1000,1000)
print(json.dumps(report,indent=2))
