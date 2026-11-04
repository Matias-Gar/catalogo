// Read-only verification of every saved file against the streamed SHA-256 manifest.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve(process.argv[2]||'');
if(!root.startsWith(path.resolve('backups')+path.sep))throw Error('Expected a project backup directory');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
const report={started_utc:new Date().toISOString(),backup_root:root,verified_files:0,verified_bytes:0,failures:[]};
for(const object of manifest.objects)for(const source of ['cloud','dell']){
 const entry=object[source];if(!entry)continue;
 const file=path.resolve(root,entry.relative_path);
 if(!file.startsWith(root+path.sep))throw Error('File outside backup root');
 try{
  const hash=crypto.createHash('sha256');let bytes=0;
  for await(const chunk of fs.createReadStream(file)){hash.update(chunk);bytes+=chunk.length;}
  if(hash.digest('hex')!==entry.sha256||bytes!==entry.bytes)report.failures.push({source,bucket:object.bucket,path_sha256:crypto.createHash('sha256').update(object.path).digest('hex'),reason:'hash_or_size_mismatch'});
  else{report.verified_files++;report.verified_bytes+=bytes;}
 }catch(error){report.failures.push({source,bucket:object.bucket,path_sha256:crypto.createHash('sha256').update(object.path).digest('hex'),reason:error.code||error.name});}
}
report.finished_utc=new Date().toISOString();report.passed=report.failures.length===0&&report.verified_files>0;
fs.writeFileSync('docs/migration-storage-backup-verification-2026-10-29.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
