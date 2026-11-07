import {randomBytes,scryptSync,timingSafeEqual,createHash} from 'node:crypto';
export const POLICY_VERSION='2026-11-07-draft';
export const emailValid=value=>typeof value==='string'&&value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export const wasedaEmail=value=>emailValid(value)&&/(^|\.)waseda\.jp$/i.test(value.split('@')[1]);
export const passwordValid=value=>typeof value==='string'&&value.length>=12&&value.length<=128;
export function passwordMatches(account,password){return passwordValid(password)&&!!account&&timingSafeEqual(scryptSync(password,account.salt,64),Buffer.from(account.password_hash,'hex'))}
export function circleKey(value){return String(value||'').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu,'')}
export function similarCircles(db,name,university){const key=circleKey(name),uni=circleKey(university);if(!key||!uni)return [];return db.prepare('SELECT id,name,university,published,verified FROM circles').all().filter(c=>circleKey(c.university)===uni).filter(c=>{const other=circleKey(c.name);if(other===key)return true;if(Math.min(key.length,other.length)<3)return false;return key.includes(other)||other.includes(key)||dice(key,other)>=.8}).map(c=>({id:c.id,name:c.name,university:c.university}));}
function dice(a,b){const x=new Set(Array.from({length:a.length-1},(_,i)=>a.slice(i,i+2))),y=new Set(Array.from({length:b.length-1},(_,i)=>b.slice(i,i+2)));return 2*[...x].filter(v=>y.has(v)).length/(x.size+y.size)}
export function foundationRoutes(ctx){
 const {db,send,parseBody,getAccount,isAdmin,accountCookie,clean,emailEnabled,promoteWaitlisted,normalize,fields}=ctx;
 const hash=v=>createHash('sha256').update(v).digest('hex');
 const limits=new Map();
 function limited(key,max=5){const now=Date.now();if(limits.size>10000)for(const [k,v] of limits)if(v.until<now)limits.delete(k);const old=limits.get(key);const value=old&&old.until>now?old:{count:0,until:now+600000};value.count++;limits.set(key,value);return value.count>max}
 const tx=fn=>{db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result}catch(e){try{db.exec('ROLLBACK')}catch{}throw e}};
 const consent=b=>b.accept_terms===true&&b.accept_privacy===true;
 function rememberConsent(id,purpose){db.prepare('INSERT INTO consent_records(account_id,purpose,terms_version,privacy_version) VALUES(?,?,?,?)').run(id,purpose,POLICY_VERSION,POLICY_VERSION)}
 function verified(req,res){const a=getAccount(req);if(!a){send(res,401,{error:'会員登録・ログインすると使えます',login_required:true});return null}if(!a.email_verified){send(res,403,{error:'確認メールのリンクから本登録を完了してください',email_verification_required:true});return null}return a}
 function owner(id,circle){return db.prepare("SELECT 1 FROM circle_managers WHERE account_id=? AND circle_id=? AND manager_role='owner'").get(id,circle)}
 function forget(id){const a=db.prepare('SELECT email FROM accounts WHERE id=?').get(id);if(!a)return;const vacancies=db.prepare("SELECT DISTINCT ap.event_id FROM applications ap JOIN events e ON e.id=ap.event_id WHERE ap.member_id=? AND ap.status IN ('pending','approved') AND e.status='open'").all(id);db.prepare('DELETE FROM email_outbox WHERE recipient=?').run(a.email);db.prepare('DELETE FROM support_requests WHERE account_id=?').run(id);db.prepare('DELETE FROM accounts WHERE id=?').run(id);for(const event of vacancies)promoteWaitlisted(event.event_id)}
 return async(req,res,url)=>{
 const p=url.pathname,method=req.method,ip=req.socket.remoteAddress||'unknown';
 if(p==='/api/auth/password-reset'&&method==='POST'){
  if(limited('reset:'+ip))return send(res,429,{error:'再設定の試行が多すぎます。10分後に再試行してください'}),true;
  const b=await parseBody(req);if(!emailValid(b.email))return send(res,400,{error:'有効なメールアドレスを入力してください'}),true;
  if(!emailEnabled())return send(res,503,{error:'パスワード再設定のメール送信は準備中です'}),true;
  const a=db.prepare('SELECT * FROM accounts WHERE email=?').get(b.email.trim().toLowerCase());
  if(a){const token=randomBytes(32).toString('base64url'),expiresAt=Date.now()+3600000;tx(()=>{db.prepare('INSERT INTO password_resets VALUES(?,?,?) ON CONFLICT(account_id) DO UPDATE SET token_hash=excluded.token_hash,expires_at=excluded.expires_at').run(a.id,hash(token),expiresAt);db.prepare("UPDATE email_outbox SET status='failed',payload_json='{}',last_error='Superseded' WHERE recipient=? AND kind='password-reset' AND status='pending'").run(a.email);db.prepare('INSERT INTO email_outbox(recipient,kind,payload_json) VALUES(?,?,?)').run(a.email,'password-reset',JSON.stringify({token,expiresAt}))})}
  return send(res,200,{message:'登録がある場合、再設定メールを送信します。受信トレイと迷惑メールを確認してください。'}),true;
 }
 if(p==='/api/auth/password-reset/confirm'&&method==='POST'){
  if(limited('reset-confirm:'+ip,10))return send(res,429,{error:'試行が多すぎます'}),true;
  const b=await parseBody(req);if(!passwordValid(b.password)||!/^[-\w]{40,64}$/.test(String(b.token||'')))return send(res,400,{error:'有効な確認リンクと12〜128文字のパスワードが必要です'}),true;
  const done=tx(()=>{const row=db.prepare('SELECT account_id FROM password_resets WHERE token_hash=? AND expires_at>?').get(hash(b.token),Date.now());if(!row)return false;const salt=randomBytes(16).toString('hex');db.prepare('UPDATE accounts SET salt=?,password_hash=? WHERE id=?').run(salt,scryptSync(b.password,salt,64).toString('hex'),row.account_id);db.prepare('DELETE FROM account_sessions WHERE account_id=?').run(row.account_id);db.prepare('DELETE FROM password_resets WHERE account_id=?').run(row.account_id);return true});
  return send(res,done?200:400,done?{ok:true}:{error:'再設定リンクが無効か期限切れです'}),true;
 }
 if(p==='/api/account'&&method==='DELETE'){
  const a=getAccount(req);if(!a)return send(res,401,{error:'ログインしてください'}),true;
  if(limited('delete:'+a.id))return send(res,429,{error:'試行が多すぎます'}),true;
  const b=await parseBody(req);if(!passwordMatches(a,b.password))return send(res,403,{error:'現在のパスワードを確認してください'}),true;
  const last=db.prepare("SELECT c.name FROM circles c JOIN circle_managers m ON m.circle_id=c.id WHERE m.account_id=? AND m.manager_role='owner' AND NOT EXISTS(SELECT 1 FROM circle_managers other WHERE other.circle_id=m.circle_id AND other.manager_role='owner' AND other.account_id<>?)").all(a.id,a.id);
  if(last.length)return send(res,409,{error:'退会前に担当団体のオーナーを引き継いでください',circles:last.map(c=>c.name)}),true;
  tx(()=>forget(a.id));return send(res,200,{ok:true},{'set-cookie':accountCookie('',0)}),true;
 }
 if(p==='/api/favorites'){
  const a=verified(req,res);if(!a)return true;
  if(method==='GET')return send(res,200,db.prepare('SELECT circle_id FROM favorites WHERE account_id=?').all(a.id).map(r=>r.circle_id)),true;
  if(method==='PUT'){const b=await parseBody(req);if(!Array.isArray(b.ids)||b.ids.length>200||!b.ids.every(Number.isSafeInteger))return send(res,400,{error:'お気に入りの形式が不正です'}),true;tx(()=>{db.prepare('DELETE FROM favorites WHERE account_id=?').run(a.id);for(const id of new Set(b.ids))db.prepare('INSERT OR IGNORE INTO favorites SELECT ?,id FROM circles WHERE id=? AND published=1 AND verified=1').run(a.id,id)});return send(res,200,{ok:true}),true}
 }
 if(p==='/api/circle-candidates'&&method==='POST'){
  const a=verified(req,res);if(!a)return true;const b=await parseBody(req);return send(res,200,{candidates:similarCircles(db,clean(b.name,160),clean(b.university,160))}),true;
 }
 if(p==='/api/circle-registrations'&&method==='POST'){
  const a=verified(req,res);if(!a)return true;const b=await parseBody(req);if(!consent(b))return send(res,400,{error:'利用規約とプライバシーポリシーへの同意が必要です'}),true;
  const c=normalize({...b,published:0,verified:0});if(!c.campus||!c.category||!c.description)return send(res,400,{error:'キャンパス・カテゴリ・活動内容は必須です'}),true;
  const result=tx(()=>{const candidates=similarCircles(db,c.name,c.university);if(candidates.length)return {candidates};const r=db.prepare(`INSERT INTO circles(${fields.join(',')}) VALUES(${fields.map(()=>'?').join(',')})`).run(...fields.map(k=>c[k]));const id=Number(r.lastInsertRowid);db.prepare("INSERT INTO circle_managers VALUES(?,?,'owner',datetime('now'))").run(id,a.id);db.prepare("INSERT INTO organization_requests(circle_id,status) VALUES(?,'pending')").run(id);rememberConsent(a.id,'circle-registration');return {id}});
  return send(res,result.candidates?409:201,result.candidates?{error:'類似する団体があります。既存団体への管理者申請を確認してください',...result}:result),true;
 }
 const access=p.match(/^\/api\/circles\/(\d+)\/access-requests$/);
 if(access&&method==='POST'){
  const a=verified(req,res);if(!a)return true;const b=await parseBody(req);if(!clean(b.reason,1000)||!consent(b))return send(res,400,{error:'申請理由と規約・プライバシーへの同意が必要です'}),true;
  const id=Number(access[1]);if(!db.prepare('SELECT 1 FROM circles WHERE id=?').get(id))return send(res,404,{error:'団体が見つかりません'}),true;
  if(db.prepare('SELECT 1 FROM circle_managers WHERE circle_id=? AND account_id=?').get(id,a.id))return send(res,409,{error:'既に管理者です'}),true;
  tx(()=>{db.prepare("INSERT INTO circle_access_requests(circle_id,account_id,reason) VALUES(?,?,?) ON CONFLICT(circle_id,account_id) DO UPDATE SET reason=excluded.reason,status='pending'").run(id,a.id,clean(b.reason,1000));rememberConsent(a.id,'circle-access')});return send(res,201,{ok:true}),true;
 }
 const managed=p.match(/^\/api\/managed-circles\/(\d+)(?:\/(managers|transfer))?$/);
 if(managed){
  const a=verified(req,res);if(!a)return true;const id=Number(managed[1]),part=managed[2];const relation=db.prepare('SELECT * FROM circle_managers WHERE circle_id=? AND account_id=?').get(id,a.id);if(!relation)return send(res,404,{error:'担当団体が見つかりません'}),true;
  if(method==='GET'&&!part)return send(res,200,db.prepare('SELECT * FROM circles WHERE id=?').get(id)),true;
  if(method==='PATCH'&&!part){const b=await parseBody(req);if(!consent(b))return send(res,400,{error:'利用規約・プライバシーへの同意が必要です'}),true;const current=db.prepare('SELECT * FROM circles c WHERE id=? AND EXISTS(SELECT 1 FROM circle_managers m WHERE m.circle_id=c.id AND m.account_id=?)').get(id,a.id);if(!current)return send(res,403,{error:'管理権限を再確認してください'}),true;const c=normalize({...current,...b,published:0,verified:0});if(!c.campus||!c.category||!c.description)return send(res,400,{error:'キャンパス・カテゴリ・活動内容は必須です'}),true;const duplicates=similarCircles(db,c.name,c.university).filter(x=>x.id!==id);if(duplicates.length)return send(res,409,{error:'類似団体を確認してください',candidates:duplicates}),true;tx(()=>{db.prepare(`UPDATE circles SET ${fields.map(k=>k+'=?').join(',')},updated_at=datetime('now') WHERE id=?`).run(...fields.map(k=>c[k]),id);rememberConsent(a.id,'circle-edit');db.prepare("INSERT INTO organization_requests(circle_id,status) VALUES(?,'pending') ON CONFLICT(circle_id) DO UPDATE SET status='pending',created_at=datetime('now'),reviewed_at=NULL,reviewed_by=NULL").run(id)});return send(res,200,{ok:true,message:'変更を保存しました。運営の再確認後に公開します'}),true}
  if(part==='managers'&&method==='GET'){if(!owner(a.id,id))return send(res,403,{error:'オーナーのみ確認できます'}),true;return send(res,200,db.prepare('SELECT a.id,a.display_name,m.manager_role FROM circle_managers m JOIN accounts a ON a.id=m.account_id WHERE circle_id=?').all(id)),true}
  if(method==='POST'&&(part==='managers'||part==='transfer')){
   if(!owner(a.id,id))return send(res,403,{error:'オーナー権限が必要です'}),true;if(limited('manager:'+a.id,8))return send(res,429,{error:'試行が多すぎます。10分後に再試行してください'}),true;const b=await parseBody(req);if(!owner(a.id,id))return send(res,403,{error:'オーナー権限を再確認してください'}),true;if(!passwordMatches(a,b.password))return send(res,403,{error:'現在のパスワードを確認してください'}),true;
   const target=db.prepare('SELECT * FROM accounts WHERE email=? AND email_verified=1').get(clean(b.email,254).toLowerCase());if(!target)return send(res,400,{error:'確認済み会員を指定してください'}),true;if(target.id===a.id)return send(res,400,{error:'別の会員を指定してください'}),true;
   if(part==='transfer'&&!db.prepare('SELECT 1 FROM circle_managers WHERE circle_id=? AND account_id=?').get(id,target.id))return send(res,400,{error:'引継ぎ先を先に管理者へ追加してください'}),true;
   tx(()=>{if(part==='managers')db.prepare("INSERT OR IGNORE INTO circle_managers(circle_id,account_id,manager_role) VALUES(?,?,'manager')").run(id,target.id);else{db.prepare("UPDATE circle_managers SET manager_role='owner' WHERE circle_id=? AND account_id=?").run(id,target.id);db.prepare("UPDATE circle_managers SET manager_role='manager' WHERE circle_id=? AND account_id=?").run(id,a.id)}});return send(res,200,{ok:true}),true;
  }
 }
 if(p==='/api/support'&&method==='POST'){
  if(limited('support:'+ip,3))return send(res,429,{error:'送信回数が多すぎます。10分後に再試行してください'}),true;
  const b=await parseBody(req);if(!emailValid(b.email)||!['inquiry','correction','deletion'].includes(b.kind)||typeof b.message!=='string'||b.message.trim().length<5||b.message.length>3000||b.accept_privacy!==true)return send(res,400,{error:'メール・5〜3000文字の内容・プライバシーへの同意を確認してください'}),true;
  const id=b.circle_id?Number(b.circle_id):null;if(id&&!db.prepare('SELECT 1 FROM circles WHERE id=? AND published=1 AND verified=1').get(id))return send(res,400,{error:'対象団体を確認してください'}),true;
  const a=getAccount(req);db.prepare('INSERT INTO support_requests(account_id,circle_id,kind,reply_email,message) VALUES(?,?,?,?,?)').run(a?.id||null,id,b.kind,b.email.trim().toLowerCase(),b.message.trim());return send(res,201,{ok:true,message:'受け付けました。運営が管理画面で確認します。受付は削除の実行を意味しません。'}),true;
 }
 if(p==='/api/admin/support'&&method==='GET'){if(!isAdmin(req))return send(res,401,{error:'ログインしてください'}),true;return send(res,200,db.prepare('SELECT * FROM support_requests ORDER BY id DESC LIMIT 100').all()),true}
 if(p==='/api/admin/circle-access'&&method==='GET'){if(!isAdmin(req))return send(res,401,{error:'ログインしてください'}),true;return send(res,200,db.prepare("SELECT r.*,c.name,a.display_name,a.email FROM circle_access_requests r JOIN circles c ON c.id=r.circle_id JOIN accounts a ON a.id=r.account_id WHERE r.status='pending' ORDER BY r.id").all()),true}
 const decision=p.match(/^\/api\/admin\/circle-access\/(\d+)$/);
 if(decision&&method==='POST'){
  if(!isAdmin(req))return send(res,401,{error:'ログインしてください'}),true;const b=await parseBody(req);if(!['approve','reject'].includes(b.decision))return send(res,400,{error:'判断が不正です'}),true;
  const result=tx(()=>{const r=db.prepare("SELECT r.* FROM circle_access_requests r JOIN accounts a ON a.id=r.account_id WHERE r.id=? AND r.status='pending' AND a.email_verified=1").get(Number(decision[1]));if(!r)return false;if(b.decision==='approve')db.prepare("INSERT OR IGNORE INTO circle_managers(circle_id,account_id,manager_role) VALUES(?,?,'manager')").run(r.circle_id,r.account_id);db.prepare('UPDATE circle_access_requests SET status=? WHERE id=?').run(b.decision==='approve'?'approved':'rejected',r.id);return true});return send(res,result?200:404,result?{ok:true}:{error:'確認待ちの申請がありません'}),true;
 }
 return false;
 }
}
