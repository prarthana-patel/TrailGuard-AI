import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID,createHmac,timingSafeEqual} from 'node:crypto';
import {GET,POST,storageHealth} from '../render-dist/server/api.mjs';
const root=resolve(fileURLToPath(new URL('../render-dist/client/',import.meta.url)));
const secret=process.env.SESSION_SECRET||(!process.env.RENDER?randomUUID():null);
if(!secret||secret.length<24)throw new Error('Set SESSION_SECRET to at least 24 random characters before starting on Render.');
const sign=id=>createHmac('sha256',secret).update(id).digest('hex');
function session(req,res){const raw=String(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('tg_session='))?.slice(11)||'';const [id,sig]=raw.split('.');let valid=false;if(/^[0-9a-f-]{36}$/.test(id||'')&&/^[0-9a-f]{64}$/.test(sig||''))valid=timingSafeEqual(Buffer.from(sign(id),'hex'),Buffer.from(sig,'hex'));if(valid)return id;const next=randomUUID();res.setHeader('Set-Cookie',`tg_session=${next}.${sign(next)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${process.env.RENDER?'; Secure':''}`);return next;}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{try{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');
 const base=process.env.RENDER_EXTERNAL_URL||`http://${req.headers.host||'localhost'}`;const url=new URL(req.url||'/',base);
 if(url.pathname==='/healthz'){storageHealth();res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true,mode:'simulation'}));return;}
 if(url.pathname==='/api/mission'){
  if(!['GET','POST'].includes(req.method)){res.writeHead(405);res.end();return;}
  const id=session(req,res);const headers=new Headers();for(const [k,v] of Object.entries(req.headers)){if(v!==undefined&&!['host','cookie','content-length'].includes(k)&&!k.startsWith('oai-'))headers.set(k,Array.isArray(v)?v.join(','):v);}
  headers.set('oai-authenticated-user-id',id);let body;
  if(req.method==='POST'){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>25000){res.writeHead(413);res.end('Request too large');return;}chunks.push(chunk);}body=Buffer.concat(chunks);headers.set('content-length',String(body.length));}
  const request=new Request(new URL('/api/mission',base),{method:req.method,headers,body});
  const response=await (req.method==='POST'?POST(request):GET(request));res.statusCode=response.status;for(const [k,v] of response.headers)res.setHeader(k,v);res.end(Buffer.from(await response.arrayBuffer()));return;
 }
 if(url.pathname.startsWith('/api/')){res.writeHead(404);res.end();return;}
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
 const path=resolve(root,'.'+decodeURIComponent(url.pathname));if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403);res.end();return;}
 let actual=path;try{if(!(await stat(actual)).isFile())actual=resolve(root,'index.html');}catch{if(extname(path)){res.writeHead(404);res.end();return;}actual=resolve(root,'index.html');}
 const bytes=await readFile(actual);res.setHeader('Content-Type',mime[extname(actual)]||'application/octet-stream');res.setHeader('Cache-Control',actual.endsWith('sw.js')||actual.endsWith('.html')?'no-cache':'public, max-age=3600');res.end(req.method==='HEAD'?undefined:bytes);
 }catch(e){console.error('Request failed:',e instanceof Error?e.message:'Unknown error');if(!res.headersSent)res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Server request failed. Please retry.'}));}});
server.requestTimeout=45000;
server.listen(Number(process.env.PORT||10000),'0.0.0.0',()=>console.log('TrailGuard ready on port '+(process.env.PORT||10000)));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
export {server};
