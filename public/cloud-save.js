import {KEY,validateImport} from './model.js';
const DRAFT=KEY+'-draft',RECOVERY=KEY+'-recovery';
export async function requestJSON(path,options={}){const r=await fetch(path,{...options,headers:{'Content-Type':'application/json',...options.headers}});let data;try{data=await r.json();}catch{throw Error('The cloud service is unavailable. Keep this page open or export a backup.');}if(!r.ok){const e=Error(data.error||'Request failed.');e.status=r.status;e.retryAfter=data.retryAfter;throw e;}return data;}
export function createCloudSave({getState,onStatus,preserveLegacy=()=>false}){
 let revision=0,ready=false,saving=false,pending=null,timer,status='Connecting to cloud…',cacheIssue='',keepLegacy=false;
 const set=s=>{status=s;onStatus?.();};
 function cache(state,dirty=true){try{localStorage.setItem(DRAFT,JSON.stringify({revision,dirty,state}));cacheIssue='';}catch{cacheIssue='Device recovery copy unavailable. Keep this page open until your account save completes; export a backup before leaving if it fails.';}onStatus?.();}
 async function flush(){if(!ready||saving||!pending)return;saving=true;const state=pending;pending=null;set('Saving to cloud…');try{const r=await requestJSON('/api/workspace',{method:'PUT',body:JSON.stringify({revision,state})});revision=r.revision;if(!keepLegacy&&!preserveLegacy()){try{localStorage.removeItem(KEY);}catch{}}cache(pending||state,!!pending);set('Saved to your account');}catch(e){pending=pending||state;if(e.status===409)ready=false;set(e.status===409?'Save conflict · open Backups before reloading':'Cloud save failed · export a backup or retry');}finally{saving=false;if(pending&&ready&&status==='Saved to your account')void flush();}}
 async function start(local){try{const r=await requestJSON('/api/workspace');revision=r.revision;let draft;try{draft=JSON.parse(localStorage.getItem(DRAFT));}catch{}let result=local;
  if(r.state){result=validateImport(r.state).state;if(draft?.dirty&&draft.revision===revision)result=validateImport(draft.state).state;else if(draft?.dirty||(!draft&&local.updatedAt&&JSON.stringify(local)!==JSON.stringify(result))){try{localStorage.setItem(RECOVERY,JSON.stringify(draft?.state||local));set('Cloud loaded · device recovery available in Backups');}catch{keepLegacy=true;set('Cloud loaded · device recovery could not be saved');}}}
  ready=true;if(!status.includes('recovery'))set('Saved to your account');if(!r.state||draft?.dirty&&draft.revision===revision){pending=structuredClone(result);cache(result);await flush();}else cache(result,false);return result;
 }catch(e){set('Cloud unavailable · changes need a backup');return local;}}
 function schedule(){const state=structuredClone(getState());pending=state;cache(state);if(!ready)return;set('Cloud save pending…');clearTimeout(timer);timer=setTimeout(flush,650);}
 window.addEventListener('online',()=>{if(ready)void flush();});window.addEventListener('beforeunload',e=>{if(pending||saving){e.preventDefault();e.returnValue='';}});
 async function retry(){if(!ready){try{const r=await requestJSON('/api/workspace');if(r.revision!==revision){set('Save conflict · export a backup, then reload cloud data');return;}ready=true;}catch{set('Cloud unavailable · export a backup');return;}}await flush();}
 return {start,schedule,flush,retry,get status(){return status;},get cacheIssue(){return cacheIssue;},get revision(){return revision;},recoveryKey:RECOVERY};
}
