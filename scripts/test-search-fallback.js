import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../app.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('async function liveSearchApiRequest('),source.indexOf('function renderInviteQrCode('));
const calls=[];
let failure=null;
const context=vm.createContext({isFilePreview:false,state:{session:null},fetch:async(path,options)=>{
  const body=JSON.parse(options.body);calls.push({path,body});
  if(body.provider==='live'&&failure)return {ok:false,status:failure.status,json:async()=>({error:'Live provider unavailable',code:failure.code})};
  return {ok:true,json:async()=>body.provider==='live'?{provider:'google_places',live:true,results:[{title:'Current place'}]}:{provider:'in_app',liveAvailability:false,results:[{title:'Paris guide'}]}};
}});
vm.runInContext(code,context);
const search=()=>vm.runInContext('searchTravelWithGuides({provider:"live",category:"food",destination:"Paris, France",q:"restaurants"})',context);
let result=await search();assert.equal(result.provider,'google_places');assert.equal(calls.length,1);
for(const errorCode of ['provider_not_configured','live_transport_not_connected']){
  calls.length=0;failure={status:503,code:errorCode};result=await search();
  assert.equal(result.provider,'in_app');assert.equal(result.liveAvailability,false);assert.equal(result.fallbackReason,'live_search_not_connected');
  assert.equal(calls.length,2);assert.equal(calls[1].body.provider,'auto');assert.equal(calls[1].body.destination,'Paris, France');assert.equal(calls[1].body.q,'restaurants');
}
for(const error of [{status:401,code:'unauthorized'},{status:400,code:'missing_query'},{status:429,code:'rate_limit'},{status:502,code:'provider_error'},{status:503,code:'unexpected_failure'}]){
  calls.length=0;failure=error;await assert.rejects(search(),e=>e.status===error.status&&e.code===error.code);assert.equal(calls.length,1,'Do not mask unrelated errors or retry rate limits');
}
calls.length=0;failure={status:503,code:'provider_not_configured'};
result=await vm.runInContext('searchTravelWithGuides({provider:"in_app",destination:"Tokyo"})',context);
assert.equal(calls.length,1);assert.equal(result.fallbackReason,undefined);
console.log('Search fallback passed: live success preserved, missing connections show honest in-app guides, search terms preserved, authentication/validation/rate-limit failures remain errors.');
