import assert from 'node:assert/strict';
import handler from '../server/api/ai-planner.js';
const previous=process.env.ALLOW_PAID_AI,previousKey=process.env.OPENAI_API_KEY,originalFetch=globalThis.fetch;
try{
  delete process.env.ALLOW_PAID_AI;process.env.OPENAI_API_KEY='test-key-not-used';
  let calls=0;
  globalThis.fetch=async url=>{calls++;assert.ok(!String(url).includes('openai.com'),'Free mode must never call paid AI');return {ok:true,json:async()=>({query:{pages:{1:{pageid:1,title:'Mocktown',index:1,extract:'Mocktown is the capital of Testland, known for its historic streets.'}}}})};};
  const res={setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;}};
  await handler({method:'POST',headers:{},body:{query:'Private booking {reference:123}'}},res);
  assert.equal(res.code,200);assert.equal(calls,0,'Do not export private trip JSON to public search');assert.equal(res.body.generated,false);assert.equal(res.body.provider,'free_guides');
  await handler({method:'POST',headers:{},body:{answers:{destination:'Mocktown, Testland'}}},res);
  assert.equal(res.code,200);assert.equal(res.body.generated,false);assert.match(res.body.sourceLabel,/not AI/);assert.match(res.body.text,/Mocktown/);assert.ok(res.body.citations.length);assert.equal(res.body.live,false);
}finally{globalThis.fetch=originalFetch;if(previous===undefined)delete process.env.ALLOW_PAID_AI;else process.env.ALLOW_PAID_AI=previous;if(previousKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previousKey;}
console.log('Free planner passed: paid API disabled by default, private JSON not exported, source-backed guides clearly labeled as not AI.');
