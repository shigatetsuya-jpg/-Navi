import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
async function freePort(){const s=createServer();await new Promise((ok,fail)=>s.once('error',fail).listen(0,'127.0.0.1',ok));const {port}=s.address();await new Promise(ok=>s.close(ok));return port;}
async function waitFor(url,child){for(let i=0;i<80;i++){if(child.exitCode!==null)throw Error('server exited before health check');try{const r=await fetch(url);if(r.ok)return}catch{}await new Promise(r=>setTimeout(r,75))}throw Error('server did not become ready');}

test('public and admin API flow', async t=>{
 const dir=await mkdtemp(join(tmpdir(),'shinkanavi-test-')),port=await freePort(),token='test-only-setup-secret';
 const child=spawn(process.execPath,[join(projectRoot,'server.mjs')],{cwd:projectRoot,env:{...process.env,DB_PATH:join(dir,'app.sqlite'),ADMIN_SETUP_TOKEN:token,PORT:String(port),HOST:'127.0.0.1'},stdio:'ignore'});
 const base=`http://127.0.0.1:${port}`;
 t.after(async()=>{if(child.exitCode===null){child.kill();await new Promise(resolve=>child.once('exit',resolve))}await rm(dir,{recursive:true,force:true})});
 await waitFor(base+'/health',child);
 assert.deepEqual(await (await fetch(base+'/health')).json(),{ok:true});
 assert.equal((await fetch(base+'/api/admin/stats')).status,401);
 const setup=await fetch(base+'/api/admin/setup',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token,email:'admin@example.test',password:'test-password-long-123'})});
 assert.equal(setup.status,201);
 assert.equal((await fetch(base+'/api/admin/setup',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token,email:'second@example.test',password:'test-password-long-123'})})).status,409);
 const login=await fetch(base+'/api/admin/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'admin@example.test',password:'test-password-long-123'})});
 assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0],auth={cookie};
 assert.equal((await fetch(base+'/api/circles')).status,200);
 assert.equal((await fetch(base+'/api/circles')).headers.get('content-type').includes('application/json'),true);
 const circle={contact:'internal@example.test',name:'Test Music Club',university:'Example University',category:'音楽',description:'テスト用レコード',days:'月、水',periods:'2,4',location:'第1キャンパス',frequency:'週1回',cost:'月500円',beginner:1,experienced:0,concurrent:1,official:0,trial:1,verified:1,published:1,trial_url:'https://example.org/trial'};
 const created=await fetch(base+'/api/admin/circles',{method:'POST',headers:{...auth,'content-type':'application/json'},body:JSON.stringify(circle)});assert.equal(created.status,201);const {id}=await created.json();
 assert.equal((await fetch(base+'/api/circles')).status,200);
 const visible=await fetch(base+`/api/circles/${id}`);assert.equal(visible.status,200);assert.equal((await visible.json()).name,circle.name);
 const publicList=await(await fetch(base+'/api/circles')).json();assert.equal(publicList.length,1);assert.equal('contact' in publicList[0],false);
 assert.equal('contact' in await(await fetch(base+`/api/circles/${id}`)).json(),false);
 assert.equal((await(await fetch(base+`/api/circles/${id}`,{headers:auth})).json()).contact,circle.contact);
 const unverified=await fetch(base+'/api/admin/circles',{method:'POST',headers:{...auth,'content-type':'application/json'},body:JSON.stringify({...circle,name:'Unverified',verified:0})});assert.equal(unverified.status,201);const unverifiedId=(await unverified.json()).id;
 assert.equal((await(await fetch(base+'/api/circles')).json()).length,1);
 assert.equal((await fetch(base+`/api/circles/${unverifiedId}`)).status,404);
 assert.equal((await fetch(base+`/circle/${unverifiedId}`)).status,404);
 assert.equal((await fetch(base+`/api/circles/${unverifiedId}`,{headers:auth})).status,200);
 const sitemap=await(await fetch(base+'/sitemap.xml')).text();assert.ok(sitemap.includes('/circle/'+id+'</loc>'));assert.ok(!sitemap.includes('/circle/'+unverifiedId+'</loc>'));
 const filtered=await fetch(base+'/api/circles?category='+encodeURIComponent('音楽')+'&days='+encodeURIComponent('月')+'&periods=2&beginner=1');assert.equal((await filtered.json()).length,1);
 const invalid=await fetch(base+'/api/admin/circles',{method:'POST',headers:{...auth,'content-type':'application/json'},body:JSON.stringify({name:'Invalid',university:'Example',website:'javascript:alert(1)'})});assert.equal(invalid.status,400);
 const hidden=await fetch(base+`/api/admin/circles/${id}`,{method:'PUT',headers:{...auth,'content-type':'application/json'},body:JSON.stringify({...circle,published:0})});assert.equal(hidden.status,200);assert.equal((await fetch(base+`/api/circles/${id}`)).status,404);
 const published=await fetch(base+`/api/admin/circles/${id}`,{method:'PUT',headers:{...auth,'content-type':'application/json'},body:JSON.stringify(circle)});assert.equal(published.status,200);
 const batch=await fetch(base+'/api/admin/import',{method:'POST',headers:{...auth,'content-type':'application/json'},body:JSON.stringify({mode:'insert',rows:[{name:'Batch Club',university:'Example University',published:0},{name:'Batch Club',university:'Example University',published:0}]})});const result=await batch.json();assert.equal(result.added,1);assert.equal(result.failed.length,1);
 const badImport=await fetch(base+'/api/admin/import',{method:'POST',headers:{...auth,'content-type':'application/json'},body:JSON.stringify({mode:'insert',rows:[{name:'Missing University'}]})});assert.equal((await badImport.json()).failed.length,1);
 const exported=await fetch(base+'/api/admin/export',{headers:auth});assert.equal(exported.status,200);assert.match(await exported.text(),/^name,university,campus/);
 assert.equal((await fetch(base+'/style.css')).status,200);assert.equal((await fetch(base+'/admin.html')).status,200);
 const appJs=await (await fetch(base+'/app.js')).text(),adminJs=await (await fetch(base+'/admin.js')).text();for(const campus of ['早稲田','西早稲田','所沢','戸山']){assert.ok(appJs.includes(campus));assert.ok(adminJs.includes(campus))}assert.ok(adminJs.includes("university:'早稲田大学'"));
 const statsDb=new DatabaseSync(join(dir,'app.sqlite'));statsDb.exec('PRAGMA busy_timeout=5000');
 try{
 statsDb.exec(`INSERT INTO accounts(id,email,display_name,account_type,salt,password_hash) VALUES(1,'metric-student@example.test','Test','member','s','h'),(2,'metric-org@example.test','Test','organization','s','h');
 INSERT INTO circle_managers(circle_id,account_id) VALUES(${id},2);
 INSERT INTO events(id,circle_id,title,capacity,status,starts_at) VALUES(1,${id},'Future',10,'open','2099-04-01T00:00:00Z'),(2,${id},'Past',10,'open','2000-01-01T00:00:00Z');
 INSERT INTO applications(event_id,member_id,status) VALUES(1,1,'approved'),(2,1,'cancelled');`);
 const metrics=await(await fetch(base+'/api/admin/stats',{headers:auth})).json();
 assert.equal(metrics.verified_public,1);assert.equal(metrics.members,1);assert.equal(metrics.organizations,1);assert.equal(metrics.active_organizations_30d,1);assert.equal(metrics.applicants_30d,1);assert.equal(metrics.applications_30d,2);assert.equal(metrics.approved_applications_30d,1);assert.equal(metrics.open_events,1);
 assert.ok(!JSON.stringify(metrics).includes('@'));assert.ok(!Number.isNaN(Date.parse(metrics.measured_at)));
 }finally{statsDb.close()}
 const logout=await fetch(base+'/api/admin/logout',{method:'POST',headers:auth});assert.equal(logout.status,200);assert.equal((await fetch(base+'/api/admin/stats',{headers:auth})).status,401);
});
