import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { spawn } from 'node:child_process';
import { mkdtemp,readFile,readdir,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root=new URL('../',import.meta.url);
test('existing application data is backed up before notification schema upgrade',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'navi-upgrade-')),path=join(dir,'app.sqlite');
 const db=new DatabaseSync(path);
 db.exec('CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY)');
 for(const [i,file] of ['001-init.sql','002-accounts-events.sql'].entries()){db.exec(await readFile(new URL('migrations/'+file,root),'utf8'));db.prepare('INSERT INTO schema_migrations VALUES(?)').run(i+1)}
 db.exec("INSERT INTO circles(name,university,contact,published,verified) VALUES('Existing Club','University','internal@example.test',1,1)");db.close();
 const child=spawn(process.execPath,[new URL('server.mjs',root).pathname],{cwd:root,env:{...process.env,DB_PATH:path,PORT:'0',HOST:'127.0.0.1',RESEND_API_KEY:'',EMAIL_FROM:''},stdio:['ignore','pipe','pipe']});
 t.after(async()=>{if(child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r))}await rm(dir,{recursive:true,force:true})});
 await new Promise((ok,fail)=>{const timeout=setTimeout(()=>fail(Error('startup timeout')),5000);child.stdout.on('data',b=>{if(String(b).includes('listening')){clearTimeout(timeout);ok()}});child.once('exit',()=>{clearTimeout(timeout);fail(Error('server exited'))})});
 const files=await readdir(join(dir,'backups'));assert.equal(files.length,1);
 const before=new DatabaseSync(join(dir,'backups',files[0]),{readOnly:true});
 try{assert.deepEqual(before.prepare('SELECT version FROM schema_migrations ORDER BY version').all().map(r=>r.version),[1,2]);assert.equal(before.prepare('SELECT name FROM circles').get().name,'Existing Club');assert.equal(before.prepare("SELECT count(*) n FROM sqlite_master WHERE name='email_outbox'").get().n,0)}finally{before.close()}
 const after=new DatabaseSync(path,{readOnly:true});
 try{assert.deepEqual(after.prepare('SELECT version FROM schema_migrations ORDER BY version').all().map(r=>r.version),[1,2,3,4]);assert.equal(after.prepare('SELECT name FROM circles').get().name,'Existing Club')}finally{after.close()}
});
