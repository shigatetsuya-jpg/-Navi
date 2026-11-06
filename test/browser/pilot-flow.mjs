// Run with PLAYWRIGHT_MODULE_PATH pointing at a Playwright package if it isn't installed locally.
import { spawn } from 'node:child_process';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';
import { backupDatabase } from '../../scripts/backup-db.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const root=new URL('../../',import.meta.url),dir=await mkdtemp(join(tmpdir(),'navi-pilot-'));
const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
const base=`http://127.0.0.1:${port}`,password='pilot-test-password-123';
const child=spawn(process.execPath,[new URL('server.mjs',root).pathname],{cwd:root,env:{...process.env,DB_PATH:join(dir,'db.sqlite'),PORT:String(port),HOST:'127.0.0.1',ADMIN_SETUP_TOKEN:'local-test-only',RESEND_API_KEY:'',EMAIL_FROM:''},stdio:'ignore'});
let browser,restored;
try{
 let ready=false;for(let i=0;i<150;i++){if(child.exitCode!==null)throw Error('server exited');try{if((await fetch(base+'/health')).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,25))}assert.ok(ready);
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox']});
 const adminContext=await browser.newContext(),orgContext=await browser.newContext(),studentContext=await browser.newContext({viewport:{width:390,height:844}});
 const admin=await adminContext.newPage(),org=await orgContext.newPage(),student=await studentContext.newPage();const errors=[];for(const p of [admin,org,student])p.on('pageerror',e=>errors.push(e.message));
 // Initial setup and authenticated admin login through the actual forms.
 await admin.goto(base+'/admin.html');await admin.locator('#setup-label').waitFor({state:'visible'});
 await admin.locator('#setup-token').fill('local-test-only');await admin.locator('#email').fill('admin@example.test');await admin.locator('#password').fill(password);await admin.locator('#auth-submit').click();await admin.locator('#setup-label').waitFor({state:'hidden'});await admin.locator('#auth-submit').click();await admin.locator('#dashboard').waitFor({state:'visible'});
 // Independent organization account and application.
 await org.goto(base+'/account.html?type=organization');const register=org.locator('#register-form');
 for(const [name,value] of Object.entries({display_name:'試用担当',email:'org@example.test',password,organization_name:'試用音楽サークル',organization_university:'テスト大学',category:'音楽',description:'ローカル試用用の合成データ'}))await register.locator(`[name=${name}]`).fill(value);
 await register.locator('[name=campus]').selectOption({label:'早稲田'});await register.locator('button').click();await org.waitForURL('**/dashboard.html');await org.locator('#org-dashboard').waitFor({state:'visible'});assert.match(await org.locator('#org-status').innerText(),/確認待ち/);
 // Organization prepares a draft before approval.
 const event=org.locator('#event-form');await event.locator('[name=title]').fill('試用体験会');await event.locator('[name=capacity]').fill('3');await event.locator('[name=starts_at]').fill('2099-04-01T13:00');await event.locator('[name=location]').fill('テスト教室');await event.locator('button').click();await org.locator('#org-events article').waitFor();assert.match(await org.locator('#org-events').innerText(),/下書き/);
 await admin.reload();admin.on('dialog',d=>d.accept());await admin.locator('[data-org-review=approve]').click();await admin.waitForFunction(()=>document.querySelector('#notice').textContent.includes('団体を公開'));
 await org.reload();await org.locator('[data-event-status]').selectOption('open');await org.locator('[data-save-event]').click();await org.waitForFunction(()=>document.querySelector('#notice').textContent.includes('受付状態を更新'));
 // Guest discovery -> individual registration -> application -> organization decision.
 await student.goto(base+'/');await student.locator('[data-detail]').first().click();await student.locator('[data-event-apply]').click();await student.waitForURL('**/account.html?event=*');
 const personal=student.locator('#register-form');for(const [name,value] of Object.entries({display_name:'試用学生',email:'student@example.test',password,university:'テスト大学',school_year:'1年'}))await personal.locator(`[name=${name}]`).fill(value);
 await personal.locator('button').click();await student.waitForURL('**/dashboard.html');await student.locator('#member-applications article').waitFor();assert.match(await student.locator('#member-applications').innerText(),/確認中/);
 await org.reload();await org.locator('[data-decision=approve]').click();await org.waitForFunction(()=>document.querySelector('#notice').textContent.includes('承認しました'));
 await student.reload();await student.waitForFunction(()=>document.querySelector('#member-applications').textContent.includes('参加承認'));await student.locator('[data-cancel]').click();await student.waitForFunction(()=>document.querySelector('#member-applications').textContent.includes('キャンセル済み'));
 await admin.reload();await admin.waitForFunction(()=>document.querySelector('#stats').textContent.includes('直近30日の申込者'));assert.ok(!await admin.locator('#stats').innerText().then(t=>t.includes('undefined')));
 // Start a separate app from a native SQLite backup and check preserved sessions/data.
 const snapshot=join(dir,'restored.sqlite');await backupDatabase(join(dir,'db.sqlite'),snapshot);
 const restoreSocket=createServer();await new Promise(r=>restoreSocket.listen(0,'127.0.0.1',r));const restorePort=restoreSocket.address().port;await new Promise(r=>restoreSocket.close(r));
 restored=spawn(process.execPath,[new URL('server.mjs',root).pathname],{cwd:root,env:{...process.env,DB_PATH:snapshot,PORT:String(restorePort),HOST:'127.0.0.1',RESEND_API_KEY:'',EMAIL_FROM:''},stdio:'ignore'});
 const restoredBase=`http://127.0.0.1:${restorePort}`;let restoreReady=false;
 for(let i=0;i<100;i++){try{if((await fetch(restoredBase+'/health')).ok){restoreReady=true;break}}catch{}await new Promise(r=>setTimeout(r,25))}assert.ok(restoreReady);
 const adminCookies=(await adminContext.cookies()).map(c=>c.name+'='+c.value).join('; ');
 const restoredStats=await(await fetch(restoredBase+'/api/admin/stats',{headers:{cookie:adminCookies}})).json();assert.equal(restoredStats.verified_public,1);assert.equal(restoredStats.members,1);assert.equal(restoredStats.applicants_30d,1);
 const studentCookies=(await studentContext.cookies()).map(c=>c.name+'='+c.value).join('; ');
 const restoredApplications=await(await fetch(restoredBase+'/api/member/applications',{headers:{cookie:studentCookies}})).json();assert.equal(restoredApplications.length,1);assert.equal(restoredApplications[0].status,'cancelled');
 assert.deepEqual(errors,[]);console.log('PASS: admin setup/login, organization registration/draft/approval/open event, guest discovery, student registration/application, organization approval, student cancellation, operating metrics and application restart from SQLite backup. Separate browser sessions; no real email or production changes.');
}finally{await browser?.close();if(restored&&restored.exitCode===null){restored.kill();await new Promise(r=>restored.once('exit',r))}if(child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r))}await rm(dir,{recursive:true,force:true})}
