import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp,rm,readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { DatabaseSync } from 'node:sqlite';
const root=new URL('../',import.meta.url);
test('explicit pilot switch disables email even when provider credentials exist',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'navi-no-mail-')),path=join(dir,'db.sqlite'),log=join(dir,'mail.jsonl');
 const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const child=spawn(process.execPath,['--import',new URL('test/fixtures/mail-transport.mjs',root).pathname,new URL('server.mjs',root).pathname],{cwd:root,env:{...process.env,DB_PATH:path,PORT:String(port),HOST:'127.0.0.1',RESEND_API_KEY:'test-only',EMAIL_FROM:'test@example.test',EMAIL_DELIVERY_DISABLED:'1',TEST_MAIL_LOG:log},stdio:'ignore'});
 t.after(async()=>{if(child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r))}await rm(dir,{recursive:true,force:true})});
 const base=`http://127.0.0.1:${port}`;let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/health')).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,25))}assert.ok(ready);
 const response=await fetch(base+'/api/auth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({accept_terms:true,accept_privacy:true,account_type:'member',display_name:'Test',email:'test@example.test',password:'long-password-test-123',university:'Test University',school_year:'1'})});assert.equal(response.status,201);const body=await response.json();assert.equal(body.account.email_verification_required,true);
 const db=new DatabaseSync(path,{readOnly:true});try{assert.equal(db.prepare('SELECT count(*) n FROM email_outbox').get().n,0)}finally{db.close()}
 await assert.rejects(readFile(log),{code:'ENOENT'});
});
