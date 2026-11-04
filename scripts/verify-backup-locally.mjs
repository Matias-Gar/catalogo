import fs from 'node:fs';
import crypto from 'node:crypto';
import { PGlite } from '../.audit-access/restore-tools/node_modules/@electric-sql/pglite/dist/index.js';
import { pgcrypto } from '../.audit-access/restore-tools/node_modules/@electric-sql/pglite/dist/contrib/pgcrypto.js';
import { uuid_ossp } from '../.audit-access/restore-tools/node_modules/@electric-sql/pglite/dist/contrib/uuid_ossp.js';
const metadata=JSON.parse(fs.readFileSync('docs/migration-dell-schema-2026-10-29.json','utf8').replace(/^\uFEFF/,''));
const fullMode=process.argv.includes('--dell');
const report={started_utc:new Date().toISOString(),engine:'PGlite PostgreSQL WASM; isolated local process, not Dell services',files:{},copies:[],errors:[]};
const db=await PGlite.create({extensions:{pgcrypto,uuid_ossp}});
let phase='bootstrap';
function clean(s){return s.replace(/^\\(?:un)?restrict[^\n]*$/gm,'').replace(/^ALTER .* OWNER TO .*;$/gm,'').replace(/^CREATE SCHEMA public;$/gm,'');}
async function execute(sql){if(sql.trim())await db.exec(sql);}
async function restore(name){
 phase=name;let source=clean(fs.readFileSync('.audit-access/'+name,'utf8'));
 report.files[name]={sha256:crypto.createHash('sha256').update(fs.readFileSync('.audit-access/'+name)).digest('hex')};
 const pattern=/^COPY ([^\n]+) FROM stdin;\r?\n/gm;let offset=0,match;
 while((match=pattern.exec(source))){await execute(source.slice(offset,match.index));
  const dataStart=pattern.lastIndex;const end=/^\\\.\r?$/gm;end.lastIndex=dataStart;const marker=end.exec(source);if(!marker)throw Error('Missing COPY terminator');
  const data=source.slice(dataStart,marker.index);await db.query('COPY '+match[1]+" FROM '/dev/blob';",[],{blob:new Blob([data])});
  report.copies.push({table:match[1].split(' (')[0],rows:data?data.split('\n').length-1:0});
  offset=marker.index+marker[0].length;pattern.lastIndex=offset;
 }
 await execute(source.slice(offset));
}
try{
 for(const role of metadata.production_roles||[])if(role!=='postgres')await db.exec('CREATE ROLE "'+role.replaceAll('"','""')+'";');
 await db.exec('CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions; CREATE EXTENSION "uuid-ossp" WITH SCHEMA extensions; SET check_function_bodies=false;');
 if(fullMode){await restore('catalogo-dell-completo.sql');}else{
 phase='auth/storage schema';
 const schemaFile='.audit-access/auth-storage-schema.sql';
 const schema=clean(fs.readFileSync(schemaFile,'utf8'));
 report.files['auth-storage-schema.sql']={sha256:crypto.createHash('sha256').update(fs.readFileSync(schemaFile)).digest('hex')};
 const chunks=schema.split(/(?=^--\r?\n-- Name:)/m);const deferred=[];
 for(const chunk of chunks){if(/; Type: (?:TRIGGER|FK CONSTRAINT|CONSTRAINT|INDEX|POLICY|ROW SECURITY|ACL|DEFAULT ACL|COMMENT);/.test(chunk))deferred.push(chunk);else await execute(chunk);}
 await restore('garblac-auth.sql');
 await restore('garblac-storage.sql');
 // Public foreign keys need the restored Auth primary/unique keys to exist first.
 const remaining=[];
 for(const chunk of deferred){if(/; Type: CONSTRAINT;/.test(chunk))await execute(chunk);else remaining.push(chunk);}
 await restore('garblac-public.sql');
 phase='auth/storage deferred constraints';for(const chunk of remaining)await execute(chunk);
 }
 phase='validation';
 const tables=(await db.query("select schemaname,tablename from pg_tables where schemaname in ('public','auth','storage') order by 1,2")).rows;
 report.tables={};
 for(const table of tables){const q='"'+table.schemaname+'"."'+table.tablename+'"';const result=(await db.query('select count(*)::int count,md5(coalesce(string_agg(h,\'\' order by h),\'\')) rowset_md5 from (select md5(row_to_json(t)::text) h from '+q+' t) h')).rows[0];report.tables[table.schemaname+'.'+table.tablename]=result;}
 report.constraints=(await db.query("select n.nspname schema,c.relname tab,x.conname name,x.contype type,x.convalidated validated,pg_get_constraintdef(x.oid) definition from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','auth','storage') order by 1,2,3")).rows;
 report.constraint_tests=[];
 for(const [name,sql,expected]of [
  ['product_primary_key','insert into public.productos overriding system value select * from public.productos limit 1','23505'],
  ['product_not_null','update public.productos set user_id=null where user_id=(select min(user_id) from public.productos)','23502'],
  ['detail_product_fk','update public.ventas_detalle set producto_id=-9223372036854775807 where id=(select min(id) from public.ventas_detalle)','23503']
 ]){await db.exec('BEGIN');try{await db.exec(sql);report.constraint_tests.push({name,passed:false});}catch(error){report.constraint_tests.push({name,passed:error.code===expected,code:error.code});}finally{await db.exec('ROLLBACK');}}
 report.status=report.constraint_tests.every(t=>t.passed)?'restored_and_constraint_tests_passed':'restored_constraint_test_issue';
 phase='isolated logo change validation';
 const before={};for(const table of ['app_settings','pais_settings'])before[table]=(await db.query('select * from public.'+table)).rows;
 await db.exec(fs.readFileSync('scripts/finalize-dell-logo-settings.sql','utf8'));
 const after={};for(const table of ['app_settings','pais_settings'])after[table]=(await db.query('select * from public.'+table)).rows;
 let logoChanges=0,otherChanges=0;const metadataChanges=[];
 for(const table of Object.keys(before))for(const row of before[table]){
  const key=table==='app_settings'?'key':'pais_id';const other=after[table].find(x=>x[key]===row[key]);
  if(row.settings.store_logo_url!==other.settings.store_logo_url)logoChanges++;
  const a=structuredClone(row),b=structuredClone(other);delete a.settings.store_logo_url;delete b.settings.store_logo_url;
  if(a.updated_at!==b.updated_at)metadataChanges.push({table,field:'updated_at'});
  delete a.updated_at;delete b.updated_at;
  if(JSON.stringify(a)!==JSON.stringify(b))otherChanges++;
 }
 report.logo_change_test={changed_logos:logoChanges,other_row_changes:otherChanges,automatic_metadata_updates:metadataChanges,passed:logoChanges===3&&otherChanges===0};
}catch(error){report.status='failed';report.errors.push({phase,code:error.code||error.name});fs.writeFileSync('.audit-access/restore-private-error.json',JSON.stringify({phase,message:error.message,code:error.code},null,2));}
report.finished_utc=new Date().toISOString();
fs.writeFileSync(fullMode?'docs/migration-dell-local-restore-2026-10-29.json':'docs/migration-local-restore-2026-10-29.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({status:report.status,errors:report.errors,tables:report.tables?Object.keys(report.tables).length:0,constraint_tests:report.constraint_tests}));
await db.close();
