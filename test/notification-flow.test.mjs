import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp,rm,readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
const root=new URL('../',import.meta.url);
const hash=v=>createHash('sha256').update(v).digest('hex');
async function until(fn){for(let i=0;i<150;i++){if(await fn())return;await new Promise(r=>setTimeout(r,20))}throw Error('Timed out');}
test('confirmed addresses, expiry, resend, application capacity, isolation and mail delivery',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'navi-mail-')),path=join(dir,'db.sqlite'),log=join(dir,'mail.jsonl');
 const s=createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const port=s.address().port;await new Promise(r=>s.close(r));
 const db=new DatabaseSync(path);db.exec('PRAGMA busy_timeout=5000;PRAGMA foreign_keys=ON;CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY)');
 for(const [i,file] of ['001-init.sql','002-accounts-events.sql','003-email-outbox.sql','004-email-verification.sql'].entries()){db.exec(await readFile(new URL('migrations/'+file,root),'utf8'));db.prepare('INSERT INTO schema_migrations VALUES(?)').run(i+1)}
 const account=db.prepare('INSERT INTO accounts(id,email,display_name,account_type,salt,password_hash,email_verified) VALUES(?,?,?,?,?,?,?)');
 for(const [id,email,role,verified] of [[1,'student@example.test','member',0],[2,'waiting@example.test','member',1],[3,'manager@example.test','organization',1],[4,'other@example.test','organization',0],[5,'retry@example.test','member',1]]){account.run(id,email,'Private Student Name',role,'salt','hash',verified);db.prepare('INSERT INTO account_sessions VALUES(?,?,?)').run(hash('session'+id),id,Date.now()+60000)}
 db.exec("INSERT INTO circles(id,name,university,published,verified,contact) VALUES(1,'Public Club','University',1,1,'internal@example.test'),(2,'Unverified Club','University',1,0,'hidden@example.test'),(3,'Hidden Club','University',0,1,'hidden@example.test');INSERT INTO circle_managers(circle_id,account_id) VALUES(1,3),(1,4);INSERT INTO events(id,circle_id,title,capacity,status) VALUES(1,1,'Trial',1,'open')");
 const queue=db.prepare('INSERT INTO email_outbox(recipient,kind,payload_json) VALUES(?,?,?)');
 queue.run('retry@example.test','application-status','{"eventTitle":"Trial"}');
 queue.run('other@example.test','application-status','{"eventTitle":"Legacy queue"}');
 queue.run('other@example.test','email-verification',JSON.stringify({token:'e'.repeat(43),expiresAt:Date.now()-1}));
 db.prepare('INSERT INTO email_verifications VALUES(?,?,?,datetime(\'now\'))').run(1,hash('a'.repeat(43)),Date.now()+60000);
 const child=spawn(process.execPath,['--import',new URL('test/fixtures/mail-transport.mjs',root).pathname,new URL('server.mjs',root).pathname],{cwd:root,env:{...process.env,DB_PATH:path,PORT:String(port),HOST:'127.0.0.1',RESEND_API_KEY:'test-only',EMAIL_FROM:'navi@example.test',TEST_MAIL_LOG:log},stdio:'ignore'});
 t.after(async()=>{if(child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r))}db.close();await rm(dir,{recursive:true,force:true})});
 const base=`http://127.0.0.1:${port}`;
 async function api(route,id,body){return fetch(base+route,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json',...(id?{cookie:'sn_account=session'+id}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})})}
 await until(async()=>{if(child.exitCode!==null)throw Error('Server exited');try{return(await api('/health')).ok}catch{return false}});
 const list=await(await api('/api/circles')).json();assert.equal(list.length,1);assert.ok(!('contact'in list[0]));
 assert.ok(!('contact'in await(await api('/api/circles/1')).json()));
 for(const id of [2,3])assert.equal((await api('/api/circles/'+id)).status,404);
 assert.equal((await api('/api/events/1/applications',1,{})).status,403);
 assert.equal((await api('/api/auth/email-verification/confirm',null,{token:'a'.repeat(43)})).status,200);
 assert.equal((await api('/api/auth/email-verification/confirm',null,{token:'a'.repeat(43)})).status,400);
 db.prepare('UPDATE accounts SET email_verified=0 WHERE id=1').run();
 assert.equal((await api('/api/auth/email-verification',1,{})).status,200);
 function latestToken(){
 const row=db.prepare("SELECT id,payload_json FROM email_outbox WHERE recipient='student@example.test' AND kind='email-verification' ORDER BY id DESC LIMIT 1").get();
 const token=JSON.parse(row.payload_json).token;if(token)return token;
 const mail=readFileSync(log,'utf8').trim().split('\n').map(JSON.parse).find(x=>x.key===`shinkanavi-outbox-${row.id}`);
 return mail.mail.text.match(/verify=([\w-]+)/)[1];
 }
 const old=latestToken();
 assert.equal((await api('/api/auth/email-verification',1,{})).status,200);
 assert.equal((await api('/api/auth/email-verification/confirm',null,{token:old})).status,400);
 const latest=latestToken();
 db.prepare('UPDATE email_verifications SET expires_at=0 WHERE account_id=1').run();
 assert.equal((await api('/api/auth/email-verification/confirm',null,{token:latest})).status,400);
 assert.equal((await api('/api/auth/email-verification',1,{})).status,200);
 assert.equal((await api('/api/auth/email-verification',1,{})).status,429);
 const finalToken=latestToken();
 assert.equal((await api('/api/auth/email-verification/confirm',null,{token:finalToken})).status,200);
 const first=await api('/api/events/1/applications',1,{message:'Private application message'});assert.equal(first.status,201);const application=await first.json();assert.equal(application.status,'pending');
 assert.equal((await api('/api/events/1/applications',1,{})).status,409);
 const second=await(await api('/api/events/1/applications',2,{})).json();assert.equal(second.status,'waitlisted');
 // An unrelated organization must never see or decide these applications.
 db.prepare('DELETE FROM circle_managers WHERE account_id=4').run();
 assert.deepEqual(await(await api('/api/org/applications',4)).json(),[]);
 assert.equal((await api(`/api/org/applications/${application.id}/decision`,4,{decision:'approve'})).status,404);
 assert.equal((await api(`/api/member/applications/${application.id}/cancel`,1,{})).status,200);
 assert.equal(db.prepare('SELECT status FROM applications WHERE id=?').get(second.id).status,'pending');
 assert.equal((await api(`/api/org/applications/${second.id}/decision`,3,{decision:'approve'})).status,200);
 await until(()=>db.prepare("SELECT count(*) n FROM email_outbox WHERE status IN ('pending','sending') AND recipient<>'retry@example.test'").get().n===0);
 const retry=db.prepare("SELECT * FROM email_outbox WHERE recipient='retry@example.test'").get();assert.equal(retry.status,'pending');assert.equal(retry.attempts,1);assert.ok(Date.parse(retry.next_attempt_at+'Z')>Date.now());
 const mails=(await readFile(log,'utf8')).trim().split('\n').map(JSON.parse);
 assert.ok(mails.some(x=>x.mail.to[0]==='manager@example.test'));
 assert.ok(!mails.some(x=>x.mail.to[0]==='other@example.test'));
 assert.ok(mails.some(x=>x.mail.subject==='体験申込の状況が更新されました'));
 for(const {mail,key} of mails){assert.match(key,/^shinkanavi-outbox-\d+$/);assert.ok(!JSON.stringify(mail).includes('Private Student Name'));assert.ok(!JSON.stringify(mail).includes('Private application message'))}
 assert.ok(db.prepare("SELECT count(*) n FROM email_outbox WHERE status='sent' AND payload_json<>'{}'").get().n===0);
});
