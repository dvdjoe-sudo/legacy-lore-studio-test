import {normalizedName} from './data-import.js';
import {newCandidate} from './model.js';
export const discoveryKey=p=>p.mlbId?'mlb:'+p.mlbId:'name:'+normalizedName(p.name);
export function candidateSuggestions(board,items){const names=new Set(board.candidates.map(c=>normalizedName(c.name))),ids=new Set(board.candidates.map(c=>c.profile?.mlbId).filter(Boolean)),excluded=new Set(board.studio.exclusions);return items.filter(p=>!names.has(normalizedName(p.name))&&!ids.has(p.mlbId)&&!excluded.has(discoveryKey(p)));}
export function acceptDiscovered(board,person){if(!candidateSuggestions(board,[person]).length)return false;const c=newCandidate(person.name,person.type||'Player');c.role=person.role||'';c.era=person.era||'';c.profile.pool=true;c.profile.mlbId=person.mlbId||null;c.profile.whyAdded=person.whyAdded||'';if(person.advancedStats)c.profile.advancedStats=person.advancedStats;c.sources=person.source||'';board.candidates.push(c);return true;}
// A biography is evidence to read, never proof of team-specific fan love.
export function evidencePrompts(research,teamName){const text=research?.extract||'';return [
 {key:'identity',question:`Which documented ${teamName} contributions make this person part of the franchise identity?`},
 {key:'connection',question:'Is there evidence of enduring fan attachment, such as later tributes, recurring rituals or community remembrance?'},
 {key:'signature',question:'Which signature moment belongs to this franchise and your selected years?'},
 {key:'excellence',question:'What shows excellence in this person’s role, with era and franchise context?'}
 ].map(p=>({...p,available:!!text,source:research?.source||''}));}
