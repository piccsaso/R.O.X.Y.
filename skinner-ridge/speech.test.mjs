import assert from 'node:assert/strict';
import {createSpeech} from './speech.mjs';

let player, utterance, fallback=0, finished=0;
globalThis.window={speechSynthesis:{cancel(){},speak(value){utterance=value;}}};
globalThis.SpeechSynthesisUtterance=class {constructor(text){this.text=text;}};
globalThis.Audio=class {
  constructor(){player=this;}
  async play(){}
  pause(){}
  removeAttribute(){}
  load(){}
};
globalThis.fetch=async()=>new Response(new Blob(['test audio']),{status:200});
const speech=createSpeech(()=>fallback++);
await speech.speak('Route ready',()=>finished++);
assert.equal(finished,0,'Recognition must stay paused during provider playback');
player.onended();
assert.equal(finished,1,'Provider playback completion must resume recognition');
speech.cancel();
assert.equal(finished,1,'Completion must fire only once');

await speech.speak('Cancel this',()=>finished++);
speech.cancel();
assert.equal(finished,2,'Cancellation must release recognition');

globalThis.fetch=async()=>new Response('',{status:503});
await speech.speak('Browser fallback',()=>finished++);
assert.equal(fallback,1);
assert.equal(finished,2,'Fallback must wait for actual speech completion');
assert.equal(utterance.text,'Browser fallback');
utterance.onend();
assert.equal(finished,3);

await speech.speak('Old reply',()=>finished++);
const stale=utterance;
await speech.speak('New reply',()=>finished++);
assert.equal(finished,4);
stale.onend();
assert.equal(finished,4,'Stale audio must not finish a newer reply');
utterance.onerror();
assert.equal(finished,5);
let playback=0,resolveRequest;
globalThis.fetch=()=>new Promise(resolve=>{resolveRequest=resolve;});
const pending=speech.speak('Delayed audio',()=>finished++,()=>playback++);
assert.equal(playback,0,'Do not pause recognition while fetching audio');
resolveRequest(new Response(new Blob(['audio']),{status:200}));
await pending;
assert.equal(playback,1,'Pause only when playback is about to begin');
player.onended();
assert.equal(finished,6);

globalThis.fetch=(_url,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('aborted'))));
const bounded=createSpeech(()=>fallback++,{timeoutMs:20});
await bounded.speak('Timed out provider',()=>finished++,()=>playback++);
assert.equal(utterance.text,'Timed out provider','Slow provider must fall back to browser speech');
assert.equal(playback,2);
utterance.onend();
assert.equal(finished,7);
console.log('Speech playback completion, cancellation, fallback and stale-callback checks passed');
