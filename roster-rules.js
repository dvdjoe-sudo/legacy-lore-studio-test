import {positions,meaningfulPositions,SLOTS,BULLPEN_SLOTS,eligibleForSlot,rosterEligibility,ROSTER_ELIGIBILITY} from './legends.js';
import {rosterMetric} from './apex-roster.js';
export const RULE_SOURCE='https://www.mlb.com/glossary/transactions/26-man-roster';
export function rosterChecks(roster,candidates){
 const byId=new Map(candidates.map(c=>[c.id,c])),entries=Object.entries(roster.slots||{}),ids=new Set(),errors=[],warnings=[],legacyId=roster.legacyException?.playerId||'',legacyReason=roster.legacyException?.reason?.trim()||'';let pitchers=0,legacyUsed=false;
 for(const [slot,id] of entries){const c=byId.get(id);if(!c||c.type!=='Player'){errors.push('Every roster slot must contain a player.');continue;}if(ids.has(id))errors.push(c.name+' occupies more than one roster slot.');ids.add(id);
  const eligibility=rosterEligibility(c,slot,{legacyExceptionId:legacyId});
  if(!eligibility.eligible)errors.push(c.name+' is not eligible for '+slot+': '+eligibility.reason+'.');
  if(eligibility.usingException){legacyUsed=true;if(!legacyReason)errors.push(c.name+': add a reason for the Legacy Legend exception.');}
  const meaningful=meaningfulPositions(c),pitchSlot=/^SP\d+$/.test(slot)||BULLPEN_SLOTS.includes(slot),inferred=meaningful.some(p=>['SP','RP'].includes(p)),designation=c.profile?.designation,qualifiedTwoWay=designation==='two-way'&&c.profile?.twoWayQualified===true;
  const counts=!qualifiedTwoWay&&(designation==='pitcher'||(!designation&&(pitchSlot||inferred))||designation==='two-way');
  if(counts)pitchers++;
  if(designation==='two-way'&&!qualifiedTwoWay)warnings.push(c.name+': two-way qualification is not verified; counted as a pitcher.');
  if(pitchSlot&&designation==='position')errors.push(c.name+' is designated a position player in a pitching slot.');
  if(pitchSlot&&!inferred&&designation!=='pitcher'&&designation!=='two-way')errors.push(c.name+' is not identified as a pitcher for '+slot+'.');
  if(/^SP\d+$/.test(slot)&&!meaningful.includes('SP')&&designation!=='two-way')errors.push(c.name+' is not identified as a starting pitcher for '+slot+'.');
  if(BULLPEN_SLOTS.includes(slot)&&slot!=='LR'&&!meaningful.includes('RP')&&designation!=='two-way')errors.push(c.name+' is not identified as a relief pitcher for '+slot+'.');
  if(slot==='LHS'&&String(c.profile?.throws||c.profile?.pitchHand||'').toUpperCase()!=='L'&&!/left[- ]hand(?:ed)?|southpaw/i.test(c.role||''))errors.push(c.name+' is not verified as a left-handed pitcher for LHS.');
  if((slot==='DH'||['C2','UTIL','OF4','CI','PH'].includes(slot))&&(inferred||designation==='pitcher')&&designation!=='two-way')errors.push(c.name+' is identified as a pitcher in a position-player role.');
  const pos=slot.replace(/\d+$/,'');if(['C','1B','2B','3B','SS','LF','CF','RF'].includes(pos)&&!meaningful.includes(pos))warnings.push(c.name+': check meaningful franchise experience at '+pos+'.');
  if(slot==='C2'&&!meaningful.includes('C'))warnings.push(c.name+': backup catcher should have meaningful catcher experience.');
  if(slot==='UTIL'&&meaningful.filter(p=>['2B','3B','SS'].includes(p)).length<2)warnings.push(c.name+': utility infielder should cover at least two infield positions.');
  if(slot==='OF4'&&!meaningful.some(p=>['LF','CF','RF'].includes(p)))warnings.push(c.name+': fourth outfielder should have meaningful outfield experience.');
  if(slot==='CI'&&!meaningful.some(p=>['1B','3B'].includes(p)))warnings.push(c.name+': corner infielder should cover first or third base.');
  if(['C2','UTIL','OF4','CI','PH'].includes(slot)&&inferred&&designation!=='position'&&designation!=='two-way')errors.push(c.name+' is a pitcher in a position-player bench role.');
 }
 if(legacyId&&!legacyUsed)warnings.push('The selected Legacy Legend exception is not being used in a roster slot.');
 if(ids.size>26)errors.push('A standard roster allows at most 26 players.');if(pitchers>13)errors.push('There are '+pitchers+' pitchers; the standard limit is 13.');
 if(ids.size<26)warnings.push((26-ids.size)+' open roster slots.');
 const starters=SLOTS.slice(0,9).filter(([k])=>!roster.slots[k]);if(starters.length)warnings.push('Starting lineup needs '+starters.map(([k])=>k).join(', ')+'.');
 const catchers=[...ids].map(id=>byId.get(id)).filter(c=>c&&meaningfulPositions(c).includes('C'));if(catchers.length<2)warnings.push('The roster needs a second catcher for normal game coverage.');
 const leadoffSlot=roster.order?.[0],leadoff=byId.get(roster.slots?.[leadoffSlot]),leadoffRuns=Number(leadoff?.profile?.advancedStats?.runsBaserunning);
 if(leadoff&&meaningfulPositions(leadoff).includes('C')&&Number.isFinite(leadoffRuns)&&leadoffRuns<=0)errors.push(leadoff.name+' is a slow catcher and cannot be used as the leadoff hitter. Reorder the lineup around an on-base and speed table-setter.');
 const unexplainedOverrides=[];
 for(const [slot,id] of entries){const selected=byId.get(id),metric=rosterMetric(selected,slot);if(!selected||!Number.isFinite(Number(metric?.value)))continue;
  const occupiedElsewhere=new Set(entries.filter(([key])=>key!==slot).map(([,playerId])=>playerId));
  const alternatives=candidates.filter(c=>c.type==='Player'&&eligibleForSlot(c,slot,{legacyExceptionId:legacyId})&&!occupiedElsewhere.has(c.id)).map(c=>({c,metric:rosterMetric(c,slot)})).filter(row=>Number.isFinite(Number(row.metric?.value))).sort((a,b)=>Number(b.metric.value)-Number(a.metric.value));
  const best=alternatives[0];if(best&&best.c.id!==selected.id&&Number(best.metric.value)>Number(metric.value)*1.01&&!roster.overrides?.[slot]?.trim()){unexplainedOverrides.push(slot);warnings.push(slot+': '+selected.name+' is below '+best.c.name+' on '+best.metric.label+'. Add a role-fit explanation if this is intentional.');}
 }
 return {count:ids.size,pitchers,errors:[...new Set(errors)],warnings,unexplainedOverrides,valid:!errors.length,complete:ids.size===26&&!errors.length&&!unexplainedOverrides.length};
}
export function rosterNextStep(roster,candidates,check=rosterChecks(roster,candidates)){
 const byId=new Map(candidates.map(c=>[c.id,c])),legacyId=roster.legacyException?.playerId||'';
 for(const [slot,id] of Object.entries(roster.slots||{})){
  const c=byId.get(id);if(!c)continue;
  const status=rosterEligibility(c,slot,{legacyExceptionId:legacyId});
  if(!status.eligible)return {state:'fix',slot,text:`Replace ${c.name} at ${slot}: ${status.reason}.`};
  if(status.usingException&&!roster.legacyException?.reason?.trim())return {state:'fix',slot,text:`Add the Legacy Legend reason for ${c.name}.`};
 }
 const open=SLOTS.find(([slot])=>!roster.slots?.[slot]);
 if(open)return {state:'build',slot:open[0],text:`Fill ${open[1]} next.`};
 if(check.errors.length)return {state:'fix',slot:'',text:check.errors[0]};
 if(!roster.manager)return {state:'review',slot:'',text:'Choose the manager who best fits this roster.'};
 if(check.unexplainedOverrides.length)return {state:'review',slot:check.unexplainedOverrides[0],text:`Explain the role-fit choice at ${check.unexplainedOverrides[0]}.`};
 return {state:'ready',slot:'',text:'The 26-player roster is complete and ready to export.'};
}
export function notableOmissions(roster,candidates,limit=6){
 const selected=new Set(Object.values(roster.slots||{})),legacyExceptionId=roster.legacyException?.playerId||'',byId=new Map(candidates.map(c=>[c.id,c]));
 const apex=c=>{const a=c.profile?.advancedStats||{},lane=a.apexBoards?.[a.primaryBoard];return Number(lane?.APEX_F??lane?.APEX_R??a.APEX_F??a.APEX_R)||0;};
 const chosen=slot=>byId.get(roster.slots?.[slot]),lowest=(slots)=>slots.map(chosen).filter(Boolean).sort((a,b)=>apex(a)-apex(b))[0];
 return candidates.filter(c=>c.type==='Player'&&!selected.has(c.id)&&apex(c)>0&&SLOTS.some(([slot])=>eligibleForSlot(c,slot,{legacyExceptionId}))).sort((a,b)=>apex(b)-apex(a)).slice(0,Math.max(1,limit)).map(c=>{
  const pos=meaningfulPositions(c),a=c.profile?.advancedStats||{},value=apex(c),war=Number(a.totalWAR),stat=Number.isFinite(war)?` · ${war.toFixed(1)} franchise WAR`:'';
  let reason='No open starting or coverage-bench role after the position and role-fit selections.';
  if(pos.includes('SP')){const fifth=lowest(['SP1','SP2','SP3','SP4','SP5']);reason=`The rotation is limited to five${fifth?`; ${fifth.name} holds the final starting spot`:''}.`;}
  else if(pos.includes('RP')){const last=lowest(BULLPEN_SLOTS);reason=`The seven-man bullpen favored defined closer, setup, middle, lefty and long-relief jobs${last?`; ${last.name} holds the final role`:''}.`;}
  else {const field=pos.filter(p=>['C','1B','2B','3B','SS','LF','CF','RF','DH'].includes(p));if(field.length)reason=`Blocked at ${field.join('/')} after the starting lineup and five-player coverage bench were filled.`;}
  return {id:c.id,name:c.name,value,reason:`F-APEX ${value.toFixed(2)}${stat}. ${reason}`};
 });
}
export function rosterRulesHTML(roster,candidates,esc){const r=rosterChecks(roster,candidates),omissions=notableOmissions(roster,candidates),omissionsHTML=omissions.length?`<section class="roster-omissions"><div><span>SELECTION TRANSPARENCY</span><h3>Notable omissions</h3><p>Strong candidates outside the 26, with the roster reason shown plainly.</p></div><ul>${omissions.map(item=>`<li><strong>${esc(item.name)}</strong><span>${esc(item.reason)}</span></li>`).join('')}</ul></section>`:'';return `<section class="roster-rules" aria-label="Roster rules"><strong>${r.complete?'26-player roster limits met':r.errors.length?'Roster needs correction':r.unexplainedOverrides.length?'Role-fit explanation required':'Roster in progress'} · ${r.count}/26 players · ${r.pitchers}/13 pitchers</strong>${r.errors.length?'<ul class="error">'+r.errors.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':''}${r.warnings.length?'<details><summary>'+r.warnings.length+' coverage or review notes</summary><ul>'+r.warnings.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></details>':''}<p class="help"><b>Best 26 eligibility:</b> ${ROSTER_ELIGIBILITY.tenureSeasons} franchise seasons, ${ROSTER_ELIGIBILITY.positionPA.toLocaleString()} PA for regular position players, ${ROSTER_ELIGIBILITY.specialistPA} PA for catchers and bench specialists, ${ROSTER_ELIGIBILITY.starterIP} starter IP, or ${ROSTER_ELIGIBILITY.reliefIP} relief IP. One documented Legacy Legend may bypass only the workload minimum, never tenure or position fit. The manager stays outside the 26.</p><a href="${RULE_SOURCE}" target="_blank" rel="noopener">MLB roster reference ↗</a></section>${omissionsHTML}`;}
