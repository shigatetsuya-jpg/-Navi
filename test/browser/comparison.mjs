import{spawn}from'node:child_process';import{mkdtemp,rm}from'node:fs/promises';import{tmpdir}from'node:os';import{join}from'node:path';import{createServer}from'node:net';import assert from'node:assert/strict';
const{chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH||'playwright'),root=new URL('../../',import.meta.url),dir=await mkdtemp(join(tmpdir(),'wase-compare-'));
const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
const child=spawn(process.execPath,[new URL('server.mjs',root).pathname],{cwd:root,env:{...process.env,DB_PATH:join(dir,'db.sqlite'),PORT:String(port),HOST:'127.0.0.1',EMAIL_DELIVERY_DISABLED:'1'},stdio:'ignore'});let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${port}/health`)).ok)break}catch{}await new Promise(r=>setTimeout(r,25))}
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox']});
 for(const width of [390,1280]){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const clubs=Array.from({length:5},(_,i)=>({id:i+1,name:'比較用団体'+(i+1),university:'テスト大学',category:'音楽',campus:'早稲田',days:'月',periods:'2',description:i?'合奏を楽しむ':'初心者向け演奏',cost:i?'年6,000円':'月500円',members:i?'50人':'20人',beginner:1,verified:1,published:1}));
 await page.route('**/api/circles',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(clubs)}));await page.goto(`http://127.0.0.1:${port}/`);
 await page.locator('[data-compare="1"]').click();assert.ok(await page.locator('#compare-bar-open').isDisabled());assert.match(await page.locator('#compare-selected').innerText(),/比較用団体1/);
 await page.locator('[data-compare="2"]').click();await page.locator('#compare-bar-open').click();await page.locator('.comparison-modal').waitFor();assert.ok((await page.locator('.compare-table').innerText()).includes('規模・部員数'));assert.ok((await page.locator('.compare-table').innerText()).includes('年6,000円'));
 await page.locator('#comparison-differences').check();assert.ok(await page.locator('.compare-table tr').filter({has:page.locator('th', {hasText:'大学・キャンパス'})}).evaluateAll(rows=>rows.every(r=>r.classList.contains('hidden'))));
 assert.ok(await page.locator('.comparison-different').first().isVisible());
 const overflow=await page.locator('.compare-scroll').evaluate(e=>({scroll:e.scrollWidth,width:e.clientWidth}));if(width===390)assert.ok(overflow.scroll>overflow.width);
 await page.locator('.modal-close').click();for(const id of [3,4,5])await page.locator(`[data-compare="${id}"]`).click();assert.equal(await page.locator('#compare-bar-count').innerText(),'4');assert.equal(await page.locator('[data-compare="5"]').getAttribute('aria-pressed'),'false');
 await page.locator('[data-remove-compare="1"]').click();assert.equal(await page.locator('#compare-bar-count').innerText(),'3');assert.equal(await page.locator('[data-compare="1"]').getAttribute('aria-pressed'),'false');
 await page.locator('#compare-clear').click();assert.ok(!await page.locator('#compare-bar').isVisible());assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS comparison selection, minimum/maximum, selected names/removal, differences and mobile scroll; no browser errors');
}finally{await browser?.close();if(child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r))}await rm(dir,{recursive:true,force:true})}
