import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyMigration } from '../scripts/migrate-db.mjs';
test('schema and version marker roll back together and can be retried',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'navi-migration-')),file=join(dir,'migration.sql'),db=new DatabaseSync(':memory:');
 try{
 db.exec('CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY);CREATE TABLE accounts(id INTEGER PRIMARY KEY)');
 await writeFile(file,'ALTER TABLE accounts ADD COLUMN verified INTEGER DEFAULT 0; INSERT INTO nonexistent VALUES(1);');
 await assert.rejects(applyMigration(db,1,file));
 assert.equal(db.prepare('PRAGMA table_info(accounts)').all().length,1);assert.equal(db.prepare('SELECT count(*) n FROM schema_migrations').get().n,0);
 await writeFile(file,'ALTER TABLE accounts ADD COLUMN verified INTEGER DEFAULT 0;');await applyMigration(db,1,file);
 assert.equal(db.prepare('PRAGMA table_info(accounts)').all().length,2);assert.equal(db.prepare('SELECT version FROM schema_migrations').get().version,1);
 await writeFile(file,'CREATE TABLE unexpected(id INTEGER);');await assert.rejects(applyMigration(db,1,file));assert.equal(db.prepare("SELECT count(*) n FROM sqlite_master WHERE name='unexpected'").get().n,0);
 }finally{db.close();await rm(dir,{recursive:true,force:true})}
});
