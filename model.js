import {defaultStudio,defaultProfile,cleanStudio,cleanProfile} from './workspace-extra.js';
import {blankLegacy,cleanLegacy,calculateLegacy} from './legacy-score.js';
import {cleanRoster,newRoster,AUTO_KEYS} from './legends.js';
import {cleanAlmanac,defaultAlmanac} from './history-almanac.js';
export const KEY = 'legacy-lore-studio-v1';
export const FACTORS = [
 ['identity','Franchise identity',25,'How inseparable is this person from the franchise?'],
 ['moments','Iconic moments',15,'Singular plays, calls, rituals, and stories that still get retold.'],
 ['nostalgia','Nostalgia',15,'The eras, places, and memories their name brings back.'],
 ['attachment','Enduring fan love',20,'Fan attachment that lasts across generations.'],
 ['performance','Performance',10,'Overall franchise production; supporting evidence, not the whole case.'],
 ['peak','Peak dominance',5,'How exceptional were their best franchise seasons?'],
 ['longevity','Longevity',5,'Years of meaningful contribution to this franchise.'],
 ['culture','Cultural significance',5,'Impact beyond the box score, within the franchise and its community.']
];
export const PILLARS = [
 ['p1','Peak Dominance',200,'Best five qualifying franchise seasons, era-adjusted rate plus objective league dominance.'],
 ['p2','Franchise Density & Loyalty',250,'Workload, franchise career share, and top-five franchise leaderboards.'],
 ['p3','Carrying Burden',200,'Combined five-year roster responsibility plus regular-season WPA.'],
 ['p4','High-Stakes Equity',200,'The higher of postseason/title equity or regular-season leverage. Never add both tracks.'],
 ['p5','Complete Mastery',135,'Position- and era-adjusted defense (85), plus baserunning or pitching control (50).'],
 ['identity','Identity Residual',20,'Rare, durable, nonredundant franchise identity. Popularity alone does not qualify.']
];
export const TEAMS = [
 ['ARI','Arizona Diamondbacks','NL West'],['ATL','Atlanta Braves','NL East'],['BAL','Baltimore Orioles','AL East'],['BOS','Boston Red Sox','AL East'],['CHC','Chicago Cubs','NL Central'],['CWS','Chicago White Sox','AL Central'],['CIN','Cincinnati Reds','NL Central'],['CLE','Cleveland Guardians','AL Central'],['COL','Colorado Rockies','NL West'],['DET','Detroit Tigers','AL Central'],['HOU','Houston Astros','AL West'],['KC','Kansas City Royals','AL Central'],['LAA','Los Angeles Angels','AL West'],['LAD','Los Angeles Dodgers','NL West'],['MIA','Miami Marlins','NL East'],['MIL','Milwaukee Brewers','NL Central'],['MIN','Minnesota Twins','AL Central'],['NYM','New York Mets','NL East'],['NYY','New York Yankees','AL East'],['ATH','Athletics','AL West'],['PHI','Philadelphia Phillies','NL East'],['PIT','Pittsburgh Pirates','NL Central'],['SD','San Diego Padres','NL West'],['SF','San Francisco Giants','NL West'],['SEA','Seattle Mariners','AL West'],['STL','St. Louis Cardinals','NL Central'],['TB','Tampa Bay Rays','AL East'],['TEX','Texas Rangers','AL West'],['TOR','Toronto Blue Jays','AL East'],['WSH','Washington Nationals / Expos','NL East']
];
export const TYPES=['Player','Broadcaster','Manager / coach','Owner / executive','Mascot / fan','Other non-player'];
export const defaults=()=>Object.fromEntries(FACTORS.map(([k,,w])=>[k,w]));
export function newId(c=typeof globalThis!=='undefined'?globalThis.crypto:null){
 if(typeof c?.randomUUID==='function')return c.randomUUID();
 if(typeof c?.getRandomValues==='function'){
  const bytes=c.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const hex=[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
 }
 return `ll-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
export const clamp=(n,max)=> Math.max(0,Math.min(max,Number.isFinite(Number(n))?Number(n):0));
export function calculate(c,mode,weights=defaults()){
 if(mode==='legacy')return calculateLegacy(c);
 if(mode==='apex'){
  if(c.type!=='Player') return {value:null,complete:false,applicable:false,coverage:0,max:100,parts:[]};
  const a=c.profile?.advancedStats;
  const apexValue=a?.APEX_F??a?.APEX_R;
  if(!a||a.version!=='role-lane-v3'||!Number.isFinite(Number(apexValue)))return {value:null,complete:false,applicable:true,coverage:0,max:100,parts:[]};
  const value=Number(apexValue);
  const parts=[['Apex','Peak3 · best 3 seasons',a.Apex],['Prime','Prime5 · best 5-year run',a.Prime],['Reign','Career dominance',a.Career??a.Reign]].map(([key,label,v])=>({key,label,max:null,value:Number(v)||0}));
  return {value,complete:true,applicable:true,coverage:1,max:null,parts};
 }
 if(mode==='fls'){
  if(c.type!=='Player') return {value:null,complete:false,applicable:false,coverage:0,max:1005,parts:[]};
  const parts=PILLARS.map(([key,label,max])=>({key,label,max,value:c.fls[key]===null||c.fls[key]===undefined?null:clamp(c.fls[key],max)}));
  return {value:parts.some(p=>p.value!==null)?parts.reduce((s,p)=>s+(p.value??0),0):null,complete:parts.every(p=>p.value!==null),applicable:true,coverage:parts.filter(p=>p.value!==null).length/parts.length,max:1005,parts};
 }
 const active=FACTORS.filter(([k])=>!c.na.includes(k)&&weights[k]>0);
 const total=active.reduce((s,[k])=>s+weights[k],0);
 const parts=active.map(([key,label])=>({key,label,max:10,weight:weights[key]/total*100,value:c.scores[key]===null||c.scores[key]===undefined?null:clamp(c.scores[key],10)}));
 const filled=parts.filter(p=>p.value!==null);
 return {value:filled.length?parts.reduce((s,p)=>s+(p.value??0)/10*p.weight,0):null,complete:parts.length>0&&filled.length===parts.length,applicable:total>0,coverage:parts.length?filled.length/parts.length:0,max:100,parts};
}
export function moveCandidate(list,id,to){const copy=[...list];const from=copy.findIndex(c=>c.id===id);if(from<0)return copy;const [c]=copy.splice(from,1);copy.splice(Math.max(0,Math.min(copy.length,to)),0,c);return copy;}
export function rankByScore(list,mode,weights){return list.map((c,i)=>({c,i,s:calculate(c,mode,weights)})).sort((a,b)=>(Number(b.s.complete)-Number(a.s.complete))||(a.s.complete&&b.s.complete?b.s.value-a.s.value:0)||a.i-b.i).map(x=>x.c);}
export function newCandidate(name='',type='Player'){return {id:newId(),name,type,role:'',nickname:'',era:'',tier:'Candidate',scores:Object.fromEntries(FACTORS.map(([k])=>[k,null])),na:type==='Player'?[]:['performance','peak'],fls:Object.fromEntries(PILLARS.map(([k])=>[k,null])),moments:'',easterEggs:'',notes:'',sources:'',rationale:'',sample:false,legacy:blankLegacy(),profile:defaultProfile(),statImports:[],autoScores:{}};}
const demo = [
 ['Vin Scully','Broadcaster','The voice of Dodger baseball','1950–2016','Voice of the franchise',[10,10,10,10,null,null,10,10],'A microphone, a scorebook, and a radio in the stands.'],
 ['Jackie Robinson','Player','A legacy beyond the game','1947–1956','Pioneer',[10,10,9,10,9,9,7,10],'A subtle number 42 in the ballpark.'],
 ['Sandy Koufax','Player','The Left Arm of God','1955–1966','Starting pitcher',[10,10,10,10,9,10,7,9],'A handwritten K on the scorecard.'],
 ['Clayton Kershaw','Player','A generation’s ace','','Starting pitcher',[10,9,8,10,10,10,10,8],'A curveball drawn into the chalk line.'],
 ['Duke Snider','Player','The Duke of Flatbush','1947–1962','Center field',[9,9,10,9,9,9,9,8],'An Ebbets Field street sign.'],
 ['Tommy Lasorda','Manager / coach','Dodger blue, through and through','','Manager',[10,9,10,9,null,null,10,9],'A well-worn blue dugout jacket.'],
 ['Fernando Valenzuela','Player','Fernandomania','','Starting pitcher',[10,10,10,10,8,9,8,10],'A tiny Fernandomania pennant.'],
 ['Pee Wee Reese','Player','The Captain','','Shortstop',[9,8,9,9,8,8,10,9],'A captain’s notation on a vintage lineup.'],
 ['Don Drysdale','Player','Big D','','Starting pitcher',[9,9,9,9,9,9,9,8],'A radio dial and a 53 on a scoreboard.'],
 ['Gil Hodges','Player','A Brooklyn cornerstone','','First base',[9,8,10,9,8,8,9,8],'A weathered Brooklyn ticket stub.'],
 ['Orel Hershiser','Player','Bulldog','','Starting pitcher',[9,10,9,9,8,10,8,8],'59 worked into a scoreboard detail.'],
 ['Kirk Gibson','Player','One swing. Forever.','','Outfield',[9,10,10,9,6,8,3,9],'A small pair of taillights beyond the outfield.']
];
export function seedState(){
 const boards=Object.fromEntries(TEAMS.map(([id])=>[id,{scope:id==='LAD'?'Brooklyn + Los Angeles · franchise accomplishments only':id==='BAL'?'Baltimore only · 1954 onward · no Browns':id==='WSH'?'Montreal Expos + Washington Nationals':'Franchise accomplishments only · edit eras as needed',mode:'apex',studio:defaultStudio(),weights:defaults(),candidates:[],notes:'',autoStats:true,roster:newRoster()}]));
 boards.LAD.candidates=demo.map(([name,type,nickname,era,role,values,easterEggs])=>({...newCandidate(name,type),nickname,era,role,easterEggs,scores:Object.fromEntries(FACTORS.map(([k],i)=>[k,values[i]])),sample:true,tier:'Starter example',notes:'Illustrative studio entry. Review ratings and verify historical details before using in your series.'}));
 return {version:1,selected:'LAD',boards,almanac:defaultAlmanac(),updatedAt:new Date().toISOString()};
}
export function validateImport(raw){
 if(!raw||raw.version!==1||!raw.boards||!TEAMS.some(t=>t[0]===raw.selected))throw Error('This is not a supported Legacy Lore backup (version 1).');
 const out={version:1,selected:raw.selected,boards:{},almanac:cleanAlmanac(raw.almanac),updatedAt:new Date().toISOString()};let count=0;
 const str=(v,max=20000)=>{if(typeof v!=='string'||v.length>max)throw Error('Invalid or oversized text field.');return v;};
 for(const [id] of TEAMS){
  const b=raw.boards[id];if(!b||!['legacy','lore','fls','apex'].includes(b.mode)||!Array.isArray(b.candidates)||b.candidates.length>1000)throw Error('Invalid franchise board.');
  const weights={};for(const [k] of FACTORS){const w=b.weights?.[k];if(typeof w!=='number'||!Number.isFinite(w)||w<0||w>100)throw Error('Weights must be between 0 and 100.');weights[k]=w;}if(Object.values(weights).reduce((a,b)=>a+b,0)<=0)throw Error('At least one weight must be greater than zero.');
  const ids=new Set();const candidates=b.candidates.map(c=>{
   if(!c||typeof c.id!=='string'||!c.id||ids.has(c.id)||!TYPES.includes(c.type)||!Array.isArray(c.na)||c.na.some(k=>!FACTORS.some(f=>f[0]===k)))throw Error('Invalid or duplicate candidate.');ids.add(c.id);
   if(!c.name?.trim())throw Error('Candidates need a name.');
   const result={id:str(c.id,100),type:c.type,na:[...new Set(c.na)],sample:!!c.sample,legacy:cleanLegacy(c.legacy),profile:cleanProfile(c.profile),scores:{},fls:{},statImports:validateStatImports(c.statImports??[])};
   for(const k of ['name','role','nickname','era','tier','moments','easterEggs','notes','sources','rationale'])result[k]=str(c[k]??'',k==='name'?150:20000);
   for(const [key,,max] of FACTORS.map(([k,n])=>[k,n,10])){const v=c.scores?.[key];if(v!==null&&(typeof v!=='number'||!Number.isFinite(v)||v<0||v>max))throw Error('Lore ratings must be null or 0–10.');result.scores[key]=v;}
   for(const [key,,max] of PILLARS){const v=c.fls?.[key];if(v!==null&&(typeof v!=='number'||!Number.isFinite(v)||v<0||v>max))throw Error('FLS points exceed a pillar cap.');result.fls[key]=v;}
   result.autoScores={};
   for(const k of AUTO_KEYS){const a=c.autoScores?.[k];if(a){if(typeof a.value!=='number'||!Number.isFinite(a.value)||a.value<0||a.value>10)throw Error('Invalid automatic rating.');result.autoScores[k]={value:a.value,reason:str(a.reason,2000),sourceId:str(a.sourceId,100),...(a.version?{version:str(a.version,50)}:{})};}}
   count++;return result;
  });out.boards[id]={mode:b.mode,studio:cleanStudio(b.studio),weights,candidates,scope:str(b.scope??''),notes:str(b.notes??''),autoStats:b.autoStats!==false,roster:cleanRoster(b.roster,candidates)};
 }
 return {state:out,count};
}

export function validateStatImports(items){
 if(!Array.isArray(items)||items.length>10)throw Error('Invalid saved stat tables.');
 const txt=(v,max)=>{if(typeof v!=='string'||v.length>max)throw Error('Invalid stat-table text.');return v;};
 return items.map(s=>{
  if(!s||!['MLB Stats API','Baseball-Reference CSV'].includes(s.provider))throw Error('Invalid stat provider.');
  const url=txt(s.url??'',2000);if(url){let u;try{u=new URL(url);}catch{throw Error('Invalid stat source link.');}if(u.protocol!=='https:'||u.username||u.password||s.provider==='MLB Stats API'&&u.hostname!=='statsapi.mlb.com'||s.provider==='Baseball-Reference CSV'&&!['baseball-reference.com','www.baseball-reference.com'].includes(u.hostname))throw Error('Invalid stat source link.');}
  if(!Array.isArray(s.columns)||!s.columns.length||s.columns.length>60||!Array.isArray(s.rows)||s.rows.length>200||!Array.isArray(s.summary)||s.summary.length>30)throw Error('Invalid stat-table dimensions.');
  const columns=s.columns.map(x=>txt(x,500));const rows=s.rows.map(r=>{if(!Array.isArray(r)||r.length!==columns.length)throw Error('Invalid stat row.');return r.map(x=>txt(x,500));});
  if(!Number.isFinite(Date.parse(s.importedAt)))throw Error('Invalid stat import date.');if(s.playerId!=null&&(!Number.isInteger(s.playerId)||s.playerId<=0))throw Error('Invalid MLB player ID.');
  return {id:txt(s.id,100),provider:s.provider,url,importedAt:txt(s.importedAt,50),label:txt(s.label,200),scope:txt(s.scope,500),playerId:s.playerId??null,columns,rows,summary:s.summary.map(x=>({label:txt(x.label,50),value:txt(x.value,100)}))};
 });
}
