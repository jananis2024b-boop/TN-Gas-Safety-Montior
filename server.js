const express=require('express'),path=require('path');
const {DISTRICTS,CATEGORIES,GAS_BY_CATEGORY,DEFAULT_THRESHOLDS}=require('./data');
const ADMIN_TOKEN=process.env.ADMIN_TOKEN||'admin123';
const DEVICE_KEY=process.env.DEVICE_KEY||'device-secret';
const SIMULATE=process.env.SIMULATE!=='false';
const STALE_MS=+process.env.STALE_MS||60000;   // no data for this long => OFFLINE
const RECOVERY_COUNT=+process.env.RECOVERY_COUNT||2; // consecutive safe readings to resolve an alert
const PORT=process.env.PORT||3000;
const RANK={SAFE:0,WARNING:1,CRITICAL:2,DANGER:3};
const thresholds=JSON.parse(JSON.stringify(DEFAULT_THRESHOLDS));
const companies=new Map(),sensors=new Map(),readings=new Map(),incidents=[];let incSeq=1;

function gasLevel(t,v){
 if(t.mode==='low'){if(v<=t.danger)return'DANGER';if(v<=t.critical)return'CRITICAL';if(v<=t.warning)return'WARNING';return'SAFE';}
 if(v>=t.danger)return'DANGER';if(v>=t.critical)return'CRITICAL';if(v>=t.warning)return'WARNING';return'SAFE';
}
function addSensor(companyId,gas,deviceId,simulated){
 const key=deviceId+'|'+gas;
 sensors.set(key,{key,deviceId,companyId,gas,value:null,ts:null,source:null,safeStreak:0,simulated:!!simulated,sim:{spike:0,lvl:'warning',f:.15+Math.random()*.25}});
 readings.set(key,[]);return sensors.get(key);
}
// ---- REAL COMPANY REGISTRY (data/companies.json, each record cites a source) ----
function loadRegistry(){
 const list=JSON.parse(require('fs').readFileSync(path.join(__dirname,'data','companies.json'),'utf8'));
 list.forEach((c,i)=>{const id=c.id||'CO-'+String(i+1).padStart(3,'0'),gases=c.gases||GAS_BY_CATEGORY[c.category]||['CO'];
  companies.set(id,{...c,id,state:'Tamil Nadu',gases,contact:c.contact||null,website:c.website||null,verified:true,demo:false,recordType:'REAL COMPANY (sourced)',updatedAt:Date.now()});
  if(SIMULATE)gases.forEach(g=>addSensor(id,g,`SIM-${id}-${g}`,true));});
}
loadRegistry();

