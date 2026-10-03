import test from 'node:test';
import assert from 'node:assert/strict';
import {createCloudSave} from '../public/cloud-save.js';
import {seedState} from '../public/model.js';
test('full browser storage does not block cloud saves or hide failures and conflicts',async()=>{
 const previous={fetch:globalThis.fetch,window:globalThis.window,localStorage:globalThis.localStorage};let state=seedState(),saved,status=200,revision=0;
 globalThis.window={addEventListener(){}};globalThis.localStorage={getItem(){return null;},setItem(){throw Error('QuotaExceededError');},removeItem(){}};
 globalThis.fetch=async(path,options={})=>{if(!options.method)return Response.json({revision,state:null});if(status!==200)return Response.json({error:'Test failure'},{status});saved=JSON.parse(options.body).state;return Response.json({revision:++revision});};
 try{const cloud=createCloudSave({getState:()=>state});state=await cloud.start(state);assert.equal(cloud.status,'Saved to your account');assert.match(cloud.cacheIssue,/recovery copy unavailable/);assert.ok(saved.boards.LAD);
 state.boards.LAD.notes='Keep my changes';status=500;cloud.schedule();await cloud.flush();assert.match(cloud.status,/Cloud save failed/);status=200;await cloud.retry();assert.equal(saved.boards.LAD.notes,'Keep my changes');assert.equal(cloud.status,'Saved to your account');
 status=409;cloud.schedule();await cloud.flush();assert.match(cloud.status,/Save conflict/);
 }finally{Object.assign(globalThis,previous);}
});
