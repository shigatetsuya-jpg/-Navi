import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root=new URL('../',import.meta.url);
test('concurrent applications keep capacity and waitlist bounds, reject duplicates and past events',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'navi-concurrent-')),path=join(dir,'db.sqlite');
 const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const child=spawn(process.execPath,[new URL('server.mjs',root).pathname],{cwd:root,env:{...process.env,DB_PATH:path,PORT:String(port),HOST:'127.0.0.1',RESEND_API_KEY:'',EMAIL_FROM:''},stdio:'ignore'});
 let db;
 t.after(async()=>{if(child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r))}db?.close();await rm(dir,{recursive:true,force:true})});
 const base=`http://127.0.0.1:${port}`;let ready=false;
 for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error('server exited');try{if((await fetch(base+'/health')).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,30))}assert.ok(ready);
 db=new DatabaseSync(path);db.exec('PRAGMA busy_timeout=5000;PRAGMA foreign_keys=ON');
 for(let id=1;id<=20;id++){db.prepare('INSERT INTO accounts(id,email,display_name,account_type,salt,password_hash) VALUES(?,?,?,?,?,?)').run(id,`test${id}@example.test`,'Test','member','s','h');db.prepare('INSERT INTO account_sessions VALUES(?,?,?)').run(createHash('sha256').update('session'+id).digest('hex'),id,Date.now()+60000)}
 db.exec("INSERT INTO circles(id,name,university,published,verified) VALUES(1,'Club','University',1,1);INSERT INTO events(id,circle_id,title,capacity,status,starts_at) VALUES(1,1,'Capacity',3,'open','2099-04-01T00:00:00Z'),(2,1,'Duplicate',10,'open','2099-04-01T00:00:00Z'),(3,1,'Past',10,'open','2000-04-01T00:00:00Z')");
 const apply=(event,id)=>fetch(base+`/api/events/${event}/applications`,{method:'POST',headers:{'content-type':'application/json',cookie:'sn_account=session'+id},body:'{}'});
 const responses=await Promise.all(Array.from({length:20},(_,i)=>apply(1,i+1)));
 assert.equal(responses.filter(r=>r.status===201).length,12);assert.equal(responses.filter(r=>r.status===409).length,8);
 const counts=Object.fromEntries(db.prepare('SELECT status,count(*) n FROM applications WHERE event_id=1 GROUP BY status').all().map(r=>[r.status,r.n]));assert.deepEqual(counts,{pending:3,waitlisted:9});
 const duplicates=await Promise.all(Array.from({length:8},()=>apply(2,1)));assert.equal(duplicates.filter(r=>r.status===201).length,1);assert.equal(duplicates.filter(r=>r.status===409).length,7);
 assert.equal(db.prepare('SELECT count(*) n FROM applications WHERE event_id=2').get().n,1);
 assert.equal((await apply(3,2)).status,409);assert.equal(db.prepare('SELECT count(*) n FROM applications WHERE event_id=3').get().n,0);
});
