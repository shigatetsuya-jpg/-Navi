import {spawn} from 'node:child_process';
import {mkdtemp,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {DatabaseSync} from 'node:sqlite';
import {scryptSync} from 'node:crypto';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const root=new URL('../../',import.meta.url),dir=await mkdtemp(join(tmpdir(),'wase-notify-ui-'));
const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
const base='http://127.0.0.1:'+port,password='test-browser-password-123';
const child=spawn(process.execPath,[new URL('server.mjs',root).pathname],{cwd:root,env:{...process.env,DB_PATH:join(dir,'db.sqlite'),PORT:String(port),HOST:'127.0.0.1',EMAIL_DELIVERY_DISABLED:'1'},stdio:'ignore'});let browser,db;
try{
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/health')).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,25))}assert.ok(ready);
 db=new DatabaseSync(join(dir,'db.sqlite'));db.exec('PRAGMA busy_timeout=5000');const salt='test';
 db.prepare("INSERT INTO accounts(id,email,display_name,account_type,salt,password_hash,email_verified) VALUES(1,'reader@example.test','Test','member',?,?,1)").run(salt,scryptSync(password,salt,64).toString('hex'));
 db.exec("INSERT INTO circles(id,name,university,published,verified) VALUES(1,'音楽テスト団体','テスト大学',1,1)");
 db.prepare("INSERT INTO events(id,circle_id,title,status,capacity,starts_at,application_deadline,first_published_at) VALUES(1,1,'春の体験会','open',30,?,?,?)").run(new Date(Date.now()+72*3600000).toISOString(),new Date(Date.now()+48*3600000).toISOString(),new Date().toISOString());
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox'],headless:true});
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/notifications.html');await page.getByRole('link',{name:'会員登録・ログイン・メール確認'}).waitFor();assert.ok(!await page.locator('#notification-settings').isVisible());
  assert.equal((await page.request.post(base+'/api/auth/login',{data:{email:'reader@example.test',password}})).status(),200);
  await page.goto(base+'/notifications.html?circle=1&event=1');await page.waitForFunction(()=>document.querySelector('#notification-event').value==='1');assert.match(await page.locator('#delivery-status').innerText(),/準備中/);assert.ok(!await page.locator('#new-events').isChecked());assert.ok(!await page.locator('#start-reminders').isChecked());
  await page.locator('#new-events').check();await page.locator('#circle-notification-form button').click();await page.waitForFunction(()=>document.querySelector('#active-notifications').textContent.includes('新イベント'));
  await page.locator('#start-reminders').check();await page.locator('#deadline-reminders').check();await page.locator('#event-notification-form button').click();await page.waitForFunction(()=>document.querySelector('#active-notifications').textContent.includes('開催前 締切前'));
  await page.reload();await page.waitForFunction(()=>document.querySelector('#notification-event').value==='1');assert.ok(await page.locator('#new-events').isChecked());assert.ok(await page.locator('#start-reminders').isChecked());assert.ok(await page.locator('#deadline-reminders').isChecked());
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(width===390){await mkdir('/workspace/artifacts',{recursive:true});await page.screenshot({path:'/workspace/artifacts/event-notifications-mobile.png',fullPage:true})}
  await page.locator('[data-stop-circle="1"]').click();await page.waitForFunction(()=>!document.querySelector('[data-stop-circle]'));assert.ok(await page.locator('[data-stop-event="1"]').isVisible());
  // A hidden club/event must still be easy to unsubscribe from.
  db.exec('UPDATE circles SET published=0');await page.reload();await page.locator('[data-stop-event="1"]').waitFor();await page.locator('[data-stop-event="1"]').click();await page.waitForFunction(()=>document.querySelector('#active-notifications').textContent.includes('設定はありません'));db.exec('UPDATE circles SET published=1');
  await page.goto(base+'/notifications.html?circle=1&event=1');await page.waitForFunction(()=>document.querySelector('#notification-event').value==='1');await page.locator('#new-events').check();await page.locator('#circle-notification-form button').click();await page.locator('[data-stop-circle="1"]').waitFor();await page.locator('#stop-all-notifications').click();await page.waitForFunction(()=>document.querySelector('#active-notifications').textContent.includes('設定はありません'));
  assert.equal(db.prepare('SELECT count(*) n FROM favorites').get().n,0);assert.deepEqual(errors,[]);await context.close();
 }
 console.log('PASS: guest gate, explicit notification choices, persistence, individual/all opt-out, hidden-event opt-out, disabled-delivery explanation, mobile/desktop layout; no real email and no browser errors');
}finally{await browser?.close();if(child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r))}db?.close();await rm(dir,{recursive:true,force:true})}
