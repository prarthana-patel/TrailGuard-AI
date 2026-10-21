import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const directory=await mkdtemp(join(tmpdir(),'trailguard-render-'));
process.env.PORT='0';process.env.TRAILGUARD_DB_PATH=join(directory,'test.sqlite');
const {server}=await import('./server.mjs');
try{
 if(!server.listening)await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;
 assert.equal((await fetch(base+'/healthz')).status,200);
 const first=await fetch(base+'/api/mission');assert.equal(first.status,200);const cookie=first.headers.get('set-cookie').split(';')[0];let state=(await first.json()).state;
 async function post(data,status=200){const r=await fetch(base+'/api/mission',{method:'POST',headers:{Cookie:cookie,Origin:base,'Content-Type':'application/json'},body:JSON.stringify({...data,version:state.version})});assert.equal(r.status,status,await r.clone().text());const body=await r.json();if(body.state)state=body.state;return body;}
 await post({action:'plan'});assert.equal(state.plan.assignments[0].teamId,'alpha');const originalId=state.plan.id;
 await post({action:'approve',planId:originalId});assert.equal(state.plan.status,'approved');
 await post({action:'landslide'});assert.equal(state.plan.status,'review');assert.equal(state.incidents.length,2);assert(state.history.some(p=>p.id===originalId&&p.status==='invalidated'));
 await post({action:'edit',planId:state.plan.id,incidentId:'INC-A',teamId:'alpha'},400);
 await post({action:'team',team:'alpha'});assert.equal(state.plan.assignments[0].incidentId,'INC-B');assert.equal(state.plan.assignments[1].teamId,null);
 const report={...state.incidents[0],id:'RETRY-REPORT',reportedAt:Date.now(),fixAt:Date.now()};await post({action:'report',report});const count=state.incidents.length;await post({action:'report',report});assert.equal(state.incidents.length,count);
 const second=await fetch(base+'/api/mission',{headers:{'oai-authenticated-user-id':'private-owner-demo'}});assert.equal((await second.json()).state.incidents.length,1);
 const badOrigin=await fetch(base+'/api/mission',{method:'POST',headers:{Cookie:cookie,Origin:'https://wrong.invalid','Content-Type':'application/json'},body:JSON.stringify({action:'plan',version:state.version})});assert.equal(badOrigin.status,403);
 assert.equal((await fetch(base+'/')).status,200);assert.equal((await fetch(base+'/offline.html')).status,200);assert.equal((await fetch(base+'/sw.js')).status,200);
 console.log('PASS: Render server health, client assets, sessions, planning, approval invalidation, override validation, prioritization, idempotent reporting and origin protection.');
}finally{await new Promise(resolve=>server.close(resolve));await rm(directory,{recursive:true,force:true});}
