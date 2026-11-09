import http from 'node:http';import test from 'node:test';import assert from 'node:assert/strict';
import {legacyDomainDestination} from '../scripts/legacy-domain-redirect.mjs';
import {spawn} from 'node:child_process';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createServer} from 'node:net';
const destination='https://wase-circle-navi.com';
test('legacy migration preserves paths/queries, avoids loops and excludes API/health/verification',()=>{
 const request={method:'GET',headers:{host:'navi-qzh7.onrender.com'}};
 const redirect=(path,origin=destination,req=request)=>legacyDomainDestination(req,new URL(path,'http://localhost'),origin);
 assert.equal(redirect('/circle/12?from=search'),destination+'/circle/12?from=search');
 assert.equal(redirect('/account.html?event=1'),destination+'/account.html?event=1');
 assert.equal(redirect('/favicon.ico'),destination+'/favicon.ico');
 for(const path of ['/health','/api','/api/circles','/api/auth/me','/google6c4078279190c0a8.html','/.well-known/acme-challenge/test'])assert.equal(redirect(path),null);
 for(const origin of ['','invalid','http://wase-circle-navi.com','https://user:pass@example.test','https://navi-qzh7.onrender.com'])assert.equal(redirect('/',origin),null);
 assert.equal(legacyDomainDestination(request,new URL('http://localhost/'),undefined),null);
 assert.equal(redirect('/',destination,{...request,method:'POST'}),null);
 assert.equal(redirect('/',destination,{...request,headers:{host:'wase-circle-navi.com'}}),null);
 assert.equal(redirect('/',destination,{...request,headers:{host:'localhost:3000'}}),null);
});
test('HTTP old public pages return 301 while new/localhost pages and ownership checks remain usable',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'wase-domain-redirect-')),socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,DB_PATH:join(dir,'db.sqlite'),PORT:String(port),HOST:'127.0.0.1',PUBLIC_SITE_URL:destination,EMAIL_DELIVERY_DISABLED:'1'},stdio:'ignore'});
 t.after(async()=>{if(child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r))}await rm(dir,{recursive:true,force:true})});
 const base='http://127.0.0.1:'+port;let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/health')).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,25))}assert.ok(ready);
 function request(path,headers={},method='GET'){return new Promise((resolve,reject)=>{const req=http.request(base+path,{headers,method},res=>{res.resume();res.on('end',()=>resolve({status:res.statusCode,headers:res.headers}))});req.on('error',reject);req.end()})}
 const old={host:'navi-qzh7.onrender.com'};
 for(const path of ['/','/circle/123?q=1','/favicon.ico']){const response=await request(path,old);assert.equal(response.status,301);assert.equal(response.headers.location,destination+path)}
 assert.equal((await request('/',old,'HEAD')).status,301);
 for(const path of ['/health','/api/circles','/google6c4078279190c0a8.html'])assert.equal((await request(path,old)).status,200);
 assert.equal((await request('/',{host:'wase-circle-navi.com'})).status,200);
 assert.equal((await fetch(base+'/')).status,200);
});
