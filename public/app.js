const COL={SAFE:'#22c55e',WARNING:'#eab308',CRITICAL:'#f97316',DANGER:'#ef4444',OFFLINE:'#64748b',NO_SENSOR:'#475569',NO_DATA:'#64748b'};
const LBL={SAFE:'SAFE',WARNING:'WARNING',CRITICAL:'CRITICAL',DANGER:'DANGER',OFFLINE:'DATA UNAVAILABLE',NO_SENSOR:'NO SENSOR',NO_DATA:'NO DATA'};
const RK={DANGER:5,CRITICAL:4,WARNING:3,OFFLINE:2,NO_DATA:2,NO_SENSOR:1,SAFE:0},AR={DANGER:3,CRITICAL:2,WARNING:1};
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const S={meta:null,co:[],al:[],district:'',sel:null,selGas:null,buzz:false,silenced:false};
const tm=t=>t?new Date(t).toLocaleTimeString():'—',badge=s=>`<span class="bdg" style="background:${COL[s]}">${LBL[s]||s}</span>`;
const api=u=>fetch(u).then(r=>{if(!r.ok)throw new Error(u+' HTTP '+r.status);return r.json();});

// ---------- Alarm sound (Web Audio) ----------
let ac;
function tone(f,t0,d,type,v){const o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.value=f;g.gain.setValueAtTime(v,t0);g.gain.setValueAtTime(0,t0+d);o.connect(g);g.connect(ac.destination);o.start(t0);o.stop(t0+d+.02);}
function buzzer(level){if(!S.buzz||!ac)return;ac.resume();const t=ac.currentTime;
 if(level==='DANGER')for(let i=0;i<8;i++)tone(i%2?720:980,t+i*.18,.16,'square',.25);
 else if(level==='CRITICAL')for(let i=0;i<3;i++)tone(800,t+i*.4,.25,'square',.2);
 else{tone(600,t,.2,'sine',.18);tone(600,t+.35,.2,'sine',.18);}}
$('#go').onclick=()=>{ac=new(window.AudioContext||window.webkitAudioContext)();ac.resume();S.buzz=true;buzzer('WARNING');$('#start').style.display='none';};
$('#silence').onclick=()=>{S.silenced=!S.silenced;$('#silence').textContent=S.silenced?'🔊 Unsilence':'🔇 Silence';};
$('#test').onclick=()=>fetch('/api/test-alert',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"level":"danger"}'}).then(r=>{if(!r.ok)alert('Test alert needs the simulator (SIMULATE not false).');});
const seen={};
function checkBuzzer(){let top=null;
 S.al.forEach(a=>{const p=seen[a.id]||0;if(AR[a.level]>p){seen[a.id]=AR[a.level];if(!top||AR[a.level]>AR[top])top=a.level;}});
 if(top){S.silenced=false;$('#silence').textContent='🔇 Silence';buzzer(top);}}
setInterval(()=>{if(!S.silenced&&S.al.some(a=>a.level==='DANGER'))buzzer('DANGER');},6000); // repeats while any DANGER is active

// ---------- Render ----------
const inD=()=>S.co.filter(c=>c.district===S.district).sort((a,b)=>RK[b.status]-RK[a.status]||a.name.localeCompare(b.name));
function render(){renderBanner();renderAlerts();renderDistrict();renderCompanies();$('#sync').textContent='Last sync '+(S.sync?S.sync.toLocaleTimeString():'—');}
function renderBanner(){const sim=S.co.some(c=>c.dataMode==='SIMULATED READINGS');
 $('#banner').style.display=sim?'block':'none';
 $('#banner').textContent='⚠ Company names are real (sourced, see details). Gas readings and alert levels are SIMULATED — they are NOT actual conditions at these companies. Connect real sensors via the API (README) for live data.';}
function renderAlerts(){const a=S.al;
 $('#alerts').innerHTML=`<h2>🚨 Live alerts — Warning / Critical / Danger (${a.length})</h2>`+(a.length?a.map(x=>`<div class="al ${x.level}" style="border-color:${COL[x.level]}">
 <div>${badge(x.level)} ${x.source==='SIMULATED'?'<span class="bdg sim">SIMULATED</span>':''} <span class="muted">${tm(x.updatedAt)}</span></div>
 <div style="margin-top:4px"><b>${esc(x.companyName)}</b></div>
 <div class="muted">District: <b style="color:#e2e8f0">${esc(x.district)}</b> · Location: <b style="color:#e2e8f0">${esc(x.location)}</b></div>
 <div>${esc(x.gasName)}: <b>${x.value} ${esc(x.unit)}</b> <span class="muted">(limit ${x.threshold} ${esc(x.unit)})</span></div>
 <button onclick="openCo('${x.companyId}')" style="margin-top:5px">Details</button></div>`).join(''):'<p style="color:#4ade80;margin:0">No active alerts.</p>');}
function renderDistrict(){const sel=$('#district'),cur=S.district;
 if(!sel.options.length||sel.dataset.n!=S.co.length+'')sel.dataset.n=S.co.length,sel.innerHTML='<option value="">— Choose district —</option>'+S.meta.districts.map(d=>{const n=S.co.filter(c=>c.district===d.name).length;return`<option value="${d.name}">${d.name} (${n} ${n===1?'company':'companies'})</option>`}).join('');
 sel.value=cur;
 const have=new Set(S.co.map(c=>c.district)).size;
 $('#note').textContent=`Verified company records currently exist for ${have} of ${S.meta.districts.length} districts. Districts with none show an empty list rather than invented names.`;}
