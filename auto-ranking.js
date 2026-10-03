import {loreDraft,applyLoreDraft} from './lore-autofill.js';
import {applyAutoScores} from './legends.js';
import {calculate,rankByScore} from './model.js';
import {PILOT_ROWS,pilotCandidate} from './scoring-pilot.js';
import {normalizedName,FRANCHISE_DATA} from './data-import.js';
import {effectiveScope} from './franchise-scope.js';
export function previewAutoRanking(board,team,{lens='legacy',useLore=true}={}){
 let filled=0,loreFilled=0;
 const candidates=board.candidates.map(original=>{let c=applyAutoScores(original);for(const key of ['performance','peak','longevity'])if(original.scores[key]==null&&c.scores[key]!=null)filled++;if(useLore){c=applyLoreDraft(c,loreDraft(c,team,board.studio));for(const key of ['identity','connection','signature','excellence'])if(original.legacy.ratings[key]==null&&c.legacy.ratings[key]!=null)loreFilled++;}return c;});
 const value=c=>{const s=calculate(c,lens,board.weights);return s.complete?s.value:null;};
 const rows=candidates.map((c,index)=>({candidate:c,index,value:value(c)}));rows.sort((a,b)=>a.value===null?(b.value===null?a.index-b.index:1):b.value===null?-1:b.value-a.value||a.index-b.index);
 const eligible=rows.filter(r=>r.value!==null);const picked=new Set(eligible.slice(0,200).map(r=>r.candidate.id));
 const originalRanked=board.candidates.filter(c=>!c.profile.pool),oldIds=new Set(originalRanked.map(c=>c.id));
 const assessed=rows.filter(r=>r.value!==null&&(picked.has(r.candidate.id)||oldIds.has(r.candidate.id))).map(r=>r.candidate);
 const anchors=new Map(originalRanked.map((c,i)=>[i,rows.find(r=>r.candidate.id===c.id)]).filter(([,r])=>r.value===null).map(([i,r])=>[i,r.candidate]));
 const ordered=[];let cursor=0;for(let i=0;i<assessed.length+anchors.size;i++)ordered.push(anchors.get(i)||assessed[cursor++]);
 const rankedIds=new Set(ordered.map(c=>c.id));const updated=[...ordered.map(c=>({...c,profile:{...c.profile,pool:false}})),...rows.filter(r=>!rankedIds.has(r.candidate.id)).map(r=>({...r.candidate,profile:{...r.candidate.profile,pool:true}}))];

 return {candidates:updated,rows,eligible:eligible.length,filled,loreFilled,top:rankByScore(updated.filter(c=>!c.profile.pool),lens,board.weights).slice(0,200),lens};
}
export function applyRankingPreview(board,preview){board.candidates=preview.candidates;board.studio.scoringNotice=false;board.studio.lastAutoRanking={at:new Date().toISOString(),lens:preview.lens,eligible:preview.eligible,values:Object.fromEntries(preview.rows.filter(r=>r.value!==null).map(r=>[r.candidate.id,r.value]))};}
