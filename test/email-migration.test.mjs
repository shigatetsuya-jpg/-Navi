import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';

test('email verification migration preserves queued deliveries and existing accounts', async()=>{
 const db=new DatabaseSync(':memory:');
 try{
  db.exec('PRAGMA foreign_keys=ON');
  for(const file of ['001-init.sql','002-accounts-events.sql','003-email-outbox.sql'])db.exec(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8'));
  db.prepare('INSERT INTO accounts(email,display_name,account_type,salt,password_hash) VALUES(?,?,?,?,?)').run('existing@example.test','Existing','member','salt','hash');
  db.prepare('INSERT INTO email_outbox(recipient,kind,payload_json,attempts) VALUES(?,?,?,?)').run('existing@example.test','application-received','{"eventTitle":"Test"}',2);
  const before=db.prepare('SELECT * FROM email_outbox').get();
  db.exec(await readFile(new URL('../migrations/004-email-verification.sql',import.meta.url),'utf8'));
  assert.deepEqual(db.prepare('SELECT * FROM email_outbox').get(),before);
  assert.equal(db.prepare('SELECT email_verified FROM accounts').get().email_verified,0);
  db.prepare('INSERT INTO email_outbox(recipient,kind,payload_json) VALUES(?,?,?)').run('existing@example.test','email-verification','{}');
  db.prepare('INSERT INTO email_verifications(account_id,token_hash,expires_at) VALUES(?,?,?)').run(1,'hashed-token',Date.now()+10000);
  assert.throws(()=>db.prepare('INSERT INTO email_verifications(account_id,token_hash,expires_at) VALUES(?,?,?)').run(999,'other-token',0));
  db.prepare('DELETE FROM accounts WHERE id=1').run();
  assert.equal(db.prepare('SELECT count(*) n FROM email_verifications').get().n,0);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{db.close()}
});
