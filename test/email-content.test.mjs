import test from 'node:test';
import assert from 'node:assert/strict';
import { renderNotificationEmail } from '../scripts/render-email.mjs';
const options={from:'ワセサークルナビ <notify@example.test>',origin:'https://example.test'};
function render(kind,values){return renderNotificationEmail({recipient:'recipient@example.test',kind,payload_json:JSON.stringify({circleName:'Music & Games',eventTitle:'Trial <Session>',...values})},options)}
test('plain-text notifications include the actual status and HTML is escaped',()=>{
 for(const label of ['承認','見送り','キャンセル待ちから受付中']){
 const mail=render('application-status',{statusLabel:label});assert.ok(mail.text.includes('申込状況：'+label));assert.ok(mail.text.includes('Music & Games'));assert.ok(mail.text.includes('Trial <Session>'));assert.ok(mail.html.includes('Music &amp; Games'));assert.ok(mail.html.includes('Trial &lt;Session&gt;'));assert.ok(!mail.html.includes('<Session>'));assert.ok(mail.text.includes('https://example.test/dashboard.html'));
 }
 assert.ok(render('application-received',{status:'waitlisted'}).text.includes('キャンセル待ち'));
 assert.ok(render('application-received',{status:'pending'}).text.includes('申し込みを受け付け'));
 assert.ok(render('organization-new-application',{}).text.includes('団体画面で新しい申込'));
});
test('verification email includes the confirmation link without application data',()=>{
 const mail=render('email-verification',{token:'test-token'});assert.ok(mail.text.includes('https://example.test/account.html?verify=test-token'));assert.ok(mail.text.includes('24時間'));assert.ok(!mail.text.includes('Music'));assert.deepEqual(mail.to,['recipient@example.test']);assert.equal(mail.from,options.from);
});
