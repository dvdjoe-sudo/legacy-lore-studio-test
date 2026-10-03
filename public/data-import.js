import {newCandidate,TYPES} from './model.js';

export const FRANCHISE_DATA={
 ARI:[109,'ARI',1998],ATL:[144,'ATL,MLN,BSN,BSB,BRA',1876],BAL:[110,'BAL',1954],BOS:[111,'BOS',1901],CHC:[112,'CHC',1876],CWS:[145,'CHW,CWS',1901],CIN:[113,'CIN',1882],CLE:[114,'CLE',1901],COL:[115,'COL',1993],DET:[116,'DET',1901],HOU:[117,'HOU',1962],KC:[118,'KCR,KC',1969],LAA:[108,'LAA,CAL,ANA',1961],LAD:[119,'LAD,BRO,BRK',1884],MIA:[146,'MIA,FLA',1993],MIL:[158,'MIL,SEP',1969],MIN:[142,'MIN,WSH',1901],NYM:[121,'NYM',1962],NYY:[147,'NYY,NYH',1903],ATH:[133,'ATH,OAK,KCA,PHA',1901],PHI:[143,'PHI',1883],PIT:[134,'PIT',1882],SD:[135,'SDP,SD',1969],SF:[137,'SFG,NYG,NY1',1883],SEA:[136,'SEA',1977],STL:[138,'STL',1882],TB:[139,'TBR,TBD,TB',1998],TEX:[140,'TEX,WSA',1961],TOR:[141,'TOR',1977],WSH:[120,'WSN,MON',1969]
};
export const normalizedName=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const headerKey=s=>String(s).toLowerCase().replace(/[^a-z0-9]/g,'');
export function safeSourceURL(value,provider=''){
 if(!value?.trim())return '';if(value.length>2000)throw Error('Source links must be 2,000 characters or fewer.');
 let u;try{u=new URL(value.trim());}catch{throw Error('Enter a complete https:// source URL.');}
 if(u.protocol!=='https:'||u.username||u.password)throw Error('Source links must use HTTPS and contain no credentials.');
 if(provider==='Baseball-Reference CSV'&&!['baseball-reference.com','www.baseball-reference.com'].includes(u.hostname))throw Error('Use a Baseball-Reference page URL for this source.');
 if(provider==='MLB Stats API'&&u.hostname!=='statsapi.mlb.com')throw Error('Invalid MLB source URL.');
 return u.href;
}
export function parseDelimited(text){
 text=String(text).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').trim();if(!text)throw Error('Paste a list or table first.');if(text.length>2000000)throw Error('Use a file or paste smaller than 2 MB.');
 const first=text.split('\n').slice(0,8).find(l=>/\t|,|;|\|/.test(l))||text.split('\n')[0];
 let delimiter=first.includes('\t')?'\t':first.trim().startsWith('|')?'|':first.includes(',')?',':first.includes(';')?';':null;
 if(!delimiter)return {headers:[],rows:text.split('\n').map(x=>[x.trim()]).filter(r=>r[0]),delimiter:null};
 let rows=[],row=[],cell='',quoted=false;
 for(let i=0;i<=text.length;i++){const ch=text[i];if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(quoted){quoted=false;}else if(cell.trim()===''){quoted=true;}else cell+=ch;}else if((ch===delimiter||ch==='\n'||ch===undefined)&&!quoted){row.push(cell.trim());cell='';if(ch!==delimiter){if(delimiter==='|'&&row[0]==='')row.shift();if(delimiter==='|'&&row.at(-1)==='')row.pop();if(row.some(Boolean))rows.push(row);row=[];}}else if(ch!==undefined)cell+=ch;}
 if(quoted)throw Error('A quoted CSV cell is unfinished. Copy the complete table.');
 if(rows.length>2001)throw Error('Import at most 2,000 table rows at a time.');
 rows=rows.filter(r=>!r.every(x=>/^:?-{2,}:?$/.test(x)));
 const headAt=rows.findIndex(r=>r.some(v=>['name','player','playername','year','season'].includes(headerKey(v))));
 if(headAt<0)return {headers:[],rows,delimiter};
 const headers=rows[headAt].map(x=>x.trim());if(headers.length>60)throw Error('Import at most 60 columns.');
 const data=rows.slice(headAt+1).filter(r=>!r.every((v,i)=>headerKey(v)===headerKey(headers[i])));
 if(data.some(r=>r.length>headers.length))throw Error('Some rows have more cells than the header. Check the CSV quoting or paste the table again.');
 return {headers,rows:data.map(r=>headers.map((_,i)=>r[i]??'')),delimiter};
}
const META={name:['name','player','playername'],type:['type','candidatetype'],nickname:['nickname','nicknames','signatureline'],era:['era','years','franchiseyears'],role:['role','position','pos','franchiserole'],tier:['tier'],moments:['moments','famousmoments','iconicmoments'],easterEggs:['eastereggs','graphiceastereggs'],notes:['notes','researchnotes'],sources:['sources','source','url'],rationale:['whythisrank','rationale']};
export function parseCandidateList(text){
 const table=parseDelimited(text);const cols=Object.fromEntries(Object.entries(META).map(([k,aliases])=>[k,table.headers.findIndex(h=>aliases.includes(headerKey(h)))]));
 if(table.headers.length&&cols.name<0)throw Error('This looks like a season-stat table. Use the Baseball-Reference table tab and choose its player.');
 if(!table.headers.length&&table.delimiter)throw Error('For CSV or pasted tables, include a Name or Player header. For a plain list, put one full name on each line.');
 const entries=[],warnings=[],seen=new Set();
 for(const [i,row] of table.rows.entries()){
  let name=String(row[table.headers.length?cols.name:0]||'').replace(/^\s*(?:[-•]\s+|#?\d{1,4}[.)\-:]?\s+)/,'').replace(/[\*#]+$/,'').trim();
  if(!name||/^(?:name|player|team totals|totals)$/i.test(name))continue;
  if(name.length>150){warnings.push(`Row ${i+1}: name exceeds 150 characters.`);continue;}
  const key=normalizedName(name);if(!key){warnings.push(`Row ${i+1}: invalid name.`);continue;}if(seen.has(key)){warnings.push(`Repeated name skipped: ${name}.`);continue;}seen.add(key);
  const c=newCandidate(name);for(const [field,col] of Object.entries(cols)){if(col<0||field==='name')continue;const value=row[col]?.trim();if(value)c[field]=value.slice(0,20000);}
  const typeAliases={manager:'Manager / coach',coach:'Manager / coach',announcer:'Broadcaster',owner:'Owner / executive',executive:'Owner / executive',mascot:'Mascot / fan',fan:'Mascot / fan',nonplayer:'Other non-player'};const type=TYPES.find(t=>t.toLowerCase()===String(c.type).toLowerCase())||typeAliases[headerKey(c.type)];if(!type){warnings.push(`${name}: unrecognized type; set to Player for review.`);c.type='Player';}else c.type=type;
  c.na=c.type==='Player'?[]:['performance','peak'];entries.push(c);
 }
 if(!entries.length)throw Error('No candidate names were found.');if(entries.length>1000)throw Error('Import at most 1,000 candidates.');
 return {entries,warnings};
}
export function planListImport(entries,existing){const names=new Set(existing.map(c=>normalizedName(c.name)));const added=entries.filter(c=>!names.has(normalizedName(c.name)));const skipped=entries.filter(c=>names.has(normalizedName(c.name)));if(existing.length+added.length>1000)throw Error('A franchise supports up to 1,000 candidates.');return {added,skipped};}
export function parseReferenceTable(text,aliases,from,to){
 const table=parseDelimited(text);if(!table.headers.length)throw Error('Include the table header, such as Year, Age, Tm, G, and H.');
 if(!table.rows.length)throw Error('The table has no data rows.');if(table.rows.length>200)throw Error('Choose a table with at most 200 data rows.');
 if(table.rows.some(r=>r.some(v=>v.length>500)))throw Error('A table cell exceeds 500 characters.');
 const teamColumn=table.headers.findIndex(h=>['tm','team','teamname'].includes(headerKey(h)));const yearColumn=table.headers.findIndex(h=>['year','season'].includes(headerKey(h)));
 const names=aliases.split(',').map(s=>s.trim().toUpperCase()).filter(Boolean);
 const selected=table.rows.map((row,i)=>{const yr=yearColumn<0?null:Number(row[yearColumn].replace(/[\*#]/g,''));const yearOK=yearColumn<0||Number.isInteger(yr)&&yr>=from&&yr<=to;const teamOK=teamColumn<0||names.includes(row[teamColumn].toUpperCase());return yearOK&&teamOK?i:-1;}).filter(i=>i>=0);
 const warnings=[];if(teamColumn<0)warnings.push('No team column found. Confirm these rows belong to the selected franchise.');if(yearColumn<0)warnings.push('No season column found. Year filters cannot be applied; review the selected rows.');
 if(!selected.length)warnings.push('No rows matched the team codes and years. Adjust the filters or select rows manually.');
 return {...table,selected,warnings};
}
export function ipToOuts(v){if(!/^\d+(?:\.[012])?$/.test(String(v)))return null;const [whole,part='0']=String(v).split('.');return Number(whole)*3+Number(part);}
const sum=(rows,key)=>rows.every(r=>r.stat[key]!==undefined&&r.stat[key]!==null&&r.stat[key]!==''&&Number.isFinite(Number(r.stat[key]))&&Number(r.stat[key])>=0)?rows.reduce((n,r)=>n+Number(r.stat[key]),0):null;
const rate=(num,den,digits=3)=>num===null||den===null||den<=0?'—':(num/den).toFixed(digits);
export function summarizeMLB(rows,group){
 const val=k=>sum(rows,k);const display=v=>v===null?'—':String(v);
 if(group==='hitting'){
  const h=val('hits'),ab=val('atBats'),bb=val('baseOnBalls'),hbp=val('hitByPitch'),sf=val('sacFlies'),tb=val('totalBases');
  const obp=[h,ab,bb,hbp,sf].includes(null)?null:(ab+bb+hbp+sf>0?(h+bb+hbp)/(ab+bb+hbp+sf):null);const slg=tb===null||ab===null||ab===0?null:tb/ab;
  return [['Seasons',new Set(rows.map(r=>r.season)).size],['G',val('gamesPlayed')],['PA',val('plateAppearances')],['AB',ab],['H',h],['HR',val('homeRuns')],['RBI',val('rbi')],['R',val('runs')],['SB',val('stolenBases')],['AVG',rate(h,ab)],['OBP',obp===null?'—':obp.toFixed(3)],['SLG',slg===null?'—':slg.toFixed(3)],['OPS',obp===null||slg===null?'—':(obp+slg).toFixed(3)]].map(([label,value])=>({label,value:display(value)}));
 }
 const allOuts=rows.map(r=>r.stat.outs!==undefined&&Number.isInteger(Number(r.stat.outs))?Number(r.stat.outs):ipToOuts(r.stat.inningsPitched));const outs=allOuts.includes(null)?null:allOuts.reduce((a,b)=>a+b,0);const er=val('earnedRuns'),h=val('hits'),bb=val('baseOnBalls');
 return [['Seasons',new Set(rows.map(r=>r.season)).size],['G',val('gamesPlayed')],['GS',val('gamesStarted')],['W',val('wins')],['L',val('losses')],['SV',val('saves')],['IP',outs===null?null:`${Math.floor(outs/3)}.${outs%3}`],['SO',val('strikeOuts')],['ERA',rate(er===null?null:er*27,outs,2)],['WHIP',rate(h===null||bb===null?null:(h+bb)*3,outs,3)]].map(([label,value])=>({label,value:display(value)}));
}
export const MLB_FIELDS={hitting:[['G','gamesPlayed'],['PA','plateAppearances'],['AB','atBats'],['H','hits'],['2B','doubles'],['3B','triples'],['HR','homeRuns'],['RBI','rbi'],['R','runs'],['BB','baseOnBalls'],['SO','strikeOuts'],['SB','stolenBases'],['CS','caughtStealing'],['AVG','avg'],['OBP','obp'],['SLG','slg'],['OPS','ops']],pitching:[['G','gamesPlayed'],['GS','gamesStarted'],['W','wins'],['L','losses'],['SV','saves'],['IP','inningsPitched'],['H','hits'],['ER','earnedRuns'],['BB','baseOnBalls'],['SO','strikeOuts'],['ERA','era'],['WHIP','whip']]};
export function mlbGameTypeSnapshots(payload,player,franchise,from,to,groupChoice='all',gameType='R'){
 const teamId=FRANCHISE_DATA[franchise][0],result=[];
 for(const section of payload.stats||[]){const group=section.group?.displayName;if(!MLB_FIELDS[group]||section.type?.displayName!=='yearByYear'||(groupChoice!=='all'&&groupChoice!==group))continue;
  const seen=new Set();const rows=(section.splits||[]).filter(r=>{const yr=Number(r.season);if(r.team?.id!==teamId||!Number.isInteger(yr)||yr<from||yr>to||r.gameType&&r.gameType!==gameType||r.sport?.id&&r.sport.id!==1)return false;const key=JSON.stringify([r.season,r.team.id,r.league?.id,r.stat]);if(seen.has(key))return false;seen.add(key);return true;}).sort((a,b)=>Number(a.season)-Number(b.season));
  if(!rows.length)continue;
  const fields=MLB_FIELDS[group],seasonLabel=gameType==='P'?'postseason':'regular season';result.push({id:crypto.randomUUID(),provider:'MLB Stats API',url:`https://statsapi.mlb.com/api/v1/people/${player.id}/stats?stats=yearByYear&group=${group}&sportIds=1&gameType=${gameType}`,importedAt:new Date().toISOString(),label:`Franchise ${group==='hitting'?'hitting':'pitching'} · ${seasonLabel}`,scope:`${franchise} · ${rows[0].season}–${rows.at(-1).season} · ${seasonLabel} · team ${teamId}`,playerId:player.id,columns:['Year','Team',...fields.map(f=>f[0])],rows:rows.map(r=>[String(r.season),String(r.team.name),...fields.map(([,key])=>String(r.stat[key]??'—'))]),summary:summarizeMLB(rows,group)});
 }
 return result;
}
export function mlbSnapshots(payload,player,franchise,from,to,groupChoice='all'){
 return mlbGameTypeSnapshots(payload,player,franchise,from,to,groupChoice,'R');
}
export function appendSnapshots(candidate,snapshots){
 const next=structuredClone(candidate);next.statImports=next.statImports||[];
 for(const item of snapshots){const same=next.statImports.findIndex(s=>s.provider===item.provider&&s.url===item.url&&s.scope===item.scope&&s.label===item.label);if(same>=0)next.statImports[same]=item;else next.statImports.push(item);}
 if(next.statImports.length>10)throw Error('Keep at most 10 saved stat tables per candidate. Remove an older table before importing another.');
 return next;
}
