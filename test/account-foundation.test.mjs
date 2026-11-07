import test from 'node:test';import assert from 'node:assert/strict';import{spawn}from'node:child_process';import{mkdtemp,rm,readFile}from'node:fs/promises';import{tmpdir}from'node:os';import{join}from'node:path';import{createServer}from'node:net';import{DatabaseSync}from'node:sqlite';import{wasedaEmail,circleKey}from'../scripts/account-foundation.mjs';
const root=new URL('../',import.meta.url),password='test-password-long-123';
test('school-domain matching excludes lookalikes and normalization catches Japanese widths',()=>{assert.equal(wasedaEmail('a@akane.waseda.jp'),true);assert.equal(wasedaEmail('a@waseda.jp'),true);for(const mail of ['a@notwaseda.jp','a@waseda.jp.evil.test','a@@waseda.jp'])assert.equal(wasedaEmail(mail),false);assert.equal(circleKey('ＡＢＣ　音楽会'),circleKey('abc 音楽会'))});
test('consent, verification, reset, circle ownership, retirement and support boundaries',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'wase-foundation-')),path=join(dir,'db.sqlite'),log=join(dir,'mails.jsonl');const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const child=spawn(process.execPath,['--import',new URL('test/fixtures/mail-transport.mjs',root).pathname,new URL('server.mjs',root).pathname],{cwd:root,env:{...process.env,DB_PATH:path,PORT:String(port),HOST:'127.0.0.1',ADMIN_SETUP_TOKEN:'test-only',EMAIL_DELIVERY_DISABLED:'0',RESEND_API_KEY:'test-only',EMAIL_FROM:'test@example.test',TEST_MAIL_LOG:log},stdio:'ignore'});let db;
 t.after(async()=>{if(child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r))}db?.close();await rm(dir,{recursive:true,force:true})});const base=`http://127.0.0.1:${port}`;
 async function api(route,cookie,body,method=body===undefined?'GET':'POST',extra={}){return fetch(base+route,{method,headers:{'content-type':'application/json',...(cookie?{cookie}:{}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})})}
 let ready=false;for(let i=0;i<100;i++){try{if((await api('/health')).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,25))}assert.ok(ready);db=new DatabaseSync(path);db.exec('PRAGMA busy_timeout=5000');
 async function token(email,kind){const row=db.prepare('SELECT id,payload_json FROM email_outbox WHERE recipient=? AND kind=? ORDER BY id DESC LIMIT 1').get(email,kind);const payload=JSON.parse(row.payload_json);if(payload.token)return payload.token;const sent=(await readFile(log,'utf8')).trim().split('\n').map(JSON.parse).find(x=>x.key===`shinkanavi-outbox-${row.id}`);return sent.mail.text.match(/[?](?:verify|reset)=([-\w]+)/)[1]}
 async function register(email){const r=await api('/api/auth/register',null,{account_type:'member',display_name:'Test',email,password,university:'University',school_year:'1',accept_terms:true,accept_privacy:true});assert.equal(r.status,201);return {email,cookie:r.headers.get('set-cookie').split(';')[0],account:(await r.json()).account}}
 assert.equal((await api('/api/favorites')).status,401);assert.equal((await api('/api/admin/support')).status,401);
 assert.equal((await api('/api/auth/register',null,{account_type:'member',display_name:'Test',email:'no-consent@example.test',password})).status,400);
 const owner=await register('owner@akane.waseda.jp');assert.equal(owner.account.waseda_verified,false);assert.equal((await api('/api/favorites',owner.cookie)).status,403);
 assert.equal((await api('/api/auth/email-verification/confirm',null,{token:await token(owner.email,'email-verification')})).status,200);
 assert.equal((await(await api('/api/auth/me',owner.cookie)).json()).account.waseda_verified,true);
 const target=await register('next@example.test'),other=await register('other@example.test');for(const a of [target,other])assert.equal((await api('/api/auth/email-verification/confirm',null,{token:await token(a.email,'email-verification')})).status,200);
 assert.equal(db.prepare('SELECT count(*) n FROM consent_records').get().n,3);
 const circle={name:'ＡＢＣ 音楽会',university:'University',campus:'早稲田',category:'音楽',description:'活動紹介',cost:'年6000円',accept_terms:true,accept_privacy:true};const created=await api('/api/circle-registrations',owner.cookie,circle);assert.equal(created.status,201);const id=(await created.json()).id;
 assert.equal((await api('/api/circle-registrations',target.cookie,{...circle,name:'abc音楽会'})).status,409);
 assert.equal((await api('/api/managed-circles/'+id,other.cookie,{description:'hijack'},'PATCH')).status,404);
 await api('/api/admin/setup',null,{token:'test-only',email:'admin@example.test',password});const login=await api('/api/admin/login',null,{email:'admin@example.test',password});const admin=login.headers.get('set-cookie').split(';')[0];
 assert.equal((await api(`/api/admin/organizations/${id}/decision`,admin,{decision:'approve'})).status,200);
 assert.equal((await api('/api/favorites',owner.cookie,{ids:[id]},'PUT')).status,200);assert.deepEqual(await(await api('/api/favorites',owner.cookie)).json(),[id]);
 assert.equal((await api('/api/account',owner.cookie,{password},'DELETE')).status,409);
 assert.equal((await api(`/api/managed-circles/${id}/managers`,other.cookie,{email:target.email,password})).status,404);
 assert.equal((await api(`/api/managed-circles/${id}/managers`,owner.cookie,{email:target.email,password})).status,200);
 assert.equal((await api(`/api/managed-circles/${id}/transfer`,owner.cookie,{email:target.email,password})).status,200);
 assert.equal((await api(`/api/managed-circles/${id}/managers`,owner.cookie,{email:other.email,password})).status,403);
 assert.equal((await api(`/api/managed-circles/${id}`,target.cookie,{...circle,description:'新しい紹介'},'PATCH')).status,200);assert.equal((await api('/api/circles/'+id)).status,404);
 assert.equal((await api(`/api/admin/organizations/${id}/decision`,admin,{decision:'approve'})).status,200);
 assert.equal((await api(`/api/circles/${id}/access-requests`,other.cookie,{reason:'現担当者と運営を引き継ぎたい',accept_terms:true,accept_privacy:true})).status,201);
 const requests=await(await api('/api/admin/circle-access',admin)).json();assert.equal(requests.length,1);assert.equal((await api('/api/admin/circle-access/'+requests[0].id,admin,{decision:'approve'})).status,200);
 assert.equal((await api(`/api/managed-circles/${id}/managers`,other.cookie)).status,403);
 assert.equal((await api('/api/support',null,{email:'reply@example.test',kind:'correction',circle_id:id,message:'日程の情報を訂正してください。',accept_privacy:true})).status,201);const inbox=await(await api('/api/admin/support',admin)).json();assert.equal(inbox.length,1);assert.ok(!JSON.stringify(await(await api('/api/circles')).json()).includes('reply@example.test'));
 assert.equal((await api('/api/favorites',target.cookie,{ids:[]},'PUT',{origin:'https://evil.example'})).status,403);
 assert.equal((await api('/api/favorites',target.cookie,{ids:[]},'PUT',{'sec-fetch-site':'cross-site'})).status,403);
 const reset=await api('/api/auth/password-reset',null,{email:target.email});assert.equal(reset.status,200);const resetToken=await token(target.email,'password-reset');
 const unknown=await api('/api/auth/password-reset',null,{email:'unknown@example.test'});assert.deepEqual(await unknown.json(),await reset.json());
 db.prepare('UPDATE password_resets SET expires_at=0 WHERE account_id=?').run(target.account.id);assert.equal((await api('/api/auth/password-reset/confirm',null,{token:resetToken,password})).status,400);
 await api('/api/auth/password-reset',null,{email:target.email});const superseded=await token(target.email,'password-reset');await api('/api/auth/password-reset',null,{email:target.email});const latest=await token(target.email,'password-reset');assert.equal((await api('/api/auth/password-reset/confirm',null,{token:superseded,password})).status,400);
 assert.equal((await api('/api/auth/password-reset/confirm',null,{token:latest,password:'new-test-password-123'})).status,200);assert.equal((await(await api('/api/auth/me',target.cookie)).json()).account,null);
 assert.equal((await api('/api/auth/password-reset/confirm',null,{token:latest,password})).status,400);
 await api('/api/auth/password-reset',null,{email:'unknown@example.test'});assert.equal((await api('/api/auth/password-reset',null,{email:'unknown@example.test'})).status,429);
 assert.equal((await api('/api/auth/login',null,{email:target.email,password})).status,401);
 assert.equal((await api('/api/auth/login',null,{email:target.email,password:'new-test-password-123'})).status,200);
 const eventId=Number(db.prepare("INSERT INTO events(circle_id,title,capacity,status) VALUES(?,'削除時の繰上げ',1,'open')").run(id).lastInsertRowid);db.prepare("INSERT INTO applications(event_id,member_id,status) VALUES(?,?,'approved'),(?,?,'waitlisted')").run(eventId,owner.account.id,eventId,other.account.id);
 assert.equal((await api('/api/account',owner.cookie,{password},'DELETE')).status,200);assert.equal(db.prepare('SELECT count(*) n FROM accounts WHERE id=?').get(owner.account.id).n,0);assert.equal(db.prepare('SELECT count(*) n FROM consent_records WHERE account_id=?').get(owner.account.id).n,0);assert.equal(db.prepare('SELECT count(*) n FROM email_outbox WHERE recipient=?').get(owner.email).n,0);
 assert.equal(db.prepare('SELECT status FROM applications WHERE event_id=? AND member_id=?').get(eventId,other.account.id).status,'pending');assert.equal(db.prepare('SELECT count(*) n FROM applications WHERE member_id=?').get(owner.account.id).n,0);
 const unverified=await register('unverified@example.test');assert.equal((await api('/api/account',unverified.cookie,{password},'DELETE')).status,200);
 for(const page of ['terms','privacy','contact','operator','disclaimer','settings']){const r=await api('/'+page+'.html');assert.equal(r.status,200);const html=await r.text();assert.ok(html.includes('/footer.js'));assert.ok(!html.includes('shiga.tetsuya@'))}
});