// ---- Ingestion + alert engine ----
const clients=new Set();let bt=null;
function broadcast(){if(bt)return;bt=setTimeout(()=>{bt=null;clients.forEach(r=>r.write('event: update\ndata: {}\n\n'));},400);}
function ingest(s,value,ts,source){
 const t=thresholds[s.gas],c=companies.get(s.companyId);
 s.value=value;s.ts=ts;s.source=source;
 const h=readings.get(s.key);h.push({ts,value});if(h.length>300)h.shift();
 const lvl=gasLevel(t,value);
 let inc=incidents.find(i=>!i.resolvedAt&&i.companyId===s.companyId&&i.gas===s.gas);
 if(lvl!=='SAFE'){
  s.safeStreak=0;const th=t[lvl.toLowerCase()];
  if(!inc)incidents.push({id:incSeq++,companyId:c.id,companyName:c.name,district:c.district,location:c.location,gas:s.gas,gasName:t.name,level:lvl,peakLevel:lvl,value,unit:t.unit,threshold:th,startedAt:ts,updatedAt:ts,resolvedAt:null,ackBy:null,source});
  else{if(RANK[lvl]>RANK[inc.level])inc.ackBy=null;inc.level=lvl;if(RANK[lvl]>RANK[inc.peakLevel])inc.peakLevel=lvl;inc.value=value;inc.threshold=th;inc.updatedAt=ts;}
 }else if(inc&&++s.safeStreak>=RECOVERY_COUNT){inc.resolvedAt=ts;inc.updatedAt=ts;}
 broadcast();
}
function sensorView(s){
 const t=thresholds[s.gas],inc=incidents.find(i=>!i.resolvedAt&&i.companyId===s.companyId&&i.gas===s.gas);
 const stale=!s.ts||Date.now()-s.ts>STALE_MS;let status;
 if(!s.ts)status='NO_DATA';else if(stale)status=inc?inc.level:'OFFLINE';else status=gasLevel(t,s.value);
 return{gas:s.gas,name:t.name,unit:t.unit,mode:t.mode,value:s.value,ts:s.ts,source:s.source,deviceId:s.deviceId,status,stale,
  thresholds:{warning:t.warning,critical:t.critical,danger:t.danger}};
}
function companyView(c){
 const sv=[...sensors.values()].filter(s=>s.companyId===c.id).map(sensorView);
 let status='NO_SENSOR';
 if(sv.length){const worst=sv.reduce((m,x)=>Math.max(m,RANK[x.status]??0),0);
  if(worst>0)status=Object.keys(RANK).find(k=>RANK[k]===worst);
  else status=sv.some(x=>x.status==='OFFLINE'||x.status==='NO_DATA')?'OFFLINE':'SAFE';}
 const last=sv.reduce((m,x)=>Math.max(m,x.ts||0),0);
 return{...c,status,sensors:sv,hasSensors:sv.length>0,lastReading:last||null,
  dataMode:!sv.length?'REGISTERED, NO SENSORS':sv.some(x=>x.source==='SIMULATED')?'SIMULATED READINGS':'LIVE SENSORS'};
}

// ---- API ----
const app=express();app.use(express.json());app.use(express.static(path.join(__dirname,'public')));
const admin=(q,r,n)=>q.get('x-admin-token')===ADMIN_TOKEN?n():r.status(401).json({error:'Admin token required'});
app.get('/api/meta',(q,r)=>r.json({districts:DISTRICTS,categories:CATEGORIES,thresholds,simulate:SIMULATE,staleMs:STALE_MS}));
app.get('/api/companies',(q,r)=>r.json([...companies.values()].map(companyView)));
app.get('/api/companies/:id/history',(q,r)=>{
 const c=[...sensors.values()].find(s=>s.companyId===q.params.id&&s.gas===q.query.gas);
 r.json(c?readings.get(c.key):[]);});
app.get('/api/alerts',(q,r)=>{
 let l=incidents.slice();if(q.query.state!=='all')l=l.filter(i=>!i.resolvedAt);
 r.json(l.sort((a,b)=>RANK[b.level]-RANK[a.level]||b.updatedAt-a.updatedAt));});
app.post('/api/alerts/:id/ack',admin,(q,r)=>{const i=incidents.find(x=>x.id==q.params.id);if(!i)return r.sendStatus(404);i.ackBy=q.body.user||'admin';broadcast();r.json(i);});
// Sensor/ESP32 ingestion: POST {deviceId,gas,value,ts?} with header x-device-key
app.post('/api/readings',(q,r)=>{
 if(q.get('x-device-key')!==DEVICE_KEY)return r.status(401).json({error:'bad device key'});
 const{deviceId,gas,value}=q.body,v=Number(value);
 const s=sensors.get(deviceId+'|'+gas);
 if(!s||s.simulated)return r.status(404).json({error:'unregistered device/gas'});
 if(!Number.isFinite(v)||v<0||v>1e6)return r.status(400).json({error:'invalid value'});
 ingest(s,v,Date.now(),'DEVICE');r.json({ok:true,status:gasLevel(thresholds[gas],v)});});
