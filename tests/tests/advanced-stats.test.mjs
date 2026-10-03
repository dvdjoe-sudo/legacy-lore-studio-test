import test from 'node:test';import assert from 'node:assert/strict';
import {newCandidate,validateImport,seedState} from '../public/model.js';
import {roleEraSuggestions,STAT_VERSION} from '../public/stat-context.js';
import {statStrip} from '../public/legends.js';

test('advanced bWAR role lanes boost catchers and elite relievers without raw-rate inflation',()=>{
 const yogi=newCandidate('Yogi Berra');yogi.role='Catcher';yogi.profile.advancedStats={found:true,version:STAT_VERSION,role:'BAT',totalWAR:59.7,batWAR:59.7,pitchWAR:0,peak5WAR:28.6,PA:8350,IP:0,seasons:18,source:'https://www.baseball-reference.com/data/'};
 const mariano=newCandidate('Mariano Rivera');mariano.role='Relief pitcher';mariano.profile.advancedStats={found:true,version:STAT_VERSION,role:'RP',totalWAR:56.3,batWAR:0,pitchWAR:56.3,peak5WAR:21.4,PA:4,IP:1283.7,seasons:19,source:'https://www.baseball-reference.com/data/'};
 const ordinary=newCandidate('Dave Righetti');ordinary.role='Relief pitcher';ordinary.profile.advancedStats={found:true,version:STAT_VERSION,role:'RP',totalWAR:22.9,batWAR:0,pitchWAR:22.9,peak5WAR:17,PA:0,IP:1136.7,seasons:11,source:'https://www.baseball-reference.com/data/'};
 assert.equal(roleEraSuggestions(yogi).performance.value,7.7);
 assert.equal(roleEraSuggestions(mariano).performance.value,8.6);
 assert.equal(roleEraSuggestions(ordinary).longevity.value,6.2);
 assert.ok(roleEraSuggestions(mariano).performance.value>roleEraSuggestions(ordinary).performance.value);
 const state=seedState();state.boards.NYY.candidates=[yogi,mariano,ordinary];assert.doesNotThrow(()=>validateImport(state));
});

test('player card shows advanced franchise value when available',()=>{
 const c=newCandidate('Babe Ruth');c.role='Outfield';c.profile.advancedStats={found:true,version:STAT_VERSION,role:'BAT',totalWAR:142.7,batWAR:142.8,pitchWAR:-.1,peak5WAR:62.5,PA:9200,IP:31,seasons:15,source:'https://www.baseball-reference.com/data/'};
 const html=statStrip(c,s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;'));
 assert.match(html,/142\.7/);assert.match(html,/Peak 5 WAR/);assert.match(html,/Baseball-Reference WAR data/);
});
