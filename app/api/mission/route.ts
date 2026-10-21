import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {seed,State,trace,edges,nodes,invalidate,validate,shortest,savePlan,Incident} from '@/lib/engine';
import {planMission,AIConfig} from '@/lib/agent';
export const dynamic='force-dynamic';
const report=z.object({id:z.string().min(1).max(100),title:z.string().min(3).max(100),description:z.string().min(3).max(1500),node:z.string().refine(v=>nodes.some(n=>n.id===v)),danger:z.boolean(),immobile:z.boolean(),required:z.enum(['medical','rope']),source:z.enum(['Simulated GPS','Text description']),accuracy:z.number().min(0).max(10000).nullable(),fixAt:z.number().min(0),reportedAt:z.number().min(0)});
function cfg(){return env as unknown as AIConfig;}
function owner(req:Request){return req.headers.get('oai-authenticated-user-id')||'private-owner-demo';}
async function read(req:Request){if(!env.DB)throw new Error('Storage not configured');const key=owner(req);await env.DB.prepare('INSERT OR IGNORE INTO workspaces(owner,version,data) VALUES(?,0,?)').bind(key,JSON.stringify(seed())).run();const row=await env.DB.prepare('SELECT version,data FROM workspaces WHERE owner=?').bind(key).first<{version:number;data:string}>();if(!row)throw new Error('Storage read failed');return {key,s:{...JSON.parse(row.data),version:row.version} as State};}
function response(s:State,status=200){return Response.json({state:s,deploymentMode:(env as any).TRAILGUARD_HOST||'sites',aiConnected:!!(cfg().OPENAI_API_KEY&&cfg().OPENAI_MODEL)},{status,headers:{'Cache-Control':'no-store'}});}
export async function GET(req:Request){try{const {s}=await read(req);return response(s);}catch{return Response.json({error:'Could not load server storage. Please retry.'},{status:503});}}
export async function POST(req:Request){try{
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return Response.json({error:'Origin not allowed'},{status:403});
 if(Number(req.headers.get('content-length')||0)>25000)return Response.json({error:'Request too large'},{status:413});
 const b=await req.json() as any;const {key,s}=await read(req);const expected=s.version;
 if(b.action!=='report'&&b.version!==expected)return Response.json({error:'The mission changed. Refresh and review the current version.'},{status:409});
 if(b.action==='report'){
  const value=report.parse(b.report);if(value.reportedAt>Date.now()+60000||value.fixAt>Date.now()+60000)throw new Error('Report timestamps cannot be in the future.');
  if(s.incidents.some(i=>i.id===value.id))return response(s);
  if(s.incidents.length>=10)throw new Error('Demo limit reached: 10 incidents. Export and reset the simulation to continue.');
  s.incidents.push({...value,receivedAt:Date.now()});trace(s,'event','report_received',`${value.id}: persisted by server. Delivery delay ${Math.max(0,Math.round((Date.now()-value.reportedAt)/1000))} seconds.`);invalidate(s,'New incident received');
 }else if(b.action==='plan'){await planMission(s,cfg(),'Coordinator requested plan');
 }else if(b.action==='block'){
  if(!edges.some(e=>e.id===b.edge))throw new Error('Unknown route');s.blocked=s.blocked.includes(b.edge)?s.blocked.filter(id=>id!==b.edge):[...s.blocked,b.edge];invalidate(s,'Route '+b.edge+' updated');await planMission(s,cfg(),'Route accessibility changed');
 }else if(b.action==='team'){
  const t=s.teams.find(t=>t.id===b.team);if(!t)throw new Error('Unknown team');t.available=!t.available;invalidate(s,t.name+' availability updated');await planMission(s,cfg(),'Team availability changed');
 }else if(b.action==='landslide'){
  if(s.incidents.some(i=>i.id==='INC-B'))throw new Error('Landslide incident already exists');const now=Date.now();s.incidents.push({id:'INC-B',title:'Landslide near city',description:'Simulated slope collapse threatens homes at Hillside settlement; immediate danger flagged by coordinator.',node:'slide',danger:true,immobile:false,required:'rope',source:'Text description',accuracy:null,fixAt:now-22*60000,reportedAt:now,receivedAt:now});if(!s.blocked.includes('e3'))s.blocked.push('e3');invalidate(s,'Landslide reported; waterfall approach e3 blocked');await planMission(s,cfg(),'Second incident and route closure');
 }else if(b.action==='approve'||b.action==='reject'){
  if(!s.plan||s.plan.id!==b.planId||s.plan.status!=='review')throw new Error('This plan is not awaiting review.');validate(s,s.plan.assignments);s.plan.status=b.action==='approve'?'approved':'rejected';trace(s,'review',b.action+'_plan',s.plan.id+' · '+(b.action==='approve'?'Approved for simulation only. No dispatch sent.':'Rejected by coordinator.'));
 }else if(b.action==='edit'){
  if(!s.plan||s.plan.id!==b.planId||!['review','approved'].includes(s.plan.status))throw new Error('Generate a current plan first');const assignments=structuredClone(s.plan.assignments);const a=assignments.find(a=>a.incidentId===b.incidentId);if(!a)throw new Error('Unknown assignment');const t=s.teams.find(t=>t.id===b.teamId);if(b.teamId&&!t)throw new Error('Unknown team');const i=s.incidents.find(i=>i.id===a.incidentId)!;const r=t?shortest(t.node,i.node,s.blocked):null;a.teamId=t?.id??null;a.path=r?.path??[];a.minutes=r?.minutes??null;a.reason='Coordinator override. Capability, route and exclusive allocation revalidated.';savePlan(s,assignments,'Human override','Coordinator edited allocation. Fresh approval required.');trace(s,'review','edit_plan','New version created after coordinator override.');
 }else if(b.action==='reset'){
  const fresh=seed();Object.assign(s,fresh);s.version=expected;trace(s,'event','reset_demo','Simulation reset to one trekker incident.');
 }else throw new Error('Unknown action');
 s.version=expected+1;const result=await env.DB!.prepare('UPDATE workspaces SET data=?,version=? WHERE owner=? AND version=?').bind(JSON.stringify(s),s.version,key,expected).run();if(result.meta.changes!==1)return Response.json({error:'Another operation changed the mission. Retry using the current state.'},{status:409});return response(s);
 }catch(e){return Response.json({error:e instanceof z.ZodError?'Invalid report fields. Check the form.':e instanceof Error?e.message:'Request failed'},{status:400});}}
