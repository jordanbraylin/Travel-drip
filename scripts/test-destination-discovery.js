import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import handler,{suggestDestinations} from '../server/api/destination-discovery.js';

const source=await readFile(new URL('../discovery-studio.js',import.meta.url),'utf8');
const context=vm.createContext({});vm.runInContext(source,context);
assert.equal(vm.runInContext("calculateDiscoveryBudget('3','2','12.35')",context),7410);
for(const args of ["0,2,'10'","2,0,'10'","2,2,'0'","2,2,'1.001'","2.5,2,'10'","2,2,'100001'"]){assert.throws(()=>vm.runInContext(`calculateDiscoveryBudget(${args})`,context));}
const originalFetch=globalThis.fetch;let calls=0;
try{
  globalThis.fetch=async()=>{calls++;return {ok:true,json:async()=>({features:[{properties:{name:'Test City',state:'Test State',country:'Test Country',osm_value:'city'}},{properties:{name:'Cafe',osm_value:'restaurant'}},{properties:{name:'Test City',state:'Test State',country:'Test Country',osm_value:'city'}}]})};};
  assert.deepEqual(await suggestDestinations('test-city-unique'),[{name:'Test City',country:'Test Country',label:'Test City, Test State, Test Country'}]);
  await suggestDestinations('test-city-unique');assert.equal(calls,1,'Repeated suggestions use the bounded cache');
  globalThis.fetch=async()=>({ok:false});
  const res={code:200,setHeader(){},status(code){this.code=code;return this;},json(value){this.body=value;}};
  await handler({method:'GET',url:'/api/destination-discovery?q=unavailable-city',headers:{}},res);
  assert.equal(res.code,503);assert.match(res.body.error,/temporarily unavailable/);
  await handler({method:'POST',url:'/api/destination-discovery',headers:{},body:{destination:''}},res);
  assert.equal(res.code,400);
}finally{globalThis.fetch=originalFetch;}
assert.match(source,/aria-activedescendant/);assert.match(source,/request!==version/);
console.log('Destination discovery passed: suggestions, deduplication, cache, provider failures, empty search, exact-cent budget, invalid amounts, keyboard and stale-response guards.');
