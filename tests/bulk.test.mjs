import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {matchPeople,resolveCandidate,fetchFranchise,mergePlayerStats} from '../public/bulk-lookup.js';
import {newCandidate,seedState,validateImport} from '../public/model.js';
const paul={id:120028,fullName:"Paul O'Neill",primaryPosition:{name:'Outfielder'}};
const payload=JSON.parse(fs.readFileSync(new URL('./fixtures/paul-oneill.json',import.meta.url)));
test('unique full-name matching handles accents/apostrophes and never guesses partial or ambiguous identities',()=>{
 assert.equal(matchPeople('Paul O’Neill',[paul]).automatic.id,120028);
 assert.equal(matchPeople('Paul',[paul]).automatic,null);
 assert.equal(matchPeople('Paul O’Neill',[paul,{...paul,id:999}]).automatic,null);
 assert.equal(matchPeople('Paul O’Neill',[paul,{...paul}]).choices.length,1);
 assert.equal(matchPeople('Paul O’Neill',[{...paul,id:'bad'}]).automatic,null);
 assert.deepEqual(matchPeople('Missing',null).choices,[]);
});
test('name lookup encodes names and returns choices without fetching unconfirmed identities',async()=>{
 const urls=[];const match=await resolveCandidate('Paul O’Neill',async url=>{urls.push(url);return {people:[paul]};});assert.equal(urls.length,1);assert.ok(urls[0].includes(encodeURIComponent('Paul O’Neill')));assert.equal(match.automatic.id,120028);
});
test('team fetch filters franchise seasons and waits for role/era context before scoring',async()=>{
 const tables=await fetchFranchise(paul,'CIN',1985,1992,async()=>payload);assert.equal(tables[0].rows.length,8);
 const c=newCandidate('Paul O’Neill');c.scores.identity=10;c.notes='My favorite Reds outfielder';c.fls.p1=100;
 const next=mergePlayerStats(c,tables,paul);assert.equal(next.id,c.id);assert.equal(next.name,c.name);assert.equal(next.notes,c.notes);assert.equal(next.fls.p1,100);assert.equal(next.scores.identity,10);assert.equal(next.scores.performance,null);assert.equal(next.role,'Outfielder');
 const state=seedState();state.boards.CIN.candidates=[next];assert.equal(validateImport(state).state.boards.CIN.candidates[0].statImports.length,tables.length);
 assert.equal(mergePlayerStats(next,tables,paul).statImports.length,tables.length);
 assert.equal(mergePlayerStats(c,tables,paul,false).scores.performance,null);
 assert.equal((await fetchFranchise(paul,'LAD',1884,2100,async()=>payload)).length,0);
});
test('late results after cancellation never become a resolved match or fetched tables',async()=>{
 for(const fn of [request=>resolveCandidate('Paul O’Neill',request,control.signal),request=>fetchFranchise(paul,'CIN',1985,1992,request,control.signal)]){var control=new AbortController();await assert.rejects(fn(async()=>{control.abort();return {...payload,people:[paul]};}),{name:'AbortError'});}
});
