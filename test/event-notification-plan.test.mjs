import test from 'node:test';import assert from 'node:assert/strict';
import {planEventNotifications} from '../scripts/event-notification-plan.mjs';
const event={id:1,status:'open',circle_published:1,circle_verified:1,first_published_at:'2027-04-01T00:00:00Z',starts_at:'2027-04-04T04:00:00Z',application_deadline:'2027-04-03T00:00:00Z'};
const subscription={account_id:7,enabled:true,followed_at:'2027-03-31T00:00:00Z',new_events:true,deadline_reminders:true,start_reminders:true};
const plan=(at,e={},s={},sentKeys=[])=>planEventNotifications({event:{...event,...e},subscription:{...subscription,...s},now:Date.parse(at),sentKeys});
test('new event only after following, once per persisted key',()=>{
 const first=plan('2027-04-01T01:00:00Z');assert.deepEqual(first.map(x=>x.kind),['new-event']);assert.deepEqual(plan('2027-04-01T02:00:00Z',{}, {},[first[0].key]),[]);
 assert.deepEqual(plan('2027-04-01T03:00:00Z',{}, {followed_at:'2027-04-01T02:00:00Z'}),[]);
 assert.ok(!plan('2027-04-02T00:00:00Z').some(x=>x.kind==='new-event'));
});
test('deadline and start reminders use separate 24-hour windows',()=>{
 assert.deepEqual(plan('2027-04-02T00:00:00Z').map(x=>x.kind),['deadline-reminder']);
 assert.deepEqual(plan('2027-04-03T01:00:00Z'),[]);
 assert.deepEqual(plan('2027-04-03T04:00:00Z').map(x=>x.kind),['start-reminder']);
 assert.deepEqual(plan('2027-04-04T04:00:00Z'),[]);
});
test('notification choices and circle visibility are enforced',()=>{
 for(const s of [{enabled:false},{new_events:false}])assert.deepEqual(plan('2027-04-01T01:00:00Z',{},s),[]);
 for(const e of [{status:'closed'},{status:'draft'},{circle_published:0},{circle_verified:0}])assert.deepEqual(plan('2027-04-01T01:00:00Z',e),[]);
 assert.deepEqual(plan('2027-04-02T01:00:00Z',{}, {deadline_reminders:false}),[]);
 assert.deepEqual(plan('2027-04-03T05:00:00Z',{}, {start_reminders:false}),[]);
});
test('missing dates and timezone-ambiguous input never invent a reminder time',()=>{
 assert.deepEqual(plan('2027-04-03T05:00:00Z',{starts_at:'',application_deadline:''}),[]);
 assert.deepEqual(plan('2027-04-01T01:00:00Z',{first_published_at:'2027-04-01T00:00:00'}),[]);
 assert.deepEqual(plan('2027-04-01T01:00:00Z',{}, {followed_at:'invalid'}),[]);
});
test('closed application deadline does not imply the follower has or has not registered',()=>{
 const reminders=plan('2027-04-03T05:00:00Z');assert.equal(reminders[0].kind,'start-reminder');assert.ok(!('application_status' in reminders[0]));
});