function renderCompanies(){const d=S.district,l=d?inD():[];
 $('#ctitle').textContent=d?`Gas-related companies in ${d} (${l.length})`:'Companies';
 $('#companies').innerHTML=!d?'<p class="muted">Select a district above to see its companies.</p>':l.length?l.map(c=>`<div class="co" onclick="openCo('${c.id}')"><div>${badge(c.status)}</div><div style="margin:4px 0"><b>${esc(c.name)}</b></div><div class="muted">${esc(c.category)}<br>📍 ${esc(c.location)}</div></div>`).join(''):`<p class="muted" style="grid-column:1/-1">No verified company record for ${esc(d)} yet. None are shown instead of making names up — add real ones in data/companies.json.</p>`;}

// ---------- Details ----------
function openCo(id){const c=S.co.find(x=>x.id===id);if(!c)return;S.sel=id;S.selGas=(c.sensors.find(s=>s.gas===S.selGas)||c.sensors[0]||{}).gas;renderDetail();}
async function renderDetail(){const c=S.co.find(x=>x.id===S.sel);if(!c)return;const d=$('#detail');d.style.display='block';
 const rows=[['Category',c.category],['Activity',c.activity],['District',c.district+', Tamil Nadu'],['Location',c.location],['Gases monitored',c.gases.join(', ')],['Contact',c.contact||'Not provided'],['Last reading',c.lastReading?new Date(c.lastReading).toLocaleString():'No data'],['Note',c.note||'—']];
 d.innerHTML=`<button onclick="S.sel=null;$('#detail').style.display='none'" style="float:right">✕ Close</button><h2>${esc(c.name)}</h2>
 <p>${badge(c.status)} <span class="bdg" style="background:#38bdf8">${esc(c.recordType)}</span> <span class="bdg" style="background:#94a3b8">${esc(c.dataMode)}</span></p>
 <table>${rows.map(([a,b])=>`<tr><td class="muted">${a}</td><td>${esc(b)}</td></tr>`).join('')}
 <tr><td class="muted">Source of record</td><td>${c.source?`<a style="color:#38bdf8;word-break:break-all" href="${esc(c.source)}" target="_blank" rel="noopener">${esc(c.source)}</a>`:'—'}</td></tr></table>
 <h3>Gas readings</h3>${c.sensors.length?`<table><tr><th>Gas</th><th>Value</th><th>W/C/D</th><th>Status</th><th>Time</th></tr>${c.sensors.map(s=>`<tr style="cursor:pointer" onclick="S.selGas='${s.gas}';renderDetail()"><td>${esc(s.name)}</td><td>${s.value??'—'} ${esc(s.unit)}</td><td class="muted">${s.thresholds.warning}/${s.thresholds.critical}/${s.thresholds.danger}</td><td>${badge(s.status)}</td><td>${tm(s.ts)}${s.source==='SIMULATED'?' (sim)':''}</td></tr>`).join('')}</table>`:'<p class="muted">No sensors registered. Status is not considered safe.</p>'}
 <canvas id="ch" style="width:100%;height:180px;background:#0b1220;border-radius:6px;margin-top:8px"></canvas>`;
 if(S.selGas&&c.sensors.length){const h=await api(`/api/companies/${c.id}/history?gas=${S.selGas}`);draw($('#ch'),h,c.sensors.find(s=>s.gas===S.selGas));}}
function draw(cv,h,s){if(!cv)return;const w=cv.width=cv.clientWidth,ht=cv.height=180,x=cv.getContext('2d');if(!h.length||!s)return;
 const vals=h.map(p=>p.value).concat(Object.values(s.thresholds)),mn=Math.min(...vals),mx=Math.max(...vals),Y=v=>ht-12-(v-mn)/((mx-mn)||1)*(ht-26);
 [['warning',COL.WARNING],['critical',COL.CRITICAL],['danger',COL.DANGER]].forEach(([k,c])=>{x.strokeStyle=c;x.setLineDash([4,4]);x.beginPath();x.moveTo(0,Y(s.thresholds[k]));x.lineTo(w,Y(s.thresholds[k]));x.stroke();});
 x.setLineDash([]);x.strokeStyle='#38bdf8';x.beginPath();h.forEach((p,i)=>{const px=i/Math.max(h.length-1,1)*w;i?x.lineTo(px,Y(p.value)):x.moveTo(px,Y(p.value));});x.stroke();
 x.fillStyle='#94a3b8';x.fillText(`${s.name} (${s.unit}) – last ${h.length} readings`,6,12);}

async function load(){try{[S.co,S.al]=await Promise.all([api('/api/companies'),api('/api/alerts')]);}catch(e){$('#sync').textContent='Server unreachable – retrying…';return;}
 S.sync=new Date();checkBuzzer();render();if(S.sel)renderDetail();}
(async()=>{S.meta=await api('/api/meta');$('#district').onchange=e=>{S.district=e.target.value;renderCompanies();};
 await load();let t;new EventSource('/api/stream').addEventListener('update',()=>{clearTimeout(t);t=setTimeout(load,300);});setInterval(load,15000);})();
