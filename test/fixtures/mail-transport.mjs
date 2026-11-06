// Child-process test transport: never contacts Resend or any external host.
import { appendFileSync } from 'node:fs';
const interval=globalThis.setInterval;
globalThis.setInterval=(fn,ms,...args)=>interval(fn,ms===15000?25:ms,...args);
globalThis.fetch=async(url,options)=>{
 if(String(url)!=='https://api.resend.com/emails')throw Error('Unexpected external request');
 const mail=JSON.parse(options.body);
 appendFileSync(process.env.TEST_MAIL_LOG,JSON.stringify({mail,key:options.headers['idempotency-key']})+'\n');
 return new Response('{}',{status:mail.to[0]==='retry@example.test'?503:mail.to[0]==='invalid@example.test'?400:200});
};
