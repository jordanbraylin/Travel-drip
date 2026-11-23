import assert from 'node:assert/strict';
const original=globalThis.fetch,oldUrl=process.env.SUPABASE_URL,oldKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.SUPABASE_URL='https://test.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='test-only';
let count=0,stored,produced=0,fail=false;
try{
 globalThis.fetch=async(url,options)=>{
  const u=String(url);if(u.includes('/rpc/')){const body=JSON.parse(options.body);assert.match(body.p_key,/^[a-f0-9]{64}$/);assert.ok(!JSON.stringify(body).includes('192.0.2.1'));return new Response(fail?'{}':JSON.stringify(++count<=body.p_limit),{status:fail?500:200,headers:{'Content-Type':'application/json'}});}
  if(options.method==='POST'){stored=JSON.parse(options.body);return new Response(null,{status:201});}
  return new Response(JSON.stringify(stored?[{payload:stored.payload,expires_at:stored.expires_at}]:[]),{headers:{'Content-Type':'application/json'}});
 };
 const one=await import('../server/api/_search-store.js?one'),two=await import('../server/api/_search-store.js?two');
 const res=()=>({setHeader(){},status(n){this.code=n;return this;},json(b){this.body=b;}}),req={headers:{'x-forwarded-for':'192.0.2.1'}};
 assert.equal(await one.takeSearchSlot(req,res(),'test',2),true);assert.equal(await two.takeSearchSlot(req,res(),'test',2),true);let response=res();assert.equal(await two.takeSearchSlot(req,response,'test',2),false);assert.equal(response.code,429);
 const a=await one.cachedPublicResult('test','public-query',60,async()=>{produced++;return {results:['public guide']};});
 const b=await two.cachedPublicResult('test','public-query',60,async()=>{produced++;return {results:[]};});assert.deepEqual(a,b);assert.equal(produced,1,'A separate server instance reuses the database cache');
 fail=true;response=res();assert.equal(await one.takeSearchSlot(req,response,'test',2),false);assert.equal(response.code,503,'Database protection failure must not silently bypass limits');
 console.log('Shared search store passed: cross-instance counter/cache calls, hashed client identity, rate rejection and fail-closed behavior.');
}finally{globalThis.fetch=original;for(const [key,value]of [['SUPABASE_URL',oldUrl],['SUPABASE_SERVICE_ROLE_KEY',oldKey]])if(value===undefined)delete process.env[key];else process.env[key]=value;}
