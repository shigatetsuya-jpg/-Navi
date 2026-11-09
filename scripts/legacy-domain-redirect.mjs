// Only the old public hostname migrates. API calls, health probes, and Google
// ownership files stay available so existing integrations/verification survive.
export function legacyDomainDestination(req,url,configuredOrigin){
 if(!['GET','HEAD'].includes(req.method))return null;
 const host=String(req.headers.host||'').toLowerCase().split(':')[0];
 if(host!=='navi-qzh7.onrender.com'||!configuredOrigin)return null;
 if(url.pathname==='/health'||url.pathname==='/api'||url.pathname.startsWith('/api/')||url.pathname.startsWith('/.well-known/')||/^\/google[\w-]+\.html$/.test(url.pathname))return null;
 try{const target=new URL(configuredOrigin);if(target.protocol!=='https:'||target.username||target.password||target.hostname===host)return null;return target.origin+url.pathname+url.search}catch{return null}
}
