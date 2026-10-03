import {normalizedName,FRANCHISE_DATA,mlbSnapshots,appendSnapshots} from './data-import.js';
import {applyAutoScores} from './legends.js';
import {validateStatImports} from './model.js';
export const searchURL=name=>`https://statsapi.mlb.com/api/v1/people/search?names=${encodeURIComponent(name)}&sportIds=1`;
export const statsURL=id=>`https://statsapi.mlb.com/api/v1/people/${id}/stats?stats=yearByYear&group=hitting,pitching&sportIds=1`;
export function matchPeople(name,people){
 const unique=[...new Map((Array.isArray(people)?people:[]).filter(p=>Number.isInteger(p.id)&&p.id>0&&typeof p.fullName==='string').map(p=>[p.id,p])).values()];
 const exact=unique.filter(p=>normalizedName(p.fullName)===normalizedName(name));
 return {automatic:exact.length===1?exact[0]:null,choices:exact.length?exact:unique.slice(0,30)};
}
export async function mlbJSON(url,signal){
 const timeout=new AbortController();const cancel=()=>timeout.abort();if(signal?.aborted)throw new DOMException('Stopped','AbortError');signal?.addEventListener('abort',cancel,{once:true});const timer=setTimeout(()=>timeout.abort(),20000);
 try{const r=await fetch(url,{mode:'cors',credentials:'omit',signal:timeout.signal});if(!r.ok){const error=Error(r.status===429?'MLB is busy. Try again later.':`MLB returned HTTP ${r.status}. Try again later.`);error.stopBatch=r.status===429||r.status>=500;throw error;}return await r.json();}
 catch(e){if(signal?.aborted)throw new DOMException('Stopped','AbortError');if(e.name==='AbortError')throw Error('MLB timed out. Retry this player.');if(e instanceof TypeError)throw Error('MLB could not be reached. Retry or use table import.');throw e;}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
}
export async function resolveCandidate(name,request=mlbJSON,signal){const data=await request(searchURL(name),signal);if(signal?.aborted)throw new DOMException('Stopped','AbortError');return matchPeople(name,data.people);}
export async function fetchFranchise(player,team,from,to,request=mlbJSON,signal){
 if(!Number.isInteger(player.id)||player.id<=0)throw Error('Invalid MLB player.');
 const data=await request(statsURL(player.id),signal);if(signal?.aborted)throw new DOMException('Stopped','AbortError');
 return validateStatImports(mlbSnapshots(data,player,team,from,to));
}
export function mergePlayerStats(candidate,tables,player,autoStats=true){
 let next=appendSnapshots(candidate,tables);if(!next.role)next.role=player.primaryPosition?.name||'';if(player.pitchHand?.code&&['L','R','S'].includes(player.pitchHand.code))next.profile.throws=player.pitchHand.code;next.sample=false;
 for(const t of tables)if(t.url&&!next.sources.includes(t.url))next.sources=[next.sources,t.url].filter(Boolean).join('\n');
 return autoStats?applyAutoScores(next):next;
}
export function createBulkLookup({getBoard,getTeam,openModal,mutate,esc,toast}){
 const $=s=>document.querySelector(s);let session=0,controller=null,onClose=null;
 function open(ids=null,autoStart=false){
  controller?.abort();const mine=++session,b=getBoard(),team=getTeam()[0],config=FRANCHISE_DATA[team];let rows=[],running=false,from=config[2],to=new Date().getFullYear();
  const alive=()=>mine===session&&getBoard()===b&&$('#modal').open&&!!$('#bulk-results');
  const eligible=()=>b.candidates.filter(c=>c.type==='Player'&&(!ids||ids.includes(c.id)));
  openModal('Fetch team stats',`<div class="modal-body bulk-lookup"><h3>${esc(getTeam()[1])}</h3><p>Look up the players already on this board. Unique full-name matches save automatically; other matches wait for your review. Only this franchise’s returned regular-season stats are saved.</p><div class="import-year-fields"><label>From season<input id="bulk-from" type="number" min="1800" max="2100" value="${from}"></label><label>Through season<input id="bulk-to" type="number" min="1800" max="2100" value="${to}"></label></div><p class="help">Set years to match your franchise scope. Names are sent to MLB’s stats service. Keep this dialog open while the lookup runs.</p><label class="bulk-option"><input id="bulk-missing" type="checkbox" checked> Only players without saved MLB stats</label><p class="help">${b.autoStats!==false?'The scoring assistant fills available statistical ratings.':'Automatic scoring is paused for this franchise.'} Manual ratings, FLS points, notes, and ranking order are preserved.</p><div class="import-action-row"><button class="primary" id="bulk-start">Fetch player stats</button><button class="subtle" id="bulk-stop" disabled>Stop</button></div><p id="bulk-progress" role="status">${eligible().length} players on this list. Non-players are skipped.</p><div id="bulk-results"></div></div>`,true);
  const stop=()=>{controller?.abort();};if(onClose)$('#modal').removeEventListener('close',onClose);onClose=()=>{if(!$('#modal').open)stop();};$('#modal').addEventListener('close',onClose);
  function controls(){if(!alive())return;$('#bulk-start').disabled=running;$('#bulk-stop').disabled=!running;for(const sel of ['#bulk-from','#bulk-to','#bulk-missing'])$(sel).disabled=running;}
  function draw(){if(!alive())return;$('#bulk-progress').textContent=`${rows.filter(r=>r.status==='Saved').length} saved · ${rows.filter(r=>r.status==='Review match').length} need a match · ${rows.filter(r=>r.status==='Error').length} errors${running?' · Working…':' · Ready'}`;
   $('#bulk-results').innerHTML=rows.map((r,i)=>`<article class="bulk-result"><div><strong>${esc(r.name)}</strong><span>${esc(r.status)}</span></div>${r.detail?`<p>${esc(r.detail)}</p>`:''}${r.status==='Review match'?`<label>Choose the correct player<select data-bulk-choice="${i}" ${running?'disabled':''}><option value="">Select a match</option>${r.choices.map((p,j)=>`<option value="${j}">${esc(p.fullName)} · ${esc(p.birthDate||'Birth date unavailable')} · ${esc(p.primaryPosition?.name||'Player')} · MLB ${p.id}</option>`).join('')}</select></label>`:''}</article>`).join('');
   document.querySelectorAll('[data-bulk-choice]').forEach(el=>el.onchange=async()=>{if(el.value==='')return;const r=rows[Number(el.dataset.bulkChoice)],p=r.choices[Number(el.value)];running=true;controller=new AbortController();controls();await save(r,p);running=false;controls();draw();});
  }
  async function save(r,player){try{r.status='Loading stats';draw();const tables=await fetchFranchise(player,team,from,to,mlbJSON,controller.signal);if(!alive()||controller.signal.aborted)return;
   const index=b.candidates.findIndex(c=>c.id===r.id&&c.type==='Player'&&c.name===r.name);if(index<0)throw Error('Candidate changed. Reopen the lookup.');
   if(!tables.length){r.status='No franchise seasons';r.detail='Check the player match and year range, or import a historical table.';return;}
   const next=mergePlayerStats(b.candidates[index],tables,player,b.autoStats!==false);
   const stored=mutate(()=>{b.candidates[index]=next;},null,{redraw:false});if(stored===false){r.status='Save needs attention';r.detail='Browser storage is full or unavailable. This result is in memory; close this dialog and download a JSON backup before leaving.';controller.abort();return;}r.status='Saved';r.detail=`${player.fullName} · ${tables.map(t=>t.scope).join(' / ')}`;
  }catch(e){r.status=e.name==='AbortError'?'Stopped':'Error';r.detail=e.message;if(e.stopBatch)controller.abort();} }
  async function start(){if(running)return;from=Number($('#bulk-from').value);to=Number($('#bulk-to').value);if(!Number.isInteger(from)||!Number.isInteger(to)||from<1800||to>2100||from>to){toast('Enter a valid season range from 1800 through 2100.');return;}
   const missing=$('#bulk-missing').checked;rows=eligible().filter(c=>!missing||!(c.statImports||[]).some(s=>s.provider==='MLB Stats API')).map(c=>({id:c.id,name:c.name,status:'Queued',detail:'',choices:[]}));
   if(!rows.length){$('#bulk-progress').textContent='No players need a lookup. Add names or uncheck “Only players without saved MLB stats” to refresh.';$('#bulk-results').innerHTML='';return;}
   controller=new AbortController();running=true;controls();draw();
   for(const r of rows){if(!alive()||controller.signal.aborted)break;try{r.status='Matching name';draw();const match=await resolveCandidate(r.name,mlbJSON,controller.signal);if(!alive()||controller.signal.aborted)break;
    if(match.automatic)await save(r,match.automatic);else {r.choices=match.choices;r.status=match.choices.length?'Review match':'No match';r.detail=match.choices.length?'Choose a player below when this run finishes.':'Try the player’s full MLB name or use individual lookup.';}
   }catch(e){r.status=e.name==='AbortError'?'Stopped':'Error';r.detail=e.message;if(e.stopBatch)controller.abort();}draw();
   // Sequential requests avoid launching a burst of lookups against MLB.
   }
   running=false;for(const r of rows)if(['Queued','Matching name','Loading stats'].includes(r.status))r.status='Stopped';controls();draw();
  }
  $('#bulk-start').onclick=start;$('#bulk-stop').onclick=stop;
  // A prior dialog's queued close event can precede this newly opened dialog.
  if(autoStart)setTimeout(()=>{if(alive())start();},0);
 }
 return {open};
}