app.post('/api/companies',admin,(q,r)=>{
 const b=q.body;if(!b.name||!CATEGORIES.includes(b.category)||!DISTRICTS.find(d=>d.name===b.district)||!b.location)return r.status(400).json({error:'name, category, district, location required'});
 const id=b.id||'CO-'+Date.now();
 companies.set(id,{id,name:b.name,category:b.category,district:b.district,state:'Tamil Nadu',address:b.address||'',location:b.location,source:b.source||null,contact:b.contact||null,website:b.website||null,activity:b.activity||'',gases:b.gases||GAS_BY_CATEGORY[b.category],verified:!!b.verified,demo:false,recordType:b.verified?'VERIFIED':'IMPORTED (unverified)',updatedAt:Date.now()});
 broadcast();r.json(companyView(companies.get(id)));});
app.post('/api/sensors',admin,(q,r)=>{
 const{companyId,gas,deviceId}=q.body;if(!companies.has(companyId)||!thresholds[gas]||!deviceId)return r.status(400).json({error:'companyId, gas, deviceId required'});
 if(sensors.has(deviceId+'|'+gas))return r.status(409).json({error:'sensor already registered'});
 addSensor(companyId,gas,deviceId,false);broadcast();r.json({ok:true});});
app.put('/api/thresholds/:gas',admin,(q,r)=>{
 const t=thresholds[q.params.gas];if(!t)return r.sendStatus(404);
 const n={...t};['warning','critical','danger'].forEach(k=>{if(q.body[k]!==undefined&&q.body[k]!==null&&q.body[k]!==''&&isFinite(q.body[k]))n[k]=+q.body[k];});
 const ok=t.mode==='low'?n.warning>=n.critical&&n.critical>=n.danger:n.warning<=n.critical&&n.critical<=n.danger;
 if(!ok)return r.status(400).json({error:'thresholds must be ordered warning -> critical -> danger ('+(t.mode==='low'?'descending':'ascending')+')'});
 Object.assign(t,n);broadcast();r.json(t);});
app.post('/api/test-alert',(q,r)=>{if(!SIMULATE)return r.status(400).json({error:'simulator is off'});
 const l=[...sensors.values()].filter(s=>s.simulated);if(!l.length)return r.sendStatus(404);const s=l[Math.floor(Math.random()*l.length)];
 s.sim.spike=5;s.sim.lvl=q.body&&q.body.level==='warning'?'warning':'danger';r.json({ok:true});});
app.get('/api/stream',(q,r)=>{r.set({'Content-Type':'text/event-stream','Cache-Control':'no-cache',Connection:'keep-alive'});r.flushHeaders();
 r.write('retry: 3000\n\n');clients.add(r);const k=setInterval(()=>r.write(':ka\n\n'),20000);q.on('close',()=>{clearInterval(k);clients.delete(r);});});

// ---- Simulator (clearly flagged source=SIMULATED; disable with SIMULATE=false) ----
if(SIMULATE)setInterval(()=>{
 sensors.forEach(s=>{if(!s.simulated)return;const t=thresholds[s.gas],m=s.sim,low=t.mode==='low';
  if(m.spike>0)m.spike--;else if(Math.random()<.006){m.spike=5;m.lvl=['warning','critical','danger'][Math.floor(Math.random()*3)];}
  let v;
  if(m.spike>0)v=low?t[m.lvl]-.3:t[m.lvl]*1.1;
  else v=low?20.9+(Math.random()-.5)*.2:t.warning*m.f*(.8+Math.random()*.4);
  ingest(s,+v.toFixed(2),Date.now(),'SIMULATED');});
},3000);
app.use((e,q,r,n)=>r.status(e.status||500).json({error:e.message||'server error'}));
app.listen(PORT,()=>console.log(`TN Gas Monitor on http://localhost:${PORT}  simulate=${SIMULATE}`)).on('error',e=>{console.error(e.code==='EADDRINUSE'?`Port ${PORT} is already in use. Set another one, e.g. PORT=3001.`:e);process.exit(1);});
