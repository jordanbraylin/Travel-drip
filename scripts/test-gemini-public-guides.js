import assert from 'node:assert/strict';
import {summarizePublicGuides} from '../server/api/_gemini-public-guides.js';
const oldFetch=globalThis.fetch,key=process.env.GEMINI_API_KEY,confirmed=process.env.GEMINI_FREE_TIER_CONFIRMED;
try{
  let calls=0,sent;
  globalThis.fetch=async(url,options)=>{calls++;assert.match(url,/^https:\/\/generativelanguage.googleapis.com\/v1beta\/models\/gemini-2.5-flash-lite:generateContent$/);sent=JSON.parse(options.body);return {ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:'A public destination summary.'}]}}]})};};
  const fallback={provider:'free_guides',generated:false,live:false,text:'Reference text',citations:[]};
  const guides=[{title:'Public destination',description:'Public guide text',sourceUrl:'https://en.wikipedia.org/?curid=1',privateBooking:'DO-NOT-SEND',user_id:'PRIVATE-USER'}];
  delete process.env.GEMINI_FREE_TIER_CONFIRMED;process.env.GEMINI_API_KEY='test-only';
  assert.equal(await summarizePublicGuides(guides,fallback),fallback);assert.equal(calls,0,'No AI call until free-tier confirmation');
  process.env.GEMINI_FREE_TIER_CONFIRMED='true';const ai=await summarizePublicGuides(guides,fallback);
  assert.equal(ai.provider,'gemini');assert.equal(ai.generated,true);assert.equal(ai.live,false);assert.doesNotMatch(JSON.stringify(sent),/DO-NOT-SEND|PRIVATE-USER/);assert.equal(sent.tools,undefined,'No paid grounding tools');
  await summarizePublicGuides(guides,fallback);assert.equal(calls,1,'Reuse cached public summary');
  globalThis.fetch=async()=>({ok:false,status:429});const limited=await summarizePublicGuides([{...guides[0],title:'Another destination'}],fallback);assert.equal(limited.generated,false);assert.equal(limited.provider,'free_guides');assert.equal(limited.aiStatus,'temporarily_unavailable');
  console.log('Gemini public guides passed: explicit free-tier configuration, only allowlisted public fields sent, no paid tools, bounded caching, honest quota fallback.');
}finally{globalThis.fetch=oldFetch;for(const [name,value]of [['GEMINI_API_KEY',key],['GEMINI_FREE_TIER_CONFIRMED',confirmed]])if(value===undefined)delete process.env[name];else process.env[name]=value;}
