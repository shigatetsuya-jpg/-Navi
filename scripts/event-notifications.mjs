import {planEventNotifications} from './event-notification-plan.mjs';
export const EVENT_NOTIFICATION_KINDS=new Set(['new-event','deadline-reminder','start-reminder']);
export const NOTIFICATION_CONSENT_VERSION='2026-11-07-event-email-v1';
const eventQuery=`SELECT e.*,c.name AS circle_name,c.published AS circle_published,c.verified AS circle_verified FROM events e JOIN circles c ON c.id=e.circle_id`;
function subscription(db,event,accountId,kind){
 const row=kind==='new-event'
  ?db.prepare('SELECT * FROM circle_notification_subscriptions WHERE account_id=? AND circle_id=?').get(accountId,event.circle_id)
  :db.prepare('SELECT * FROM event_reminders WHERE account_id=? AND event_id=?').get(accountId,event.id);
 return row?{...row,account_id:accountId,enabled:true,new_events:kind==='new-event'&&row.new_events===1,deadline_reminders:kind==='deadline-reminder'&&row.deadline_reminders===1,start_reminders:kind==='start-reminder'&&row.start_reminders===1}:null;
}
export function eventNotificationPayload(event){return {eventTitle:event.title,circleName:event.circle_name,circleId:event.circle_id,eventId:event.id,startsAt:event.starts_at,deadline:event.application_deadline,location:event.location}}
// Called again immediately before handing an email to the provider. Never trust
// a queued snapshot for permission, dates, visibility, or current email address.
export function currentEventNotification(db,row,now=Date.now()){
 const record=db.prepare('SELECT * FROM event_notification_deliveries WHERE outbox_id=?').get(row.id);
 if(!record||record.kind!==row.kind)return null;
 const account=db.prepare('SELECT email,email_verified FROM accounts WHERE id=?').get(record.account_id);
 if(!account?.email_verified||account.email!==row.recipient)return null;
 const event=db.prepare(eventQuery+' WHERE e.id=?').get(record.event_id);
 if(!event)return null;
 const choice=subscription(db,event,record.account_id,row.kind);
 const eligible=planEventNotifications({event,subscription:choice,now}).some(p=>p.kind===row.kind);
 return eligible?eventNotificationPayload(event):null;
}
// At most 200 new deliveries per pass, one transaction for both the durable
// once-only key and the outbox. Read candidates afresh on every pass/restart.
export function queueEventNotifications(db,{now=Date.now(),max=200}={}){
 let queued=0;db.exec('BEGIN IMMEDIATE');
 try{
  const candidates=db.prepare(`SELECT e.id AS event_id,s.account_id,'new-event' AS kind FROM events e JOIN circle_notification_subscriptions s ON s.circle_id=e.circle_id WHERE e.status='open' AND s.new_events=1
   UNION ALL SELECT r.event_id,r.account_id,'deadline-reminder' FROM event_reminders r JOIN events e ON e.id=r.event_id WHERE e.status='open' AND r.deadline_reminders=1
   UNION ALL SELECT r.event_id,r.account_id,'start-reminder' FROM event_reminders r JOIN events e ON e.id=r.event_id WHERE e.status='open' AND r.start_reminders=1`).all();
  for(const candidate of candidates){
   if(queued>=max)break;
   if(db.prepare('SELECT 1 FROM event_notification_deliveries WHERE account_id=? AND event_id=? AND kind=?').get(candidate.account_id,candidate.event_id,candidate.kind))continue;
   const account=db.prepare('SELECT email,email_verified FROM accounts WHERE id=?').get(candidate.account_id);if(!account?.email_verified)continue;
   const event=db.prepare(eventQuery+' WHERE e.id=?').get(candidate.event_id);
   const plans=planEventNotifications({event,subscription:subscription(db,event,candidate.account_id,candidate.kind),now});
   if(!plans.some(p=>p.kind===candidate.kind))continue;
   const inserted=db.prepare('INSERT INTO email_outbox(recipient,kind,payload_json) VALUES(?,?,?)').run(account.email,candidate.kind,JSON.stringify(eventNotificationPayload(event)));
   db.prepare('INSERT INTO event_notification_deliveries VALUES(?,?,?,?)').run(candidate.account_id,candidate.event_id,candidate.kind,Number(inserted.lastInsertRowid));queued++;
  }
  db.exec('COMMIT');return queued;
 }catch(error){db.exec('ROLLBACK');throw error}
}
export function notificationRoutes({db,getAccount,send,parseBody,emailEnabled}){
 // Cancellation is checked against current choices so other accounts' mail is
 // never affected. Keep the durable keys to avoid repeated notifications.
 function cancel(accountId){for(const row of db.prepare(`SELECT o.* FROM email_outbox o JOIN event_notification_deliveries d ON d.outbox_id=o.id WHERE d.account_id=? AND o.status='pending'`).all(accountId))if(!currentEventNotification(db,row))db.prepare("UPDATE email_outbox SET status='failed',payload_json='{}',last_error='Notification stopped' WHERE id=? AND status='pending'").run(row.id)}
 return async(req,res,url)=>{
  if(!url.pathname.startsWith('/api/notifications'))return false;
  const account=getAccount(req);
  if(!account)return send(res,401,{error:'会員登録・ログインすると使えます'}),true;
  if(!account.email_verified)return send(res,403,{error:'メール確認後に通知を設定できます'}),true;
  const now=new Date().toISOString();
  if(url.pathname==='/api/notifications/events'&&req.method==='GET'){const circleId=Number(url.searchParams.get('circle'));return send(res,200,db.prepare("SELECT e.id,e.title,e.starts_at,e.application_deadline FROM events e JOIN circles c ON c.id=e.circle_id WHERE e.circle_id=? AND e.status='open' AND c.published=1 AND c.verified=1 AND (e.starts_at IS NULL OR e.starts_at='' OR julianday(e.starts_at)>julianday('now')) ORDER BY e.starts_at,e.id").all(circleId)),true;}
  if(url.pathname==='/api/notifications'&&req.method==='GET'){
   return send(res,200,{email_delivery_available:emailEnabled(),circle_subscriptions:db.prepare('SELECT s.circle_id,s.new_events,c.name FROM circle_notification_subscriptions s JOIN circles c ON c.id=s.circle_id WHERE s.account_id=? AND s.new_events=1').all(account.id),event_reminders:db.prepare('SELECT r.event_id,r.deadline_reminders,r.start_reminders,e.title,e.starts_at,e.application_deadline,c.name AS circle_name FROM event_reminders r JOIN events e ON e.id=r.event_id JOIN circles c ON c.id=e.circle_id WHERE r.account_id=? AND (r.deadline_reminders=1 OR r.start_reminders=1)').all(account.id)}),true;
  }
  if(url.pathname==='/api/notifications'&&req.method==='DELETE'){
   db.exec('BEGIN IMMEDIATE');try{db.prepare('UPDATE circle_notification_subscriptions SET new_events=0,updated_at=? WHERE account_id=?').run(now,account.id);db.prepare('UPDATE event_reminders SET deadline_reminders=0,start_reminders=0,updated_at=? WHERE account_id=?').run(now,account.id);cancel(account.id);db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}return send(res,200,{ok:true}),true;
  }
  const match=url.pathname.match(/^\/api\/notifications\/(circles|events)\/(\d+)$/);
  if(!match||req.method!=='PUT')return send(res,404,{error:'設定が見つかりません'}),true;
  const body=await parseBody(req),id=Number(match[2]);
  if(match[1]==='circles'){
   if(typeof body.new_events!=='boolean')return send(res,400,{error:'新イベント通知の希望を選択してください'}),true;
   if(body.new_events&&!db.prepare('SELECT 1 FROM circles WHERE id=? AND published=1 AND verified=1').get(id))return send(res,404,{error:'公開中の団体が見つかりません'}),true;
   if(body.new_events)db.prepare(`INSERT INTO circle_notification_subscriptions VALUES(?,?,1,?,?,?) ON CONFLICT(account_id,circle_id) DO UPDATE SET new_events=1,followed_at=CASE WHEN new_events=0 THEN excluded.followed_at ELSE followed_at END,updated_at=excluded.updated_at,consent_version=excluded.consent_version`).run(account.id,id,now,now,NOTIFICATION_CONSENT_VERSION);
   else db.prepare('UPDATE circle_notification_subscriptions SET new_events=0,updated_at=? WHERE account_id=? AND circle_id=?').run(now,account.id,id);
  }else{
   if(typeof body.deadline_reminders!=='boolean'||typeof body.start_reminders!=='boolean')return send(res,400,{error:'締切前・開催前の通知の希望を選択してください'}),true;
   if(body.deadline_reminders||body.start_reminders){
    const event=db.prepare(eventQuery+" WHERE e.id=? AND e.status='open' AND c.published=1 AND c.verified=1").get(id);
    if(!event)return send(res,404,{error:'公開中のイベントが見つかりません'}),true;
    const future=v=>typeof v==='string'&&/(Z|[+-]\d{2}:\d{2})$/.test(v)&&Date.parse(v)>Date.now();
    if(body.start_reminders&&!future(event.starts_at)||body.deadline_reminders&&!future(event.application_deadline)||event.starts_at&&Date.parse(event.starts_at)<=Date.now())return send(res,400,{error:'通知対象の日時が未登録か、過ぎています'}),true;
    db.prepare(`INSERT INTO event_reminders VALUES(?,?,?,?,?,?,?) ON CONFLICT(account_id,event_id) DO UPDATE SET deadline_reminders=excluded.deadline_reminders,start_reminders=excluded.start_reminders,followed_at=CASE WHEN deadline_reminders=0 AND start_reminders=0 THEN excluded.followed_at ELSE followed_at END,updated_at=excluded.updated_at,consent_version=excluded.consent_version`).run(account.id,id,Number(body.deadline_reminders),Number(body.start_reminders),now,now,NOTIFICATION_CONSENT_VERSION);
   }else db.prepare('UPDATE event_reminders SET deadline_reminders=0,start_reminders=0,updated_at=? WHERE account_id=? AND event_id=?').run(now,account.id,id);
  }
  cancel(account.id);return send(res,200,{ok:true}),true;
 }
}
