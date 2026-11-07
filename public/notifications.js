const $=selector=>document.querySelector(selector);
const params=new URLSearchParams(location.search);
let state={circle_subscriptions:[],event_reminders:[]},events=[];
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=value=>value?new Date(value).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',dateStyle:'medium',timeStyle:'short'})+'（日本時間）':'未登録';
function notice(message){$('#notice').textContent=message}
async function api(path,options={}){
 const response=await fetch(path,{...options,headers:{'content-type':'application/json',...options.headers}}),body=await response.json();
 if(!response.ok)throw Error(body.error||'処理できませんでした');return body;
}
async function loadState(){
 state=await api('/api/notifications');
 $('#delivery-status').textContent=state.email_delivery_available?'メール通知の設定を保存できます。':'メール送信は準備中です。希望の設定は保存できますが、送信を開始するまではメールは届きません。';
 const circles=state.circle_subscriptions.map(s=>`<article class="application-card"><p>${esc(s.name)}：新イベント</p><button class="button light" data-stop-circle="${s.circle_id}">この団体の新着通知を停止</button></article>`);
 const reminders=state.event_reminders.map(r=>`<article class="application-card"><p>${esc(r.circle_name)} / ${esc(r.title)}：${r.start_reminders?'開催前 ':''}${r.deadline_reminders?'締切前':''}</p><button class="button light" data-stop-event="${r.event_id}">このイベントの通知を停止</button></article>`);
 $('#active-notifications').innerHTML=[...circles,...reminders].join('')||'<p>通知の設定はありません。</p>';
 $('#new-events').checked=state.circle_subscriptions.some(s=>s.circle_id===Number($('#notification-circle').value));
 eventChoice();
}
function eventChoice(){
 const id=Number($('#notification-event').value),event=events.find(e=>e.id===id),saved=state.event_reminders.find(r=>r.event_id===id);
 $('#start-reminders').checked=!!saved?.start_reminders;$('#deadline-reminders').checked=!!saved?.deadline_reminders;
 $('#start-reminders').disabled=!event?.starts_at||Date.parse(event.starts_at)<=Date.now();$('#deadline-reminders').disabled=!event?.application_deadline||Date.parse(event.application_deadline)<=Date.now();if($('#start-reminders').disabled)$('#start-reminders').checked=false;if($('#deadline-reminders').disabled)$('#deadline-reminders').checked=false;
 $('#event-dates').textContent=event?'開催：'+date(event.starts_at)+' / 申込締切：'+date(event.application_deadline):'';
}
async function circleChoice(){
 const id=Number($('#notification-circle').value);$('#new-events').checked=state.circle_subscriptions.some(s=>s.circle_id===id);
 events=id?await api('/api/notifications/events?circle='+id):[];
 $('#notification-event').innerHTML='<option value="">イベントを選んでください</option>'+events.map(e=>`<option value="${e.id}">${esc(e.title)}</option>`).join('');
 if(params.get('event')&&events.some(e=>String(e.id)===params.get('event')))$('#notification-event').value=params.get('event');
 eventChoice();
}
async function save(path,body){await api(path,{method:'PUT',body:JSON.stringify(body)});await loadState();notice('通知の希望を保存しました。'+(state.email_delivery_available?'':'メール送信は準備中です。'))}
$('#notification-circle').onchange=()=>circleChoice().catch(e=>notice(e.message));$('#notification-event').onchange=eventChoice;
$('#circle-notification-form').onsubmit=async e=>{e.preventDefault();try{await save('/api/notifications/circles/'+$('#notification-circle').value,{new_events:$('#new-events').checked})}catch(error){notice(error.message)}};
$('#event-notification-form').onsubmit=async e=>{e.preventDefault();try{await save('/api/notifications/events/'+$('#notification-event').value,{start_reminders:$('#start-reminders').checked,deadline_reminders:$('#deadline-reminders').checked})}catch(error){notice(error.message)}};
$('#active-notifications').onclick=async e=>{const circle=e.target.closest('[data-stop-circle]'),event=e.target.closest('[data-stop-event]');try{if(circle)await save('/api/notifications/circles/'+circle.dataset.stopCircle,{new_events:false});if(event)await save('/api/notifications/events/'+event.dataset.stopEvent,{start_reminders:false,deadline_reminders:false})}catch(error){notice(error.message)}};
$('#stop-all-notifications').onclick=async()=>{try{await api('/api/notifications',{method:'DELETE',body:'{}'});await loadState();notice('イベント通知をすべて停止しました。')}catch(error){notice(error.message)}};
async function init(){try{
 const {account}=await api('/api/auth/me');
 if(!account?.email_verified){$('#notice').innerHTML='<p>会員登録し、メールアドレスを確認すると通知を設定できます。</p><a class="button primary" href="/account.html">会員登録・ログイン・メール確認</a>';return}
 const circles=await api('/api/circles');$('#notification-circle').innerHTML='<option value="">選んでください</option>'+circles.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
 if(params.get('circle')&&circles.some(c=>String(c.id)===params.get('circle')))$('#notification-circle').value=params.get('circle');
 $('#notification-settings').classList.remove('hidden');await loadState();await circleChoice();notice('希望する通知だけを選んで保存してください。');
}catch(error){notice(error.message)}}init();
