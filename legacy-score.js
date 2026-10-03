// Legacy Lore: independent from classic lore and FLS worksheets.
export const LEGACY_FACTORS = [
 ['identity','Franchise identity',30,'How inseparable is this person from this franchise?'],
 ['connection','Enduring fan connection',25,'How consistently have fans embraced and remembered this person across generations?'],
 ['signature','Signature legacy',25,'What lasting stories, traditions, or influence did this person create?'],
 ['excellence','Excellence in their role',20,'How exceptional were their contributions with this franchise, compared with others in the same role?']
];
export const ANCHORS = {
 identity:'5: associated with an era. 8: a major franchise symbol. 10: a defining part of the team’s identity.',
 connection:'5: remembered by a meaningful fan group. 8: sustained attachment across eras. 10: exceptional, enduring attachment with historical evidence. Fame or controversy alone is not affection.',
 signature:'5: a lasting story or influence. 8: an iconic contribution still revisited. 10: a defining moment, tradition, or cultural impact. One moment can qualify; repeated articles are not extra achievements.',
 excellence:'5: meaningful success in the role. 8: outstanding franchise contribution. 10: historic role excellence. Players: performance, peak, longevity, defense and era. Broadcasters: craft, service and recognition. Managers: sustained leadership and results. Other roles: documented quality and impact, not popularity alone.'
};
export const blankLegacy = () => ({ratings:Object.fromEntries(LEGACY_FACTORS.map(([k])=>[k,null])),evidence:Object.fromEntries(LEGACY_FACTORS.map(([k])=>[k,{reason:'',source:'',confidence:'needs-research'}])),moment:'',momentSource:''});
export function safeSource(v){try{const u=new URL(v);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}}
export function evidenceIssues(c){const l=c.legacy||blankLegacy();return LEGACY_FACTORS.filter(([k])=>l.ratings[k]!=null&&(l.evidence[k]?.confidence==='needs-research'||(l.ratings[k]>=9&&(!l.evidence[k]?.reason?.trim()||!safeSource(l.evidence[k]?.source))))).map(([k])=>k);}
export function calculateLegacy(c,weights=LEGACY_FACTORS.map(f=>f[2])){
 const l=c.legacy||blankLegacy(),parts=LEGACY_FACTORS.map(([key,label],i)=>({key,label,max:10,weight:weights[i],value:l.ratings[key]??null}));
 const filled=parts.filter(p=>p.value!==null),assessed=filled.length===4,issues=evidenceIssues(c);
 const subtotal=parts.reduce((n,p)=>n+(p.value??0)/10*p.weight,0);
 return {value:assessed?subtotal:null,subtotal,complete:assessed&&issues.length===0,assessed,review:issues,applicable:true,coverage:filled.length/4,max:100,parts};
}
export function cleanLegacy(raw){
 if(raw==null)return blankLegacy();
 if(typeof raw!=='object'||!raw.ratings||!raw.evidence)throw Error('Invalid Legacy Lore worksheet.');
 const out=blankLegacy();const text=(v,max)=>{if(typeof v!=='string'||v.length>max)throw Error('Invalid Legacy Lore evidence.');return v;};
 for(const [k] of LEGACY_FACTORS){const v=raw.ratings[k];if(v!==null&&(typeof v!=='number'||!Number.isFinite(v)||v<0||v>10))throw Error('Legacy Lore ratings must be blank or 0–10.');out.ratings[k]=v;
 const e=raw.evidence[k];if(!e||!['needs-research','low','medium','high'].includes(e.confidence))throw Error('Invalid evidence confidence.');
 out.evidence[k]={reason:text(e.reason,4000),source:text(e.source,2000),confidence:e.confidence};if(e.source&&!safeSource(e.source))throw Error('Evidence links must be HTTP or HTTPS.');
 }out.moment=text(raw.moment??'',1000);out.momentSource=text(raw.momentSource??'',2000);if(out.momentSource&&!safeSource(out.momentSource))throw Error('Invalid signature-moment source.');return out;
}
export function closeCall(a,b){const x=calculateLegacy(a),y=calculateLegacy(b);if(!x.complete||!y.complete)return null;
 const gap=x.value-y.value;const changes=[];
 for(const [k,,w] of LEGACY_FACTORS){for(const who of ['a','b'])for(const delta of [-1,1]){const c=who==='a'?a:b;const before=c.legacy.ratings[k],after=Math.max(0,Math.min(10,before+delta));const next=gap+(who==='a'?1:-1)*(after-before)/10*w;if(gap===0||next===0||Math.sign(next)!==Math.sign(gap))changes.push({factor:k,candidate:who,delta:after-before});}}
 return {close:changes.length>0,gap:Math.abs(gap),changes};
}
