const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
import { spawn } from 'node:child_process';
import { mkdtemp,rm,readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const project=new URL('../../',import.meta.url).pathname.replace(/\/$/,''),dir=await mkdtemp(join(tmpdir(),'navi-ui-')),port=33179;
const child=spawn(process.execPath,['--import',project+'/test/fixtures/mail-transport.mjs',project+'/server.mjs'],{cwd:project,env:{...process.env,DB_PATH:join(dir,'db.sqlite'),PORT:String(port),HOST:'127.0.0.1',EMAIL_FROM:'test@example.test',RESEND_API_KEY:'test-only',EMAIL_DELIVERY_DISABLED:'0',TEST_MAIL_LOG:join(dir,'mails.jsonl')},stdio:'ignore'});
let browser;
try{
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${port}/health`)).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,30))}assert.ok(ready);
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox'],headless:true});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${port}/account.html`);
 const form=page.locator('#register-form');
 for(const [name,value] of Object.entries({display_name:'UI Test',email:'ui@example.test',password:'long-test-password-123',university:'Example University',school_year:'1年'}))await form.locator(`[name=${name}]`).fill(value);
 await form.locator('button[type=submit],button:not([type])').click();
 await page.locator('#verification-panel').waitFor({state:'visible'});
 await page.locator('#verification-panel a').click();
 await page.locator('#resend-verification').waitFor({state:'visible'});
 assert.match(await page.locator('#email-status-copy').innerText(),/未確認/);
 await page.locator('#resend-verification').click();
 await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('送信キュー'));
 let mails=[];for(let i=0;i<100;i++){try{mails=(await readFile(join(dir,'mails.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);if(mails.length>=2)break}catch{}await new Promise(r=>setTimeout(r,25))}
 const token=mails.at(-1).mail.text.match(/verify=([\w-]+)/)[1];
 await page.goto(`http://127.0.0.1:${port}/account.html?verify=${token}`);
 assert.ok(!page.url().includes('verify='));
 await page.locator('#confirm-verification').click();
 await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('メールアドレスを確認しました'));
 await page.goto(`http://127.0.0.1:${port}/dashboard.html`);
 await page.waitForFunction(()=>document.querySelector('#email-status-copy').textContent.includes('確認済み'));
 assert.ok(!await page.locator('#resend-verification').isVisible());
 assert.deepEqual(errors,[]);
 console.log('PASS: browser registration, verification guidance, dashboard status and resend, explicit confirmation, token removal from URL; no browser errors');
}finally{if(browser)await browser.close();if(child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r))}await rm(dir,{recursive:true,force:true})}
