// Pure scheduling rules, deliberately disconnected from delivery and production.
// Callers must persist a unique key per account/event/kind before enqueueing.
const HOUR=60*60*1000;
function instant(value){if(typeof value!=='string'||!/(Z|[+-]\d{2}:\d{2})$/.test(value))return NaN;return Date.parse(value)}
export function planEventNotifications({event,subscription,now,sentKeys=[]}){
 if(!Number.isFinite(now)||!event||!subscription||!Number.isSafeInteger(event.id)||event.id<1||!Number.isSafeInteger(subscription.account_id)||subscription.account_id<1)return [];
 if(subscription.enabled!==true||event.status!=='open'||event.circle_published!==1||event.circle_verified!==1)return [];
 const followed=instant(subscription.followed_at),published=instant(event.first_published_at),starts=instant(event.starts_at),deadline=instant(event.application_deadline);
 if(!Number.isFinite(followed)||followed>now||!Number.isFinite(published)||published>now||Number.isFinite(starts)&&starts<=now)return [];
 const sent=new Set(sentKeys),plans=[];
 function add(kind,due,expires){const key=`event:${event.id}:account:${subscription.account_id}:${kind}`;if(Number.isFinite(due)&&now>=due&&now<expires&&!sent.has(key))plans.push({key,event_id:event.id,account_id:subscription.account_id,kind,due_at:new Date(due).toISOString(),expires_at:new Date(expires).toISOString()})}
 if(subscription.new_events===true&&published>=followed)add('new-event',published,Math.min(published+24*HOUR,Number.isFinite(starts)?starts:Infinity,Number.isFinite(deadline)?deadline:Infinity));
 if(subscription.deadline_reminders===true&&Number.isFinite(deadline))add('deadline-reminder',Math.max(published,followed,deadline-24*HOUR),deadline);
 if(subscription.start_reminders===true&&Number.isFinite(starts))add('start-reminder',Math.max(published,followed,starts-24*HOUR),starts);
 return plans;
}
