import http from 'node:http';
import { mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep, dirname } from 'node:path';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const root = resolve('public');
const dbPath=resolve(process.env.DB_PATH || './data/shinkanavi.sqlite');
mkdirSync(dirname(dbPath), { recursive:true });
const db = new DatabaseSync(dbPath);
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')));`);
const applied=db.prepare('SELECT version FROM schema_migrations').all().map(x=>x.version);
if(!applied.includes(1)){db.exec(await readFile(resolve('migrations/001-init.sql'),'utf8'));db.prepare('INSERT INTO schema_migrations(version) VALUES(1)').run();}
if(!applied.includes(2)){db.exec(await readFile(resolve('migrations/002-accounts-events.sql'),'utf8'));db.prepare('INSERT INTO schema_migrations(version) VALUES(2)').run();}
const sessions = db.prepare('SELECT a.id FROM sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token_hash=? AND s.expires_at>?');
const loginFailures=new Map();
const send=(res,status,data,headers={})=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers});res.end(JSON.stringify(data));};
const parseBody=async req=>{let s='';for await(const c of req){s+=c;if(s.length>2_000_000)throw Error('リクエストが大きすぎます');}return JSON.parse(s||'{}');};
const clean=(v,max=5000)=>String(v??'').trim().slice(0,max);
const htmlEscape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function siteOrigin(req){for(const candidate of [process.env.PUBLIC_SITE_URL,process.env.RENDER_EXTERNAL_URL])if(candidate){try{const u=new URL(candidate);if(u.protocol==='https:'&&!u.username&&!u.password)return u.origin;}catch{}}if(process.env.RENDER_EXTERNAL_HOSTNAME&&/^[a-z0-9.-]+$/i.test(process.env.RENDER_EXTERNAL_HOSTNAME))return 'https://'+process.env.RENDER_EXTERNAL_HOSTNAME;const host=String(req.headers.host||'localhost:3000');return /^[a-z0-9.-]+(?::\d{1,5})?$/i.test(host)?`http://${host}`:'http://localhost:3000';}
const safeEqual=(a,b)=>{const left=Buffer.from(String(a??'')),right=Buffer.from(String(b??''));return left.length===right.length&&timingSafeEqual(left,right)};
const truth=v=>v===true||v===1||v==='1'||v==='true';
const fields=['name','university','campus','category','description','days','periods','location','frequency','cost','members','beginner','experienced','concurrent','official','trial','conditions','website','sns','trial_url','contact','verified','published'];
const publicCircleColumns=['id','name','university','campus','category','description','days','periods','location','frequency','cost','members','beginner','experienced','concurrent','official','trial','conditions','website','sns','trial_url','verified','published','updated_at'].join(',');
function normalize(x){const o={};for(const k of fields)o[k]=['beginner','experienced','concurrent','official','trial','verified','published'].includes(k)?(x[k]===''||x[k]===undefined||x[k]===null?null:Number(truth(x[k]))):clean(x[k],k==='description'?5000:1000);o.verified=Number(truth(x.verified));o.published=Number(truth(x.published));o.name=clean(x.name,160);o.university=clean(x.university,160);if(!o.name||!o.university)throw Error('団体名と大学名は必須です');for(const k of ['website','sns','trial_url'])if(o[k]&&!/^https:\/\//i.test(o[k]))throw Error(`${k}はhttps://から始まるURLを入力してください`);return o;}
function isAdmin(req){const c=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('sn_session='));if(!c)return false;const token=decodeURIComponent(c.slice(11));return !!sessions.get(createHash('sha256').update(token).digest('hex'),Date.now());}
const accountSession=db.prepare('SELECT a.* FROM account_sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=? AND s.expires_at>?');
function cookieValue(req,name){const c=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='));return c?decodeURIComponent(c.slice(name.length+1)):'';}
function getAccount(req){const token=cookieValue(req,'sn_account');return token?accountSession.get(createHash('sha256').update(token).digest('hex'),Date.now()):null;}
function newSession(accountId){const token=randomBytes(32).toString('base64url');db.prepare('INSERT INTO account_sessions VALUES(?,?,?)').run(createHash('sha256').update(token).digest('hex'),accountId,Date.now()+7*86400000);return token;}
function accountCookie(token,maxAge=604800){return `sn_account=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${process.env.NODE_ENV==='production'?'; Secure':''}`;}
function isManager(accountId,circleId){return !!db.prepare('SELECT 1 FROM circle_managers WHERE account_id=? AND circle_id=?').get(accountId,circleId);}
function managedCircles(accountId){return db.prepare(`SELECT c.id,c.name,c.university,c.campus,c.published,c.verified,COALESCE(r.status,'approved') AS request_status FROM circles c JOIN circle_managers m ON m.circle_id=c.id LEFT JOIN organization_requests r ON r.circle_id=c.id WHERE m.account_id=? ORDER BY c.id`).all(accountId);}
function publicAccount(a){return {id:a.id,email:a.email,display_name:a.display_name,account_type:a.account_type,university:a.university,school_year:a.school_year,circles:a.account_type==='organization'?managedCircles(a.id):[]};}
function rejectForeignOrigin(req,res){const origin=req.headers.origin;if(!origin)return false;try{if(new URL(origin).host===req.headers.host)return false;}catch{}send(res,403,{error:'別のサイトからのリクエストは受け付けません'});return true;}
function validCapacity(v){const n=Number(v);return Number.isInteger(n)&&n>=1&&n<=5000?n:null;}
function promoteWaitlisted(eventId){const event=db.prepare('SELECT capacity FROM events WHERE id=?').get(eventId);if(!event)return;let available=event.capacity-db.prepare(`SELECT count(*) n FROM applications WHERE event_id=? AND status IN ('pending','approved')`).get(eventId).n;while(available>0){const next=db.prepare(`SELECT id FROM applications WHERE event_id=? AND status='waitlisted' ORDER BY created_at,id LIMIT 1`).get(eventId);if(!next)break;db.prepare(`UPDATE applications SET status='pending',updated_at=datetime('now') WHERE id=?`).run(next.id);available--;}}
const columns=fields.join(',');
const app=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');
 if(req.method==='GET'&&url.pathname==='/health')return send(res,200,{ok:true});
 if(req.method==='GET'&&url.pathname==='/robots.txt'){const base=siteOrigin(req);res.writeHead(200,{'content-type':'text/plain; charset=utf-8','cache-control':'public, max-age=300','x-content-type-options':'nosniff'});return res.end(`User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);}
 if(req.method==='GET'&&url.pathname==='/sitemap.xml'){const base=siteOrigin(req),rows=db.prepare(`SELECT id,updated_at FROM circles WHERE published=1 AND verified=1 ORDER BY id`).all(),urls=[{loc:base+'/',lastmod:new Date().toISOString().slice(0,10)},...rows.map(c=>({loc:base+'/circle/'+c.id,lastmod:String(c.updated_at||'').slice(0,10)}))];const xml='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.map(x=>'<url><loc>'+htmlEscape(x.loc)+'</loc>'+( /^\d{4}-\d{2}-\d{2}$/.test(x.lastmod)?'<lastmod>'+x.lastmod+'</lastmod>':'')+'</url>').join('')+'</urlset>';res.writeHead(200,{'content-type':'application/xml; charset=utf-8','cache-control':'public, max-age=300','x-content-type-options':'nosniff'});return res.end(xml);}
 if(['POST','PUT','PATCH','DELETE'].includes(req.method)&&rejectForeignOrigin(req,res))return;
 if(url.pathname==='/api/auth/me'&&req.method==='GET'){const a=getAccount(req);return send(res,200,{account:a?publicAccount(a):null});}
 if(url.pathname==='/api/auth/register'&&req.method==='POST'){
  const ip=req.socket.remoteAddress||'unknown',key='register:'+ip,attempt=loginFailures.get(key);
  if(attempt&&attempt.until>Date.now()&&attempt.count>=5)return send(res,429,{error:'登録回数が多すぎます。10分後に再試行してください'});
  loginFailures.set(key,{count:attempt&&attempt.until>Date.now()?attempt.count+1:1,until:Date.now()+600000});
  const b=await parseBody(req),accountType=clean(b.account_type,20),email=clean(b.email,254).toLowerCase(),password=String(b.password||''),displayName=clean(b.display_name,100);
  if(!['member','organization'].includes(accountType))return send(res,400,{error:'登録区分を選択してください'});
  if(!/^\S+@\S+\.\S+$/.test(email)||password.length<12||!displayName)return send(res,400,{error:'有効なメールアドレス、12文字以上のパスワード、氏名が必要です'});
  if(accountType==='member'&&(!clean(b.university,160)||!clean(b.school_year,40)))return send(res,400,{error:'大学名と学年を入力してください'});
  if(accountType==='organization'&&(!clean(b.organization_name,160)||!clean(b.university,160)||!clean(b.campus,100)))return send(res,400,{error:'団体名、大学名、キャンパスを入力してください'});
  const salt=randomBytes(16).toString('hex');
  try{
   db.exec('BEGIN IMMEDIATE');
   const result=db.prepare('INSERT INTO accounts(email,display_name,account_type,university,school_year,salt,password_hash) VALUES(?,?,?,?,?,?,?)').run(email,displayName,accountType,clean(b.university,160),accountType==='member'?clean(b.school_year,40):'',salt,scryptSync(password,salt,64).toString('hex'));
   const accountId=Number(result.lastInsertRowid);
   if(accountType==='organization'){
    const c=normalize({name:b.organization_name,university:b.university,campus:b.campus,category:b.category,description:b.description,contact:'',verified:0,published:0});
    const circle=db.prepare(`INSERT INTO circles(${columns}) VALUES(${fields.map(()=>'?').join(',')})`).run(...fields.map(k=>c[k]));
    const circleId=Number(circle.lastInsertRowid);db.prepare('INSERT INTO circle_managers(circle_id,account_id,manager_role) VALUES(?,?,?)').run(circleId,accountId,'owner');db.prepare('INSERT INTO organization_requests(circle_id,status) VALUES(?,?)').run(circleId,'pending');
   }
   db.exec('COMMIT');
   loginFailures.delete(key);
   const token=newSession(accountId),created=db.prepare('SELECT * FROM accounts WHERE id=?').get(accountId);
   return send(res,201,{account:publicAccount(created)}, {'set-cookie':accountCookie(token)});
  }catch(e){try{db.exec('ROLLBACK')}catch{}if(String(e.message).includes('UNIQUE constraint failed: accounts.email'))return send(res,409,{error:'このメールアドレスはすでに登録されています'});throw e;}
 }
 if(url.pathname==='/api/auth/login'&&req.method==='POST'){
  const ip=req.socket.remoteAddress||'unknown',key='account-login:'+ip,attempt=loginFailures.get(key);
  if(attempt&&attempt.until>Date.now()&&attempt.count>=8)return send(res,429,{error:'ログイン試行が多すぎます。10分後に再試行してください'});
  const b=await parseBody(req),email=clean(b.email,254).toLowerCase(),password=String(b.password||''),a=db.prepare('SELECT * FROM accounts WHERE email=?').get(email);
  const salt=a?.salt||'shinkanavi-dummy-salt',candidate=scryptSync(password,salt,64),expected=Buffer.from(a?.password_hash||'0'.repeat(128),'hex');
  if(!a||!timingSafeEqual(candidate,expected)){const old=loginFailures.get(key);loginFailures.set(key,{count:old&&old.until>Date.now()?old.count+1:1,until:Date.now()+600000});return send(res,401,{error:'メールアドレスまたはパスワードが違います'});}
  loginFailures.delete(key);return send(res,200,{account:publicAccount(a)},{'set-cookie':accountCookie(newSession(a.id))});
 }
 if(url.pathname==='/api/auth/logout'&&req.method==='POST'){
  const a=getAccount(req);if(a){const token=cookieValue(req,'sn_account');db.prepare('DELETE FROM account_sessions WHERE token_hash=?').run(createHash('sha256').update(token).digest('hex'));}
  return send(res,200,{ok:true},{'set-cookie':accountCookie('',0)});
 }
 if(url.pathname==='/api/circles/events'&&req.method==='GET')return send(res,400,{error:'団体IDが必要です'});
 const publicEvents=url.pathname.match(/^\/api\/circles\/(\d+)\/events$/);
 if(publicEvents&&req.method==='GET')return send(res,200,db.prepare(`SELECT e.id,e.circle_id,e.title,e.description,e.starts_at,e.location,e.capacity,e.application_deadline,e.status,c.name AS circle_name FROM events e JOIN circles c ON c.id=e.circle_id WHERE e.circle_id=? AND e.status='open' AND c.published=1 AND c.verified=1 ORDER BY e.starts_at,e.id`).all(Number(publicEvents[1])));
 const applicationEvent=url.pathname.match(/^\/api\/events\/(\d+)\/applications$/);
 if(applicationEvent&&req.method==='POST'){
  const a=getAccount(req);if(!a)return send(res,401,{error:'申し込みにはログインが必要です',login_required:true});if(a.account_type!=='member')return send(res,403,{error:'個人アカウントでログインしてください'});
  const rateKey='apply-account:'+a.id,rate=loginFailures.get(rateKey);if(rate&&rate.until>Date.now()&&rate.count>=15)return send(res,429,{error:'申し込み回数が多すぎます。しばらくしてから再試行してください'});loginFailures.set(rateKey,{count:rate&&rate.until>Date.now()?rate.count+1:1,until:Date.now()+600000});
  const b=await parseBody(req),eventId=Number(applicationEvent[1]),message=clean(b.message,1000);
  db.exec('BEGIN IMMEDIATE');try{
   const event=db.prepare(`SELECT e.* FROM events e JOIN circles c ON c.id=e.circle_id WHERE e.id=? AND e.status='open' AND c.published=1 AND c.verified=1`).get(eventId);
   if(!event){db.exec('ROLLBACK');return send(res,404,{error:'受付中のイベントが見つかりません'});}
   if(event.application_deadline&&Date.parse(event.application_deadline)<Date.now()){db.exec('ROLLBACK');return send(res,409,{error:'申し込み期限を過ぎています'});}
   const existing=db.prepare('SELECT id,status FROM applications WHERE event_id=? AND member_id=?').get(eventId,a.id);
   if(existing&&!['cancelled','rejected'].includes(existing.status)){db.exec('ROLLBACK');return send(res,409,{error:'このイベントには申し込み済みです'});}
   const reserved=db.prepare(`SELECT count(*) n FROM applications WHERE event_id=? AND status IN ('pending','approved')`).get(eventId).n;
   const waitlisted=db.prepare(`SELECT count(*) n FROM applications WHERE event_id=? AND status='waitlisted'`).get(eventId).n;
   if(reserved>=event.capacity&&waitlisted>=Math.min(event.capacity*3,1000)){db.exec('ROLLBACK');return send(res,409,{error:'キャンセル待ちの受付上限に達しました'});}
   const status=reserved>=event.capacity?'waitlisted':'pending';
   const result=existing?db.prepare(`UPDATE applications SET message=?,status=?,updated_at=datetime('now') WHERE id=?`).run(message,status,existing.id):db.prepare('INSERT INTO applications(event_id,member_id,message,status) VALUES(?,?,?,?)').run(eventId,a.id,message,status);
   db.exec('COMMIT');return send(res,201,{id:existing?existing.id:Number(result.lastInsertRowid),status});
  }catch(e){try{db.exec('ROLLBACK')}catch{}throw e;}
 }
 if(url.pathname==='/api/member/applications'&&req.method==='GET'){
  const a=getAccount(req);if(!a)return send(res,401,{error:'ログインしてください'});if(a.account_type!=='member')return send(res,403,{error:'個人アカウントでログインしてください'});
  return send(res,200,db.prepare(`SELECT a.id,a.message,a.status,a.created_at,a.updated_at,e.id AS event_id,e.title AS event_title,e.starts_at,e.location,c.id AS circle_id,c.name AS circle_name FROM applications a JOIN events e ON e.id=a.event_id JOIN circles c ON c.id=e.circle_id WHERE a.member_id=? ORDER BY a.created_at DESC`).all(a.id));
 }
 const cancelApplication=url.pathname.match(/^\/api\/member\/applications\/(\d+)\/cancel$/);
 if(cancelApplication&&req.method==='POST'){
  const a=getAccount(req);if(!a)return send(res,401,{error:'ログインしてください'});if(a.account_type!=='member')return send(res,403,{error:'個人アカウントでログインしてください'});
  db.exec('BEGIN IMMEDIATE');try{const row=db.prepare(`SELECT id,event_id,status FROM applications WHERE id=? AND member_id=?`).get(Number(cancelApplication[1]),a.id);if(!row){db.exec('ROLLBACK');return send(res,404,{error:'申し込みが見つかりません'});}if(!['pending','approved','waitlisted'].includes(row.status)){db.exec('ROLLBACK');return send(res,409,{error:'この申し込みは取り消せません'});}db.prepare(`UPDATE applications SET status='cancelled',updated_at=datetime('now') WHERE id=?`).run(row.id);promoteWaitlisted(row.event_id);db.exec('COMMIT');return send(res,200,{ok:true});}catch(e){try{db.exec('ROLLBACK')}catch{}throw e;}
 }
 if(url.pathname==='/api/org/events'&&req.method==='GET'){
  const a=getAccount(req);if(!a)return send(res,401,{error:'ログインしてください'});if(a.account_type!=='organization')return send(res,403,{error:'団体アカウントでログインしてください'});
  return send(res,200,db.prepare(`SELECT e.*,c.name AS circle_name,c.published,c.verified FROM events e JOIN circles c ON c.id=e.circle_id JOIN circle_managers m ON m.circle_id=c.id WHERE m.account_id=? ORDER BY e.starts_at,e.id`).all(a.id));
 }
 if(url.pathname==='/api/org/events'&&req.method==='POST'){
  const a=getAccount(req);if(!a)return send(res,401,{error:'ログインしてください'});if(a.account_type!=='organization')return send(res,403,{error:'団体アカウントでログインしてください'});
  const b=await parseBody(req),circleId=Number(b.circle_id),title=clean(b.title,160),capacity=validCapacity(b.capacity),status=clean(b.status,20)||'draft';
  if(!title||!capacity||!['draft','open','closed'].includes(status))return send(res,400,{error:'イベント名、定員（1〜5000人）、公開状態を確認してください'});
  if(!isManager(a.id,circleId))return send(res,404,{error:'担当団体が見つかりません'});
  const circle=db.prepare('SELECT published,verified FROM circles WHERE id=?').get(circleId);if(status==='open'&&(!circle?.published||!circle?.verified))return send(res,403,{error:'団体情報の確認・公開後にイベントを受付開始できます'});
  const startsAt=clean(b.starts_at,40),deadline=clean(b.application_deadline,40);if(startsAt&&Number.isNaN(Date.parse(startsAt))||deadline&&Number.isNaN(Date.parse(deadline)))return send(res,400,{error:'日時の形式を確認してください'});
  const result=db.prepare('INSERT INTO events(circle_id,title,description,starts_at,location,capacity,application_deadline,status) VALUES(?,?,?,?,?,?,?,?)').run(circleId,title,clean(b.description,3000),startsAt,clean(b.location,300),capacity,deadline,status);
  return send(res,201,{id:Number(result.lastInsertRowid)});
 }
 const orgEvent=url.pathname.match(/^\/api\/org\/events\/(\d+)$/);
 if(orgEvent&&req.method==='PATCH'){
  const a=getAccount(req);if(!a)return send(res,401,{error:'ログインしてください'});if(a.account_type!=='organization')return send(res,403,{error:'団体アカウントでログインしてください'});
  const id=Number(orgEvent[1]),b=await parseBody(req),event=db.prepare('SELECT e.*,c.published,c.verified FROM events e JOIN circles c ON c.id=e.circle_id JOIN circle_managers m ON m.circle_id=e.circle_id WHERE e.id=? AND m.account_id=?').get(id,a.id);
  if(!event)return send(res,404,{error:'イベントが見つかりません'});
  const status=clean(b.status,20),capacity=validCapacity(b.capacity);if(!['draft','open','closed'].includes(status)||!capacity||!clean(b.title,160))return send(res,400,{error:'イベント名、定員、公開状態を確認してください'});
  if(status==='open'&&(!event.published||!event.verified))return send(res,403,{error:'団体情報の確認・公開後にイベントを受付開始できます'});
  const reserved=db.prepare(`SELECT count(*) n FROM applications WHERE event_id=? AND status IN ('pending','approved')`).get(id).n;if(capacity<reserved)return send(res,409,{error:`受付中・承認済みが${reserved}件あるため、定員を下げられません`});
  const startsAt=clean(b.starts_at,40),deadline=clean(b.application_deadline,40);if(startsAt&&Number.isNaN(Date.parse(startsAt))||deadline&&Number.isNaN(Date.parse(deadline)))return send(res,400,{error:'日時の形式を確認してください'});
  db.prepare(`UPDATE events SET title=?,description=?,starts_at=?,location=?,capacity=?,application_deadline=?,status=?,updated_at=datetime('now') WHERE id=?`).run(clean(b.title,160),clean(b.description,3000),startsAt,clean(b.location,300),capacity,deadline,status,id);
  return send(res,200,{ok:true});
 }
 if(url.pathname==='/api/org/applications'&&req.method==='GET'){
  const a=getAccount(req);if(!a)return send(res,401,{error:'ログインしてください'});if(a.account_type!=='organization')return send(res,403,{error:'団体アカウントでログインしてください'});
  return send(res,200,db.prepare(`SELECT ap.id,ap.event_id,ap.message,ap.status,ap.created_at,ap.updated_at,ev.title AS event_title,ev.starts_at,c.id AS circle_id,c.name AS circle_name,member.display_name,member.university,member.school_year FROM applications ap JOIN events ev ON ev.id=ap.event_id JOIN circles c ON c.id=ev.circle_id JOIN circle_managers m ON m.circle_id=c.id JOIN accounts member ON member.id=ap.member_id WHERE m.account_id=? ORDER BY ap.created_at DESC`).all(a.id));
 }
 const decision=url.pathname.match(/^\/api\/org\/applications\/(\d+)\/decision$/);
 if(decision&&req.method==='POST'){
  const a=getAccount(req);if(!a)return send(res,401,{error:'ログインしてください'});if(a.account_type!=='organization')return send(res,403,{error:'団体アカウントでログインしてください'});
  const b=await parseBody(req),id=Number(decision[1]),choice=clean(b.decision,20);if(!['approve','reject'].includes(choice))return send(res,400,{error:'承認または見送りを選択してください'});
  db.exec('BEGIN IMMEDIATE');try{const row=db.prepare(`SELECT ap.id,ap.event_id,ap.status,ev.capacity FROM applications ap JOIN events ev ON ev.id=ap.event_id JOIN circle_managers m ON m.circle_id=ev.circle_id WHERE ap.id=? AND m.account_id=?`).get(id,a.id);if(!row){db.exec('ROLLBACK');return send(res,404,{error:'申し込みが見つかりません'});}if(row.status!=='pending'){db.exec('ROLLBACK');return send(res,409,{error:'未対応の申し込みではありません'});}if(choice==='approve'){const approved=db.prepare(`SELECT count(*) n FROM applications WHERE event_id=? AND status='approved'`).get(row.event_id).n;if(approved>=row.capacity){db.exec('ROLLBACK');return send(res,409,{error:'定員に達しています'});}db.prepare(`UPDATE applications SET status='approved',updated_at=datetime('now') WHERE id=?`).run(id);}else{db.prepare(`UPDATE applications SET status='rejected',updated_at=datetime('now') WHERE id=?`).run(id);promoteWaitlisted(row.event_id);}db.exec('COMMIT');return send(res,200,{ok:true});}catch(e){try{db.exec('ROLLBACK')}catch{}throw e;}
 }
 if(req.method==='GET'&&url.pathname==='/api/circles'){const admin=isAdmin(req);let rows=db.prepare(admin?`SELECT * FROM circles ORDER BY updated_at DESC`:`SELECT ${publicCircleColumns} FROM circles WHERE published=1 AND verified=1 ORDER BY updated_at DESC`).all();const q=Object.fromEntries(url.searchParams);rows=rows.filter(c=>Object.entries(q).every(([k,v])=>{if(!v||!fields.includes(k))return true;if(['beginner','experienced','concurrent','official','trial'].includes(k))return String(c[k])===v;return String(c[k]??'').toLowerCase().includes(v.toLowerCase());}));return send(res,200,rows);}
 if(req.method==='GET'&&url.pathname.startsWith('/api/circles/')){const id=Number(url.pathname.split('/').pop()),admin=isAdmin(req),c=db.prepare(admin?`SELECT * FROM circles WHERE id=?`:`SELECT ${publicCircleColumns} FROM circles WHERE id=? AND published=1 AND verified=1`).get(id);return c?send(res,200,c):send(res,404,{error:'見つかりません'});}
 if(url.pathname==='/api/admin/status'&&req.method==='GET')return send(res,200,{setup:db.prepare('SELECT count(*) n FROM admins').get().n===0,authenticated:isAdmin(req)});
 if(url.pathname==='/api/admin/setup'&&req.method==='POST'){if(db.prepare('SELECT count(*) n FROM admins').get().n) return send(res,409,{error:'管理者は設定済みです'});if(!process.env.ADMIN_SETUP_TOKEN)return send(res,503,{error:'ADMIN_SETUP_TOKENをサーバー環境変数に設定してください'});const b=await parseBody(req);if(!safeEqual(clean(b.token),process.env.ADMIN_SETUP_TOKEN))return send(res,401,{error:'セットアップキーが違います'});const email=clean(b.email,254).toLowerCase(),password=String(b.password||'');if(!/^\S+@\S+\.\S+$/.test(email)||password.length<12)return send(res,400,{error:'有効なメールアドレスと12文字以上のパスワードが必要です'});const salt=randomBytes(16).toString('hex');db.prepare('INSERT INTO admins(email,salt,password_hash) VALUES(?,?,?)').run(email,salt,scryptSync(password,salt,64).toString('hex'));return send(res,201,{ok:true});}
 if(url.pathname==='/api/admin/login'&&req.method==='POST'){const ip=req.socket.remoteAddress||'unknown',attempt=loginFailures.get(ip);if(attempt&&attempt.until>Date.now()&&attempt.count>=8)return send(res,429,{error:'ログイン試行が多すぎます。10分後に再試行してください'});const b=await parseBody(req),a=db.prepare('SELECT * FROM admins WHERE email=?').get(clean(b.email,254).toLowerCase());if(!a||!timingSafeEqual(scryptSync(String(b.password||''),a.salt,64),Buffer.from(a.password_hash,'hex'))){const old=loginFailures.get(ip);loginFailures.set(ip,{count:old&&old.until>Date.now()?old.count+1:1,until:Date.now()+600000});return send(res,401,{error:'メールアドレスまたはパスワードが違います'});}loginFailures.delete(ip);const token=randomBytes(32).toString('base64url');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(createHash('sha256').update(token).digest('hex'),a.id,Date.now()+7*86400000);return send(res,200,{ok:true},{'set-cookie':`sn_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${process.env.NODE_ENV==='production'?'; Secure':''}`});}
 if(url.pathname==='/api/admin/logout'&&req.method==='POST'){if(isAdmin(req)){const token=decodeURIComponent((req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('sn_session='))?.slice(11)||'');db.prepare('DELETE FROM sessions WHERE token_hash=?').run(createHash('sha256').update(token).digest('hex'));}return send(res,200,{ok:true},{'set-cookie':'sn_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});}
 if(url.pathname.startsWith('/api/admin/')){if(!isAdmin(req))return send(res,401,{error:'ログインしてください'});
 if(url.pathname==='/api/admin/stats'&&req.method==='GET')return send(res,200,{total:db.prepare('SELECT count(*) n FROM circles').get().n,published:db.prepare('SELECT count(*) n FROM circles WHERE published=1').get().n,hidden:db.prepare('SELECT count(*) n FROM circles WHERE published=0').get().n,unverified:db.prepare('SELECT count(*) n FROM circles WHERE verified=0').get().n});
 if(url.pathname==='/api/admin/accounts'&&req.method==='GET')return send(res,200,db.prepare(`SELECT a.id,a.display_name,a.email,a.account_type,a.university,a.school_year,a.created_at,(SELECT count(*) FROM applications ap WHERE ap.member_id=a.id) AS application_count,(SELECT count(*) FROM circle_managers cm WHERE cm.account_id=a.id) AS managed_circle_count FROM accounts a ORDER BY a.created_at DESC,a.id DESC`).all());
 const accountDelete=url.pathname.match(/^\/api\/admin\/accounts\/(\d+)$/);
 if(accountDelete&&req.method==='DELETE'){
  const id=Number(accountDelete[1]),account=db.prepare('SELECT id,account_type FROM accounts WHERE id=?').get(id);if(!account)return send(res,404,{error:'利用者が見つかりません'});
  db.exec('BEGIN IMMEDIATE');try{
   if(account.account_type==='organization'){
    db.prepare(`UPDATE events SET status='closed',updated_at=datetime('now') WHERE circle_id IN (SELECT mine.circle_id FROM circle_managers mine WHERE mine.account_id=? AND NOT EXISTS (SELECT 1 FROM circle_managers other WHERE other.circle_id=mine.circle_id AND other.account_id<>?))`).run(id,id);
    db.prepare(`UPDATE circles SET published=0,verified=0,updated_at=datetime('now') WHERE id IN (SELECT mine.circle_id FROM circle_managers mine WHERE mine.account_id=? AND NOT EXISTS (SELECT 1 FROM circle_managers other WHERE other.circle_id=mine.circle_id AND other.account_id<>?))`).run(id,id);
   }
   db.prepare('DELETE FROM accounts WHERE id=?').run(id);db.exec('COMMIT');return send(res,200,{ok:true});
  }catch(e){try{db.exec('ROLLBACK')}catch{}throw e;}
 }
 if(url.pathname==='/api/admin/organization-requests'&&req.method==='GET')return send(res,200,db.prepare(`SELECT r.circle_id,r.status,r.created_at,c.name,c.university,c.campus,c.category,c.description,a.display_name AS applicant_name,a.email AS applicant_email FROM organization_requests r JOIN circles c ON c.id=r.circle_id JOIN circle_managers m ON m.circle_id=c.id AND m.manager_role='owner' JOIN accounts a ON a.id=m.account_id WHERE r.status='pending' ORDER BY r.created_at`).all());
 const orgReview=url.pathname.match(/^\/api\/admin\/organizations\/(\d+)\/decision$/);
 if(orgReview&&req.method==='POST'){
  const b=await parseBody(req),id=Number(orgReview[1]),choice=clean(b.decision,20);if(!['approve','reject'].includes(choice))return send(res,400,{error:'承認または見送りを選択してください'});
  const request=db.prepare(`SELECT circle_id,status FROM organization_requests WHERE circle_id=?`).get(id);if(!request||request.status!=='pending')return send(res,404,{error:'確認待ちの団体が見つかりません'});
  const adminId=sessions.get(createHash('sha256').update(cookieValue(req,'sn_session')).digest('hex'),Date.now())?.id||null;
  db.exec('BEGIN IMMEDIATE');try{db.prepare(`UPDATE organization_requests SET status=?,reviewed_at=datetime('now'),reviewed_by=? WHERE circle_id=? AND status='pending'`).run(choice==='approve'?'approved':'rejected',adminId,id);if(choice==='approve')db.prepare(`UPDATE circles SET verified=1,published=1,updated_at=datetime('now') WHERE id=?`).run(id);db.exec('COMMIT');return send(res,200,{ok:true,status:choice==='approve'?'approved':'rejected'});}catch(e){try{db.exec('ROLLBACK')}catch{}throw e;}
 }
 if(url.pathname==='/api/admin/import'&&req.method==='POST'){const b=await parseBody(req);if(!Array.isArray(b.rows)||b.rows.length>1000)return send(res,400,{error:'最大1000件の配列を指定してください'});const existing=db.prepare('SELECT id,name,university FROM circles').all();let added=0,updated=0,failed=[];for(let i=0;i<b.rows.length;i++){try{const c=normalize(b.rows[i]);const same=existing.find(e=>e.name.toLowerCase()===c.name.toLowerCase()&&e.university.toLowerCase()===c.university.toLowerCase());if(same&&b.mode!=='update')throw Error(`重複候補: ${same.university} / ${same.name} (id:${same.id})`);if(same){db.prepare(`UPDATE circles SET ${fields.map(k=>`${k}=?`).join(',')},updated_at=datetime('now') WHERE id=?`).run(...fields.map(k=>c[k]),same.id);updated++;}else{const inserted=db.prepare(`INSERT INTO circles(${columns}) VALUES(${fields.map(()=>'?').join(',')})`).run(...fields.map(k=>c[k]));existing.push({id:Number(inserted.lastInsertRowid),name:c.name,university:c.university});added++;}}catch(e){failed.push({row:i+1,error:e.message});}}return send(res,200,{added,updated,failed});}
 if(url.pathname==='/api/admin/export'&&req.method==='GET'){const rows=db.prepare('SELECT * FROM circles ORDER BY id').all();res.writeHead(200,{'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename="shinkanavi-circles.csv"'});res.end([fields.join(','),...rows.map(r=>fields.map(k=>'"'+String(r[k]??'').replaceAll('"','""')+'"').join(','))].join('\r\n'));return;}
 const match=url.pathname.match(/^\/api\/admin\/circles(?:\/(\d+))?$/);if(match){const id=Number(match[1]);if(req.method==='POST'||req.method==='PUT'){const c=normalize(await parseBody(req));if(req.method==='POST'){const r=db.prepare(`INSERT INTO circles(${columns}) VALUES(${fields.map(()=>'?').join(',')})`).run(...fields.map(k=>c[k]));return send(res,201,{id:Number(r.lastInsertRowid)});}if(!id)return send(res,400,{error:'IDが必要です'});db.prepare(`UPDATE circles SET ${fields.map(k=>`${k}=?`).join(',')},updated_at=datetime('now') WHERE id=?`).run(...fields.map(k=>c[k]),id);return send(res,200,{ok:true});}if(req.method==='DELETE'&&id){db.prepare('DELETE FROM circles WHERE id=?').run(id);return send(res,200,{ok:true});}}
 }
 const circlePage=url.pathname.match(/^\/circle\/(\d+)$/);
 if(req.method==='GET'&&circlePage){const c=db.prepare('SELECT * FROM circles WHERE id=? AND published=1 AND verified=1').get(Number(circlePage[1]));if(!c)return send(res,404,{error:'サークルが見つかりません'});const base=siteOrigin(req),canonical=base+'/circle/'+c.id,title=`${c.name}｜${c.university}のサークル｜新歓ナビ`,description=clean(c.description||`${c.university} ${c.campus||''}のサークル情報。活動曜日、時限、場所、活動頻度を新歓ナビで確認できます。`,180),events=db.prepare(`SELECT id,title,description,starts_at,location,capacity FROM events WHERE circle_id=? AND status='open' ORDER BY starts_at,id`).all(c.id),detailRows=[['大学',c.university],['キャンパス',c.campus],['カテゴリ',c.category],['活動曜日',c.days],['活動時限',c.periods?c.periods+'限':'' ],['活動場所',c.location],['活動頻度',c.frequency],['費用',c.cost],['部員数',c.members],['参加条件',c.conditions],['初心者歓迎',c.beginner===1?'はい':c.beginner===0?'いいえ':''],['掛け持ち',c.concurrent===1?'可能':c.concurrent===0?'不可':'']].filter(([,v])=>v!==null&&v!==undefined&&v!=='');const eventHtml=events.length?'<section class="admin-panel"><h2>新歓イベント・体験会</h2>'+events.map(e=>'<article class="application-card"><div><h3>'+htmlEscape(e.title)+'</h3><p>'+(e.starts_at?htmlEscape(new Date(e.starts_at).toLocaleString('ja-JP',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Tokyo'})):'日時未登録')+(e.location?' · '+htmlEscape(e.location):'')+'</p><p>'+htmlEscape(e.description||'')+'</p></div><a class="button primary" href="/account.html?event='+e.id+'">申し込む</a></article>').join('')+'</section>':'<section class="admin-panel"><h2>新歓イベント・体験会</h2><p class="form-note">現在受付中のイベントはありません。</p></section>';const page='<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="'+htmlEscape(description)+'"><meta name="robots" content="index,follow"><link rel="canonical" href="'+htmlEscape(canonical)+'"><meta property="og:type" content="article"><meta property="og:site_name" content="新歓ナビ"><meta property="og:title" content="'+htmlEscape(title)+'"><meta property="og:description" content="'+htmlEscape(description)+'"><meta property="og:url" content="'+htmlEscape(canonical)+'"><title>'+htmlEscape(title)+'</title><link rel="stylesheet" href="/style.css"></head><body><header class="top"><a class="brand" href="/"><span class="brandmark">新</span><b>新歓ナビ</b></a><nav><a href="/#find">サークルを探す</a></nav><div class="top-actions"><a class="button primary" href="/account.html">ログイン・個人登録</a></div></header><main class="account-page"><div class="eyebrow">CIRCLE GUIDE</div><h1>'+htmlEscape(c.name)+'</h1><p class="account-lead">'+htmlEscape(description)+'</p><section class="admin-panel"><h2>活動情報</h2><dl>'+detailRows.map(([k,v])=>'<dt>'+htmlEscape(k)+'</dt><dd>'+htmlEscape(v)+'</dd>').join('')+'</dl>'+(c.verified?'<p class="form-note">✓ 情報確認済み · 最終更新 '+htmlEscape(String(c.updated_at||'').slice(0,10))+'</p>':'')+'</section>'+eventHtml+'<a class="button light" href="/">新歓ナビでほかのサークルを探す</a></main></body></html>';res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'public, max-age=300','x-content-type-options':'nosniff','content-security-policy':"default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"});return res.end(page);}
 if(req.method==='GET'){const path=url.pathname==='/'?'/index.html':url.pathname;const file=resolve(root,'.'+path);if(file!==root&&!file.startsWith(root+sep))return send(res,403,{error:'forbidden'});try{let data=await readFile(file);if(path==='/index.html')data=Buffer.from(data.toString('utf8').replaceAll('{{PUBLIC_SITE_URL}}',htmlEscape(siteOrigin(req))));res.writeHead(200,{'content-type':({'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.csv':'text/csv; charset=utf-8','.json':'application/json; charset=utf-8'}[extname(file)]||'application/octet-stream'),'x-content-type-options':'nosniff','content-security-policy':"default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"});return res.end(data);}catch{return send(res,404,{error:'not found'});}}
 send(res,404,{error:'not found'});
 }catch(e){send(res,400,{error:e.message||'不正なリクエストです'});}});
const port=Number(process.env.PORT||3000),host=process.env.HOST||(process.env.NODE_ENV==='production'?'0.0.0.0':'127.0.0.1');app.listen(port,host,()=>console.log(`新歓ナビ listening on ${host}:${port}`));
