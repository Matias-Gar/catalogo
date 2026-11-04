"""Run with sudo on Dell. Production SQL is read-only. Restores only in a new,
network-isolated disposable container. Never deletes existing containers or data.
No credentials or row contents are written to the report.
"""
import subprocess, json, pathlib, datetime, hashlib, os, pwd, re

ROOT=pathlib.Path('/srv/garblac')
OUT=ROOT/'backups'/'auditoria-20261029'
RUN_ID=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S')+'-'+str(os.getpid())
CONTAINER='catalogo-audit-restore-'+RUN_ID
IMAGE='supabase/postgres:17.6.1.136'
report={'started_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'audit_container':CONTAINER,'errors':[]}
created=False

def run(args, data=None, required=True):
    r=subprocess.run(args,input=data,text=True,capture_output=True,timeout=300)
    if required and r.returncode: raise RuntimeError('Command failed: '+args[0]+' (exit '+str(r.returncode)+')')
    return r

def sql(container, query, db='postgres'):
    # Every query in the production container has transaction_read_only enabled.
    prefix='SET default_transaction_read_only=on; ' if container=='supabase-db' else ''
    r=run(['docker','exec','-i',container,'psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-U','postgres','-h','/tmp' if container==CONTAINER else '/var/run/postgresql','-d',db],prefix+query)
    return r.stdout.strip()

SCHEMA="""
select json_build_object(
 'columns',(select coalesce(json_agg(row_to_json(x)),'[]') from (select table_schema,table_name,column_name,ordinal_position,data_type,udt_name,is_nullable,column_default from information_schema.columns where table_schema in ('public','auth','storage') order by 1,2,4) x),
 'constraints',(select coalesce(json_agg(row_to_json(x)),'[]') from (select n.nspname schema,c.relname tab,con.conname name,con.contype type,pg_get_constraintdef(con.oid) definition,con.convalidated validated from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','auth','storage') order by 1,2,3) x),
 'rls',(select coalesce(json_agg(row_to_json(x)),'[]') from (select n.nspname schema,c.relname tab,c.relrowsecurity enabled,c.relforcerowsecurity forced from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','auth','storage') and c.relkind='r' order by 1,2) x),
 'policies',(select coalesce(json_agg(row_to_json(x)),'[]') from (select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies where schemaname in ('public','auth','storage') order by 1,2,3) x),
 'grants',(select coalesce(json_agg(row_to_json(x)),'[]') from (select table_schema,table_name,grantee,privilege_type from information_schema.role_table_grants where table_schema in ('public','auth','storage') and grantee in ('anon','authenticated','service_role') order by 1,2,3,4) x),
 'functions',(select coalesce(json_agg(row_to_json(x)),'[]') from (select n.nspname schema,p.proname name,pg_get_function_identity_arguments(p.oid) args,p.prosecdef security_definer,p.proacl acl,md5(p.prosrc) body_md5,p.proconfig config from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','auth','storage') order by 1,2,3) x)
);
"""

def summary(db):
    metadata=json.loads(sql(CONTAINER,SCHEMA,db))
    counts={}; hashes={}
    tables=json.loads(sql(CONTAINER,"select coalesce(json_agg(json_build_object('schema',schemaname,'table',tablename)),'[]') from pg_tables where schemaname in ('public','auth','storage');",db))
    for row in tables:
        qualified='"'+row['schema'].replace('"','""')+'"."'+row['table'].replace('"','""')+'"'
        result=json.loads(sql(CONTAINER,"select json_build_object('count',count(*),'md5',md5(coalesce(string_agg(rowhash,'' order by rowhash),''))) from (select md5(row_to_json(t)::text) rowhash from "+qualified+" t) q;",db))
        counts[row['schema']+'.'+row['table']]=result['count']; hashes[row['schema']+'.'+row['table']]=result['md5']
    return {'schema':metadata,'table_counts':counts,'rowset_md5':hashes}

try:
    if os.geteuid()!=0: raise RuntimeError('Run this script with sudo')
    mounts=json.loads(run(['docker','inspect','--format','{{json .Mounts}}','supabase-db']).stdout)
    if not any(str(m.get('Source','')).startswith('/srv/garblac/') for m in mounts): raise RuntimeError('Production container not confirmed within /srv/garblac')
    report['production_container']='supabase-db'
    report['production_schema']=json.loads(sql('supabase-db',SCHEMA))
    report['production_roles']=json.loads(sql('supabase-db',"select json_agg(rolname) from pg_roles where rolname not like 'pg_%';"))
    report['auth_config']={}
    for name in ['supabase-auth','supabase-storage']:
        inspect=json.loads(run(['docker','inspect',name]).stdout)[0]
        allowed=['GOTRUE_SITE_URL','GOTRUE_URI_ALLOW_LIST','GOTRUE_API_EXTERNAL_URL','API_EXTERNAL_URL','GOTRUE_MAILER_AUTOCONFIRM','GOTRUE_SMTP_HOST','GOTRUE_SMTP_PORT','GOTRUE_SMTP_ADMIN_EMAIL','GOTRUE_EXTERNAL_PHONE_ENABLED','GOTRUE_SMS_AUTOCONFIRM','STORAGE_BACKEND','FILE_STORAGE_BACKEND_PATH']
        report['auth_config'][name]={k:v for item in inspect['Config'].get('Env',[]) if '=' in item for k,v in [item.split('=',1)] if k in allowed}
    existing=run(['docker','container','inspect',CONTAINER],required=False)
    if existing.returncode==0: raise RuntimeError('Audit container already exists; refusing to reuse or overwrite')
    # No network, no host ports, no production mounts. Only project backups mounted read-only.
    run(['docker','run','--detach','--name',CONTAINER,'--network','none','--memory','1g','--cpus','1','--user','postgres','--mount','type=bind,src=/srv/garblac/backups,dst=/audit-backups,readonly','--entrypoint','bash',IMAGE,'-lc',"initdb -D /tmp/auditpg -U postgres --auth=trust >/dev/null && pg_ctl -D /tmp/auditpg -o '-k /tmp -c listen_addresses=' -w start >/dev/null && sleep infinity"])
    created=True
    import time
    for attempt in range(30):
        ready=run(['docker','exec',CONTAINER,'pg_isready','-h','/tmp','-U','postgres'],required=False)
        if ready.returncode==0: break
        time.sleep(1)
    roles=report['production_roles']
    for role in roles:
        if role=='postgres': continue
        sql(CONTAINER,'CREATE ROLE "'+role.replace('"','""')+'" NOLOGIN;')
    report['restores']={}
    for label,relative in [('dell_backup','automaticos/garblac-db-20261029_060001.dump'),('cloud_migration_snapshot','garblac-cloud.dump')]:
        backup=(ROOT/'backups'/relative).resolve()
        if not backup.is_relative_to(ROOT/'backups') or not backup.is_file(): raise RuntimeError('Backup path not confirmed')
        sha=hashlib.sha256()
        with backup.open('rb') as f:
            for block in iter(lambda:f.read(1024*1024),b''): sha.update(block)
        sql(CONTAINER,'CREATE DATABASE '+label+' TEMPLATE template0;')
        restore=run(['docker','exec','--user','root',CONTAINER,'pg_restore','--no-owner','--no-privileges','--exit-on-error','-h','/tmp','-U','postgres','-d',label,'/audit-backups/'+relative],required=False)
        item={'file':relative,'backup_sha256':sha.hexdigest(),'restore_exit_code':restore.returncode,'stderr_lines':len(restore.stderr.splitlines())}
        if restore.returncode:
            # No SQL/data stderr is exposed: Auth rows can include password hashes.
            item['status']='FAILED; database may be partial; not approved'
        else:
            item['status']='restored'
            item.update(summary(label))
        report['restores'][label]=item
    # Databases remain inside the stopped, isolated audit container for inspection.
    run(['docker','stop',CONTAINER])
    report['audit_container_stopped']=True
except Exception as exc:
    report['errors'].append(str(exc))
finally:
    if created and not report.get('audit_container_stopped'):
        stopped=run(['docker','stop',CONTAINER],required=False)
        report['audit_container_stopped']=stopped.returncode==0
report['finished_utc']=datetime.datetime.now(datetime.timezone.utc).isoformat()
OUT.mkdir(mode=0o700,exist_ok=True)
dest=OUT/('restore-report-'+RUN_ID+'.json')
dest.write_text(json.dumps(report,indent=2,sort_keys=True))
owner=pwd.getpwnam('matias')
os.chown(dest,owner.pw_uid,owner.pw_gid); os.chmod(dest,0o600)
print(json.dumps({'report':str(dest),'errors':report['errors'],'restores':{k:{f:v.get(f) for f in ['status','restore_exit_code','stderr_lines']} for k,v in report.get('restores',{}).items()}},indent=2))
