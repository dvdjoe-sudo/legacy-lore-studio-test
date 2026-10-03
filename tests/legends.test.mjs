import {contextFor,testPlayer} from './helpers/scoring-fixtures.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {newCandidate,seedState,validateImport} from '../public/model.js';
import {AUTO_KEYS,SLOTS,suggestScores,applyAutoScores,keyStats,positionApexHTML,newRoster,cleanRoster,draftRoster,assignSlot,positions,eligibleForSlot,slotCandidates,slotShortlist,slotFitLabel,slotFitExplanation,rosterEligibility} from '../public/legends.js';
import {mlbSnapshots} from '../public/data-import.js';
import {readFileSync} from 'node:fs';
const table=(columns,rows,extra={})=>({id:'stats-1',provider:'Baseball-Reference CSV',url:'https://www.baseball-reference.com/players/o/oneilpa01.shtml',importedAt:'2026-09-01T00:00:00Z',label:'Selected franchise seasons',scope:'CIN · 1985–1992',playerId:null,columns,rows:rows.map(r=>r.map(String)),summary:[],...extra});
const player=(tables)=>({...newCandidate('Test Player'),statImports:tables});
test('estimates use weighted franchise production, qualifying peak and meaningful seasons',()=>{
 const c=contextFor(player([table(['Year','PA','OPS'],[[1990,600,.75],[1991,300,.9],[1992,20,1]])]));const x=suggestScores(c);
 assert.equal(x.performance.value,5.7);assert.equal(x.peak.value,4.9);assert.equal(x.longevity.value,1.3);assert.match(x.peak.reason,/Best three/);
 assert.deepEqual(Object.keys(x).sort(),[...AUTO_KEYS].sort());assert.equal(c.scores.performance,null);
});
test('pitching converts baseball innings to outs, computes ERA from ER and protects missing values',()=>{
 const c=player([table(['Year','IP','ER','ERA'],[[1990,'50.2',10,'1.78'],[1991,'50.1',20,'3.58']])]);const x=suggestScores(c);
 assert.deepEqual(x,{});assert.equal(keyStats(c).values.find(v=>v.label==='IP').value,'101.0');
 const missing=player([table(['Year','PA','OPS'],[[1990,'—','.900']])]);assert.deepEqual(suggestScores(missing),{});
 assert.deepEqual(suggestScores(player([table(['Year','IP','ERA'],[[1990,'60.5',3]])])),{});
});
test('ambiguous tables, duplicate years, totals, nonplayers and undersized samples do not fabricate scores',()=>{
 for(const t of [table(['Year','PA','OPS'],[[1990,500,.8],[1990,400,.9]]),table(['Year','PA','OPS'],[[1990,500,.8],['Career',500,.8]]),table(['PA','OPS'],[[500,.8]]),table(['Year','PA','OPS'],[[1990,5,1.8]])])assert.deepEqual(suggestScores(player([t])),{});
 const c=player([table(['Year','PA','OPS'],[[1990,500,.8]])]);c.type='Broadcaster';assert.deepEqual(suggestScores(c),{});
});
test('latest snapshot replaces overlapping evidence instead of adding seasons; ratings stay bounded',()=>{
 const c=contextFor(player([table(['Year','PA','OPS'],[[1990,600,.5]]),table(['Year','PA','OPS'],[[1990,600,.95]],{id:'new',importedAt:'2026-09-02T00:00:00Z'})]));const x=suggestScores(c);assert.equal(x.performance.value,9.5);assert.equal(x.longevity.value,.8);assert.equal(x.performance.sourceId,'new');
});
test('automatic refresh preserves manual scores, editorial factors, N/A and all FLS points',()=>{
 let c=contextFor(player([table(['Year','PA','OPS'],[[1990,600,.75]])]));c.scores.identity=9;c.scores.peak=8;c.fls.p1=160;c.na=['longevity'];let next=applyAutoScores(c);assert.equal(next.scores.performance,5.5);assert.equal(next.scores.peak,8);assert.equal(next.scores.identity,9);assert.equal(next.scores.longevity,null);assert.equal(next.fls.p1,160);
 next.statImports[0].rows[0][2]='.95';next=contextFor(next);next=applyAutoScores(next);assert.equal(next.scores.performance,9.5);next.scores.performance=7;delete next.autoScores.performance;next=applyAutoScores(next);assert.equal(next.scores.performance,7);
 next.scores.performance=null;next=applyAutoScores(next);next.statImports=[];next=applyAutoScores(next);assert.equal(next.scores.performance,null);assert.equal(next.scores.peak,8);
});
test('actual imported MLB fixture produces only Reds evidence and leaves lore ratings open',()=>{
 const payload=JSON.parse(readFileSync(new URL('./fixtures/paul-oneill.json',import.meta.url)));const c=player(mlbSnapshots(payload,{id:120028},'CIN',1882,2100));const next=applyAutoScores(c);assert.equal(next.scores.performance,null);assert.equal(next.scores.longevity,null);assert.equal(next.scores.attachment,null);assert.equal(keyStats(c).values.find(v=>v.label==='HR').value,'96');
});
test('key stat strip prefers regular-season totals over newer postseason totals',()=>{const regular=table(['Year','PA','H','HR','RBI','SB','AVG','OPS'],[[1976,500,150,20,90,8,'.300','.900']],{scope:'PHI · regular season',summary:[{label:'H',value:'150'},{label:'HR',value:'20'}]}),postseason=table(['Year','PA','H','HR','RBI','SB','AVG','OPS'],[[1976,12,2,1,2,0,'.200','.833']],{id:'post',scope:'PHI · postseason',importedAt:'2026-09-03T00:00:00Z',summary:[{label:'H',value:'2'},{label:'HR',value:'1'}]});const stats=keyStats(player([regular,postseason]));assert.equal(stats.values.find(v=>v.label==='H').value,'150');assert.match(stats.source.scope,/regular season/);});
test('Dick Allen card shows 3B, 1B and LF position-earned APEX',()=>{const data=JSON.parse(readFileSync(new URL('../public/data/apex/PHI.json',import.meta.url))),row=data.candidates.find(item=>item.name==='Dick Allen'),c=newCandidate(row.name);c.profile.advancedStats=row.advancedStats;const html=positionApexHTML(c,x=>String(x));for(const position of ['3B','1B','LF'])assert.match(html,new RegExp(`>${position}<`));assert.doesNotMatch(html,/>SS</);assert.match(html,/Overall APEX-H 35\.70/);});
test('roster draft respects actual positions, existing assignments and one player per slot',()=>{
 const make=(name,role,type='Player')=>{const c={...newCandidate(name,type),role};if(type==='Player')c.profile.advancedStats={franchiseSeasons:4,PA:/pitcher/i.test(role)?0:1200,IP:/pitcher/i.test(role)?400:0,startIP:/starting/i.test(role)?400:0,reliefIP:/relief/i.test(role)?150:0};return c;};const list=[make('Pitcher','Starting pitcher'),make('First','First base'),make('Catcher','Catcher'),make('Short','Shortstop'),make('Outfielder','Outfielder'),make('Manager','Manager','Manager / coach')];
 const r=draftRoster(list,newRoster());assert.equal(r.slots['1B'],list[1].id);assert.equal(r.slots.C,list[2].id);assert.equal(r.slots.SS,list[3].id);assert.equal(r.slots.SP1,list[0].id);assert.equal(r.slots.LF,list[4].id);assert.equal(r.manager,list[5].id);assert.equal(new Set(Object.values(r.slots)).size,Object.keys(r.slots).length);assert.deepEqual(positions(list[1]),['1B']);assert.equal(SLOTS.length,26);
 const moved=assignSlot(r,'DH',list[1].id);assert.equal(moved.slots['1B'],undefined);assert.equal(moved.slots.DH,list[1].id);assert.equal(r.slots['1B'],list[1].id);assert.deepEqual(draftRoster(list,moved),moved);
});
test('balanced draft selects the best hitter at DH, saves leader, left-handed specialist and coverage bench',()=>{
 const make=(name,pos,extra={})=>{const c=newCandidate(name),list=Array.isArray(pos)?pos:[pos],pitch=list.some(x=>x==='SP'||x==='RP');c.role=Array.isArray(pos)?pos.join('/') : pos;c.profile.positions=list;Object.assign(c.profile,extra);c.profile.advancedStats={franchiseSeasons:5,PA:pitch?0:1400,IP:pitch?500:0,startIP:list.includes('SP')?500:0,reliefIP:list.includes('RP')?150:0,...c.profile.advancedStats};return c;};
 const starters=['C','1B','2B','3B','SS','LF','CF','RF'].map(pos=>make('Starter '+pos,pos));
 // DH rule 2: the DH goes to the best hitter by run production (powerScore),
 // not to the career DH. Give the slugger the highest powerScore.
 const dh=make('Slugger','DH',{rosterRole:'dh'});dh.profile.advancedStats.HR=45;dh.profile.advancedStats.OPSPlus=160;dh.profile.advancedStats.runsBat=60;
 const rotation=Array.from({length:5},(_,i)=>make('Starter pitcher '+i,'SP'));
 const pen=Array.from({length:7},(_,i)=>make('Reliever '+i,'RP',{throws:i===5?'L':'R'}));pen[0].profile.advancedStats.SV=80;pen[4].profile.advancedStats.SV=300;
 const bench=[make('Backup catcher','C'),make('Utility',['2B','3B','SS']),make('Fourth outfielder',['CF','RF']),make('Corner bat',['1B','3B']),make('Power bat','LF')];bench[4].profile.advancedStats.OPSPlus=155;
 const list=[...starters,...rotation,...pen,...bench,dh];const r=draftRoster(list,newRoster());
 assert.equal(r.slots.DH,dh.id);assert.equal(r.slots.CL,pen[4].id);assert.equal(r.slots.LHS,pen[5].id);assert.equal(r.slots.C2,bench[0].id);assert.equal(r.slots.UTIL,bench[1].id);assert.equal(r.slots.OF4,bench[2].id);assert.equal(r.slots.CI,bench[3].id);assert.equal(r.slots.PH,bench[4].id);assert.equal(Object.keys(r.slots).length,26);
});
test('roster menus expose only players with franchise experience for each role',()=>{
 const first=newCandidate('First Baseman'),third=newCandidate('Third Baseman'),utility=newCandidate('Utility'),righty=newCandidate('Righty Reliever'),lefty=newCandidate('Lefty Reliever');
 first.profile.advancedStats={positionGames:{'1B':810},APEX_R:22,franchiseSeasons:6,PA:1800};third.profile.advancedStats={positionGames:{'3B':900},APEX_R:30,franchiseSeasons:6,PA:1800};utility.profile.advancedStats={positionGames:{'1B':14,'2B':220,'3B':180,SS:45},APEX_R:12,franchiseSeasons:5,PA:900};righty.profile.positions=['RP'];righty.profile.throws='R';righty.profile.advancedStats={franchiseSeasons:5,reliefIP:150,IP:150};lefty.profile.positions=['RP'];lefty.profile.throws='L';lefty.profile.advancedStats={franchiseSeasons:5,reliefIP:150,IP:150};
 const list=[third,first,utility,righty,lefty];assert.deepEqual(slotCandidates(list,'1B').map(c=>c.name),['First Baseman']);assert.equal(eligibleForSlot(third,'1B'),false);assert.equal(eligibleForSlot(utility,'1B'),false);assert.equal(eligibleForSlot(utility,'UTIL'),true);assert.deepEqual(slotCandidates(list,'LHS').map(c=>c.name),['Lefty Reliever']);assert.equal(slotFitLabel(first,'1B'),'1B · 810 G');
});
test('Best 26 eligibility enforces tenure and workload while one Legacy Legend can bypass workload only',()=>{
 const c=newCandidate('Short-tenure legend');c.role='Catcher';c.profile.positions=['C'];c.profile.advancedStats={franchiseSeasons:3,PA:700,positionGames:{C:300}};
 let status=rosterEligibility(c,'C');assert.equal(status.eligible,false);assert.match(status.reason,/50 more PA/);assert.equal(status.exceptionEligible,true);
 status=rosterEligibility(c,'C',{legacyExceptionId:c.id});assert.equal(status.eligible,true);assert.equal(status.usingException,true);
 c.profile.advancedStats.franchiseSeasons=2;status=rosterEligibility(c,'C',{legacyExceptionId:c.id});assert.equal(status.eligible,false);assert.equal(status.exceptionEligible,false);assert.match(status.reason,/1 more franchise season/);
});
test('guided roster shortlists keep the current choice and explain role coverage',()=>{
 const make=(i)=>{const c=newCandidate('Infielder '+i);c.role='2B / 3B / SS';c.profile.positions=['2B','3B','SS'];c.profile.advancedStats={franchiseSeasons:5,PA:1200+i,positionGames:{'2B':300,'3B':250,SS:200},APEX_R:i};return c;},list=Array.from({length:12},(_,i)=>make(i));
 const short=slotShortlist(list,'UTIL',list[11].id);assert.equal(short.length,9);assert.equal(short[0].id,list[11].id);assert.match(slotFitExplanation(list[0],'UTIL'),/covers 2B, 3B, SS/);
});
test('new backup fields round-trip; old backups migrate; removed players and invalid orders are handled',()=>{
 const state=seedState();const c=applyAutoScores(player([table(['Year','PA','OPS+'],[[1990,600,110]])]));state.boards.CIN.candidates=[c];state.boards.CIN.roster.slots.C=c.id;state.boards.CIN.autoStats=false;
 const restored=validateImport(JSON.parse(JSON.stringify(state))).state;assert.deepEqual(restored.boards,state.boards);
 const old=structuredClone(state);delete old.boards.CIN.roster;delete old.boards.CIN.autoStats;delete old.boards.CIN.candidates[0].autoScores;const migrated=validateImport(old).state;assert.deepEqual(migrated.boards.CIN.roster,newRoster());assert.equal(migrated.boards.CIN.autoStats,true);
 assert.deepEqual(cleanRoster(state.boards.CIN.roster,[]).slots,{});assert.throws(()=>cleanRoster({...newRoster(),order:Array(9).fill('C')},[c]),/order/);
 const oldRoster={...newRoster(),slots:{RP1:c.id}};assert.equal(cleanRoster(oldRoster,[c]).slots.CL,c.id);
 const malformed=structuredClone(state);malformed.boards.CIN.candidates[0].autoScores.performance={value:Infinity,sourceId:'invalid',reason:'invalid'};assert.throws(()=>validateImport(malformed),/automatic rating/);
});
