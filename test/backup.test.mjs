import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp,rm,stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { backupDatabase } from '../scripts/backup-db.mjs';

test('backup includes committed WAL data, restores and refuses overwrite or missing source',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'navi-backup-test-')),source=join(dir,'live.sqlite'),destination=join(dir,'backups','snapshot.sqlite');
 const live=new DatabaseSync(source);
 try{
  live.exec("PRAGMA journal_mode=WAL;CREATE TABLE entries(id INTEGER PRIMARY KEY,value TEXT);INSERT INTO entries(value) VALUES('committed')");
  await backupDatabase(source,destination);
  const restored=new DatabaseSync(destination,{readOnly:true});
  try{assert.equal(restored.prepare('SELECT value FROM entries').get().value,'committed')}finally{restored.close()}
  assert.equal((await stat(destination)).mode&0o777,0o600);
  live.exec("INSERT INTO entries(value) VALUES('later')");
  await assert.rejects(backupDatabase(source,destination),{code:'EEXIST'});
  const original=new DatabaseSync(destination,{readOnly:true});
  try{assert.equal(original.prepare('SELECT count(*) n FROM entries').get().n,1)}finally{original.close()}
  await assert.rejects(backupDatabase(source,source));
  const absent=join(dir,'missing.sqlite');await assert.rejects(backupDatabase(absent,join(dir,'invalid.sqlite')));await assert.rejects(stat(absent),{code:'ENOENT'});
 }finally{live.close();await rm(dir,{recursive:true,force:true})}
});
