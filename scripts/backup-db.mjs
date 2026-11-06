import { DatabaseSync, backup } from 'node:sqlite';
import { mkdir, mkdtemp, chmod, link, rm } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function backupDatabase(sourcePath,destinationPath){
 const source=resolve(sourcePath),destination=resolve(destinationPath);
 if(source===destination)throw Error('Backup destination must differ from the database');
 // Read-only opening fails if the source is missing; never create an empty DB.
 const db=new DatabaseSync(source,{readOnly:true});
 let tempDir;
 try{
  await mkdir(dirname(destination),{recursive:true});
  tempDir=await mkdtemp(join(dirname(destination),'.navi-backup-'));
  const tempPath=join(tempDir,'backup.sqlite');
  // SQLite backup API includes committed WAL contents while the app is running.
  await backup(db,tempPath);
  await chmod(tempPath,0o600);
  const copy=new DatabaseSync(tempPath,{readOnly:true});
  try{
   const result=copy.prepare('PRAGMA integrity_check').all();
   if(result.length!==1||Object.values(result[0])[0]!=='ok')throw Error('Backup integrity check failed');
   if(copy.prepare('PRAGMA foreign_key_check').all().length)throw Error('Backup foreign key check failed');
  }finally{copy.close()}
  // Publish atomically and refuse to replace an existing file.
  await link(tempPath,destination);
  return destination;
 }finally{db.close();if(tempDir)await rm(tempDir,{recursive:true,force:true})}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  if(!process.argv[2])throw Error('Usage: node scripts/backup-db.mjs <backup-path> (source: DB_PATH or ./data/shinkanavi.sqlite)');
  const path=await backupDatabase(process.env.DB_PATH||'./data/shinkanavi.sqlite',process.argv[2]);
  console.log('Verified SQLite backup created:',path);
 }catch(e){console.error('Backup failed:',e.message);process.exitCode=1}
}
