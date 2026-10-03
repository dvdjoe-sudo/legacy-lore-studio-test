import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import {waitForSource} from '../public/evidence-ui.js';
test('biographies are cached and a source cooldown prevents repeated upstream requests',async()=>{
 const original=globalThis.fetch,store=new Map();let calls=0,limited=false;
 const env={BUCKET:{async get(k){const value=store.get(k);return value?{json:async()=>JSON.parse(value)}:null;},async put(k,v){store.set(k,v);}}};
 globalThis.fetch=async()=>{calls++;if(limited)return new Response('',{status:429,headers:{'Retry-After':'120'}});return Response.json(calls===1?{query:{search:[{pageid:1,title:'Test Player'}]}}:{query:{pages:{1:{extract:'Test Player played for the Kansas City Royals.'}}}});};
 const request=name=>worker.fetch(new Request('https://studio.example/api/research?name='+encodeURIComponent(name)+'&team=KCR&from=1969&to=2026',{headers:{'oai-authenticated-user-id':'owner'}}),env);
 try{assert.equal((await request('Test Player')).status,200);assert.equal(calls,2);assert.equal((await request('Test Player')).status,200);assert.equal(calls,2);limited=true;const blocked=await request('Next Player');assert.equal(blocked.status,429);assert.equal((await blocked.json()).retryAfter,120);assert.equal(calls,3);assert.equal((await request('Another Player')).status,429);assert.equal(calls,3);}finally{globalThis.fetch=original;}
});
test('a cooldown can be paused immediately',async()=>{const c=new AbortController();const wait=waitForSource(Date.now()+120000,c.signal);c.abort();await assert.rejects(wait,{name:'AbortError'});});
test('Historical Almanac research returns a small attributed result set',async()=>{
 const original=globalThis.fetch,store=new Map(),env={BUCKET:{async get(k){const value=store.get(k);return value?{json:async()=>JSON.parse(value)}:null;},async put(k,v){store.set(k,v);}}};
 globalThis.fetch=async()=>Response.json({query:{pages:{1:{pageid:1,index:1,title:'1876 National League season',fullurl:'https://en.wikipedia.org/wiki/1876_National_League_season',extract:'The National League began play in 1876.'}}}});
 try{const response=await worker.fetch(new Request('https://studio.example/api/history-research?q=National+League&from=1876&to=1880',{headers:{'oai-authenticated-user-id':'owner'}}),env),data=await response.json();assert.equal(response.status,200);assert.equal(data.results.length,1);assert.match(data.license,/CC BY-SA/);assert.match(data.results[0].url,/wikipedia/);}finally{globalThis.fetch=original;}
});
test('Historical Almanac research excludes unrelated pages',async()=>{
 const original=globalThis.fetch,store=new Map(),env={BUCKET:{async get(k){const value=store.get(k);return value?{json:async()=>JSON.parse(value)}:null;},async put(k,v){store.set(k,v);}}};
 globalThis.fetch=async()=>Response.json({query:{pages:{1:{pageid:1,index:1,title:'Prelude in music',fullurl:'https://en.wikipedia.org/wiki/Prelude',extract:'A prelude is a short musical composition.'},2:{pageid:2,index:2,title:'1876 National League season',fullurl:'https://en.wikipedia.org/wiki/1876_National_League_season',extract:'The baseball season began National League play in 1876.'}}}});
 try{const response=await worker.fetch(new Request('https://studio.example/api/history-research?q=National+League&from=1876&to=1880',{headers:{'oai-authenticated-user-id':'owner'}}),env),data=await response.json();assert.equal(response.status,200);assert.deepEqual(data.results.map(result=>result.title),['1876 National League season']);assert.match(data.query,/Major League Baseball history/);}finally{globalThis.fetch=original;}
});
test('the Prelude never triggers automatic article research',async()=>{
 const env={};
 const response=await worker.fetch(new Request('https://studio.example/api/history-research?q=Prelude%3A+Before+the+First+Chapter',{headers:{'oai-authenticated-user-id':'owner'}}),env);
 assert.equal(response.status,400);
 assert.match((await response.json()).error,/approved introduction/i);
});
