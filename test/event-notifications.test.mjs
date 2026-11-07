import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {scryptSync} from 'node:crypto';
import {queueEventNotifications,currentEventNotification} from '../scripts/event-notifications.mjs';
import {renderNotificationEmail} from '../scripts/render-email.mjs';
const root=new URL('../',import.meta.url),now=Date.parse('2027-04-01T00:00:00Z'),iso=value=>new Date(value).toISOString();
async function database(path=':memory:',version=6){const db=new DatabaseSync(path);db.exec('PRAGMA foreign_keys=ON;PRAGMA busy_timeout=5000;CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);');for(let i=1;i<=version;i++){const names=['init','accounts-events','email-outbox','email-verification','production-foundation','event-notifications'];db.exec(await readFile(new URL(`migrations/00${i}-${names[i-1]}.sql`,root),'utf8'));db.prepare('INSERT INTO schema_migrations(version) VALUES(?)').run(i)}return db}
function seed(db){
 db.exec("INSERT INTO accounts(id,email,display_name,account_type,salt,password_hash,email_verified) VALUES(1,'reader@example.test','Reader','member','x','x',1),(2,'other@example.test','Other','member','x','x',1),(3,'unverified@example.test','Unverified','member','x','x',0); INSERT INTO circles(id,name,university,published,verified) VALUES(1,'音楽会','テスト大学',1,1);");
 db.prepare("INSERT INTO events(id,circle_id,title,status,capacity,first_published_at,starts_at,application_deadline) VALUES(1,1,'春の体験会','open',30,?,?,?)").run(iso(now),iso(now+72*3600000),iso(now+48*3600000));
 for(const id of [1,2,3]){db.prepare('INSERT INTO circle_notification_subscriptions VALUES(?,1,1,?,?,?)').run(id,iso(now-3600000),iso(now),'test');db.prepare('INSERT INTO event_reminders VALUES(?,1,1,1,?,?,?)').run(id,iso(now-3600000),iso(now),'test')}
}
test('event queues persist once-only keys, respect each choice and never subscribe favorites implicitly',async()=>{
 const db=await database();try{
 seed(db);assert.equal(queueEventNotifications(db,{now}),2);assert.equal(queueEventNotifications(db,{now:now+3600000}),0);assert.equal(db.prepare('SELECT count(*) n FROM event_notification_deliveries').get().n,2);
 assert.equal(queueEventNotifications(db,{now:now+24*3600000}),2);assert.equal(queueEventNotifications(db,{now:now+48*3600000}),2);assert.equal(queueEventNotifications(db,{now:now+72*3600000}),0);
 assert.equal(db.prepare('SELECT count(*) n FROM event_notification_deliveries WHERE account_id=3').get().n,0);
 db.exec("INSERT INTO accounts(id,email,display_name,account_type,salt,password_hash,email_verified) VALUES(4,'favorite@example.test','Favorite','member','x','x',1);INSERT INTO favorites VALUES(4,1)");assert.equal(queueEventNotifications(db,{now}),0);
 db.prepare('UPDATE circle_notification_subscriptions SET followed_at=? WHERE account_id=2').run(iso(now+1000));const row=db.prepare("SELECT * FROM email_outbox WHERE recipient='other@example.test' AND kind='new-event'").get();assert.equal(currentEventNotification(db,row,now+2000),null);
 }finally{db.close()}
});
test('delivery checks opt-out, latest content, verified address, visibility, dates, and deletion again',async()=>{
 const db=await database();try{
 seed(db);queueEventNotifications(db,{now});const row=db.prepare("SELECT * FROM email_outbox WHERE recipient='reader@example.test'").get();assert.ok(currentEventNotification(db,row,now));
 db.exec("UPDATE events SET title='更新された体験会'");assert.equal(currentEventNotification(db,row,now).eventTitle,'更新された体験会');
 db.exec('UPDATE circle_notification_subscriptions SET new_events=0 WHERE account_id=1');assert.equal(currentEventNotification(db,row,now),null);db.exec('UPDATE circle_notification_subscriptions SET new_events=1 WHERE account_id=1');
 db.exec('UPDATE circles SET published=0');assert.equal(currentEventNotification(db,row,now),null);db.exec('UPDATE circles SET published=1');
 db.exec('UPDATE accounts SET email_verified=0 WHERE id=1');assert.equal(currentEventNotification(db,row,now),null);db.exec("UPDATE accounts SET email_verified=1,email='changed@example.test' WHERE id=1");assert.equal(currentEventNotification(db,row,now),null);
 db.exec("UPDATE accounts SET email='reader@example.test' WHERE id=1");assert.equal(currentEventNotification(db,row,now+24*3600000),null);
 db.exec('DELETE FROM accounts WHERE id=1');assert.equal(currentEventNotification(db,row,now),null);assert.equal(db.prepare('SELECT count(*) n FROM event_reminders WHERE account_id=1').get().n,0);
 }finally{db.close()}
});
test('queue and marker roll back together, then retry without losing notifications',async()=>{
 const db=await database();try{seed(db);db.exec("CREATE TRIGGER fail_delivery BEFORE INSERT ON event_notification_deliveries BEGIN SELECT RAISE(ABORT,'test failure'); END");assert.throws(()=>queueEventNotifications(db,{now}),/test failure/);assert.equal(db.prepare('SELECT count(*) n FROM email_outbox').get().n,0);db.exec('DROP TRIGGER fail_delivery');assert.equal(queueEventNotifications(db,{now}),2)}finally{db.close()}
});
test('reminder templates explain external form boundary, include settings, escape HTML and use Japan time',()=>{
 const result=renderNotificationEmail({kind:'start-reminder',recipient:'reader@example.test',payload_json:JSON.stringify({circleName:'<script>',eventTitle:'<img>',circleId:1,startsAt:'2027-04-01T00:00:00Z',deadline:'2027-03-31T00:00:00Z'})},{from:'test@example.test',origin:'https://example.test'});
 assert.match(result.text,/9:00/);assert.match(result.text,/申込完了・参加予約を示す通知ではありません/);assert.match(result.text,/notifications.html/);assert.ok(!result.html.includes('<script>'));assert.match(result.html,/&lt;script&gt;/);
});
test('HTTP notification settings require verified ownership, preserve consent time, and cancel queued mail',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'wase-subscriptions-')),path=join(dir,'db.sqlite');
 const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const child=spawn(process.execPath,[new URL('server.mjs',root).pathname],{cwd:root,env:{...process.env,DB_PATH:path,PORT:String(port),HOST:'127.0.0.1',EMAIL_DELIVERY_DISABLED:'1'},stdio:'ignore'});let db;
 t.after(async()=>{if(child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r))}db?.close();await rm(dir,{recursive:true,force:true})});
 const base='http://127.0.0.1:'+port;let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/health')).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,25))}assert.ok(ready);
 db=new DatabaseSync(path);db.exec('PRAGMA busy_timeout=5000;PRAGMA foreign_keys=ON');seed(db);db.prepare('UPDATE circle_notification_subscriptions SET followed_at=?').run(iso(Date.now()-86400000));db.prepare('UPDATE event_reminders SET followed_at=?').run(iso(Date.now()-86400000));
 const password='long-password-test-123',salt='test-salt';db.prepare('UPDATE accounts SET salt=?,password_hash=?').run(salt,scryptSync(password,salt,64).toString('hex'));
 async function api(path,cookie,body,method=body===undefined?'GET':'PUT'){return fetch(base+path,{method,headers:{'content-type':'application/json',...(cookie?{cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})})}
 async function login(email){const response=await api('/api/auth/login',null,{email,password},'POST');assert.equal(response.status,200);return response.headers.get('set-cookie').split(';')[0]}
 const one=await login('reader@example.test'),two=await login('other@example.test'),unverified=await login('unverified@example.test');
 assert.equal((await api('/api/notifications')).status,401);assert.equal((await api('/api/notifications',unverified)).status,403);
 assert.equal((await api('/api/notifications/circles/1',one,{new_events:'true'})).status,400);
 assert.equal((await api('/api/notifications/circles/1',one,{new_events:true})).status,200);
 // Explicit saves of an already enabled choice must not move the follow cutoff.
 const followed=db.prepare('SELECT followed_at FROM circle_notification_subscriptions WHERE account_id=1').get().followed_at;await api('/api/notifications/circles/1',one,{new_events:true});assert.equal(db.prepare('SELECT followed_at FROM circle_notification_subscriptions WHERE account_id=1').get().followed_at,followed);
 assert.equal((await api('/api/notifications/events/1',one,{start_reminders:true,deadline_reminders:true})).status,200);
 db.prepare('UPDATE events SET first_published_at=?').run(iso(Date.now()));queueEventNotifications(db);assert.equal(db.prepare("SELECT count(*) n FROM email_outbox WHERE recipient='reader@example.test'").get().n,1);
 assert.equal((await api('/api/notifications/circles/1',one,{new_events:false})).status,200);assert.equal(db.prepare("SELECT status FROM email_outbox WHERE recipient='reader@example.test'").get().status,'failed');
 const own=await(await api('/api/notifications',one)).json();assert.equal(own.email_delivery_available,false);assert.equal(own.circle_subscriptions.length,0);assert.equal(own.event_reminders.length,1);assert.equal((await(await api('/api/notifications',two)).json()).circle_subscriptions.length,1);
 db.prepare('UPDATE events SET application_deadline=?').run(iso(Date.now()-1000));const afterDeadline=await(await api('/api/notifications/events?circle=1',one)).json();assert.equal(afterDeadline.length,1);assert.equal((await api('/api/notifications/events/1',one,{start_reminders:true,deadline_reminders:false})).status,200);assert.equal((await api('/api/notifications/events/1',one,{start_reminders:true,deadline_reminders:true})).status,400);const page=await(await api('/circle/1')).text();assert.ok(page.includes('申込締切済み'));assert.ok(page.includes('id="event-1"'));
 db.exec('UPDATE circles SET published=0');assert.equal((await api('/api/notifications/circles/1',one,{new_events:true})).status,404);assert.equal((await api('/api/notifications/events/1',one,{start_reminders:false,deadline_reminders:false})).status,200);
 assert.equal((await api('/api/notifications',two,{},'DELETE')).status,200);assert.equal((await(await api('/api/notifications',two)).json()).circle_subscriptions.length,0);
 assert.equal((await api('/api/notifications',one,{},'DELETE')).status,200);assert.equal((await(await api('/api/notifications',one)).json()).event_reminders.length,0);
});
test('automatic job sends a newly published event once through the fake provider and preserves dedupe after restart',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'wase-event-job-')),path=join(dir,'db.sqlite'),log=join(dir,'mails.jsonl');
 const db=await database(path);seed(db);const publishedAfter=Date.now()-86400000;
 db.prepare('UPDATE circle_notification_subscriptions SET followed_at=?').run(iso(publishedAfter));db.prepare("UPDATE events SET status='draft',first_published_at=NULL,starts_at=?,application_deadline=?").run(iso(Date.now()+72*3600000),iso(Date.now()+48*3600000));
 db.exec("INSERT INTO circle_managers(circle_id,account_id,manager_role) VALUES(1,1,'owner')");
 const password='integration-password-123',salt='integration-salt';db.prepare('UPDATE accounts SET salt=?,password_hash=? WHERE id=1').run(salt,scryptSync(password,salt,64).toString('hex'));
 const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));let child;
 const base='http://127.0.0.1:'+port;
 async function stop(){if(child?.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r))}}
 t.after(async()=>{await stop();db.close();await rm(dir,{recursive:true,force:true})});
 async function start(){child=spawn(process.execPath,['--import',new URL('test/fixtures/mail-transport.mjs',root).pathname,new URL('server.mjs',root).pathname],{cwd:root,env:{...process.env,DB_PATH:path,PORT:String(port),HOST:'127.0.0.1',EMAIL_DELIVERY_DISABLED:'0',RESEND_API_KEY:'test-only',EMAIL_FROM:'test@example.test',TEST_MAIL_LOG:log},stdio:'ignore'});for(let i=0;i<100;i++){try{if((await fetch(base+'/health')).ok)return}catch{}await new Promise(r=>setTimeout(r,25))}throw Error('server not ready')}
 await start();const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'reader@example.test',password})});const cookie=login.headers.get('set-cookie').split(';')[0];
 const event=db.prepare('SELECT * FROM events WHERE id=1').get();const opened=await fetch(base+'/api/org/events/1',{method:'PATCH',headers:{'content-type':'application/json',cookie},body:JSON.stringify({...event,status:'open'})});assert.equal(opened.status,200);const first=db.prepare('SELECT first_published_at FROM events').get().first_published_at;assert.ok(Date.parse(first)>publishedAfter);
 let mails=[];for(let i=0;i<100;i++){try{mails=(await readFile(log,'utf8')).trim().split('\n').map(JSON.parse);if(mails.length===2)break}catch{}await new Promise(r=>setTimeout(r,25))}assert.equal(mails.length,2);assert.ok(mails.every(r=>r.mail.subject.includes('新しいイベント')));
 // Closing/reopening does not reset first publication or duplicate the notice.
 for(const status of ['closed','open']){const response=await fetch(base+'/api/org/events/1',{method:'PATCH',headers:{'content-type':'application/json',cookie},body:JSON.stringify({...event,status})});assert.equal(response.status,200)}assert.equal(db.prepare('SELECT first_published_at FROM events').get().first_published_at,first);
 await stop();await start();await new Promise(r=>setTimeout(r,150));const restarted=(await readFile(log,'utf8')).trim().split('\n');assert.equal(restarted.length,2);assert.equal(db.prepare('SELECT count(*) n FROM event_notification_deliveries').get().n,2);
});

test('version 6 preserves existing queued mail and events, and never reuses a deleted outbox id',async()=>{
 const db=await database(':memory:',5);try{
  db.exec("INSERT INTO circles(id,name,university,published,verified) VALUES(1,'既存団体','テスト大学',1,1);INSERT INTO events(id,circle_id,title,status,capacity) VALUES(1,1,'既存イベント','open',20);INSERT INTO email_outbox(recipient,kind,payload_json) VALUES('existing@example.test','password-reset','{}')");
  const before=db.prepare('SELECT * FROM email_outbox').get();db.exec(await readFile(new URL('migrations/006-event-notifications.sql',root),'utf8'));assert.deepEqual(db.prepare('SELECT * FROM email_outbox').get(),before);assert.ok(Number.isFinite(Date.parse(db.prepare('SELECT first_published_at FROM events').get().first_published_at)));assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  db.exec('DELETE FROM email_outbox');const inserted=db.prepare("INSERT INTO email_outbox(recipient,kind,payload_json) VALUES('new@example.test','new-event','{}')").run();assert.ok(Number(inserted.lastInsertRowid)>before.id);
 }finally{db.close()}
});
