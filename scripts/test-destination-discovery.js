import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import handler,{suggestDestinations,discoverDestination} from '../server/api/destination-discovery.js';
import {destinationExcursions,destinationFacts,destinationRestaurants,guideMatchesDestination} from '../server/api/_destination-experiences.js';

const source=await readFile(new URL('../discovery-studio.js',import.meta.url),'utf8');
const context=vm.createContext({});vm.runInContext(source,context);
assert.equal(vm.runInContext("calculateDiscoveryBudget('3','2','12.35')",context),7410);
for(const args of ["0,2,'10'","2,0,'10'","2,2,'0'","2,2,'1.001'","2.5,2,'10'","2,2,'100001'"]){assert.throws(()=>vm.runInContext(`calculateDiscoveryBudget(${args})`,context));}
const originalFetch=globalThis.fetch;let calls=0;
try{
  globalThis.fetch=async()=>{calls++;return {ok:true,json:async()=>({features:[{properties:{name:'Test City',state:'Test State',country:'Test Country',osm_value:'city'}},{properties:{name:'Cafe',osm_value:'restaurant'}},{properties:{name:'Test City',state:'Test State',country:'Test Country',osm_value:'city'}}]})};};
  assert.deepEqual(await suggestDestinations('test-city-unique'),[{name:'Test City',country:'Test Country',label:'Test City, Test State, Test Country'}]);
  await suggestDestinations('test-city-unique');assert.equal(calls,1,'Repeated suggestions use the bounded cache');
  globalThis.fetch=async()=>({ok:true,json:async()=>({features:[{properties:{name:'Tokyo',country:'Japan',osm_value:'province',type:'city'}},{properties:{name:'Tokyo International Airport',osm_value:'island',type:'other'}}]})});
  assert.deepEqual(await suggestDestinations('Tokyo'),[{name:'Tokyo',country:'Japan',label:'Tokyo, Japan'}],'Metropolitan provinces must appear without airport noise');
  globalThis.fetch=async url=>{const query=new URL(url).searchParams.get('gsrsearch');if(/museums landmarks|parks gardens/.test(query))throw new Error('One guide source failed');return {ok:true,json:async()=>({query:{pages:{1:{pageid:1,index:1,title:'Mockville',extract:'Mockville is the capital of Testland and is known for its historic streets.'},2:{pageid:2,index:2,title:'Mockville Museum',extract:'Mockville Museum is a museum in Mockville, Testland. It opened in 1960.'},3:{pageid:3,index:3,title:'Mockville Park',extract:'Mockville Park is a public park in Mockville, Testland.'}}}})};};
  const partial=await discoverDestination('Mockville, Testland');assert.equal(partial.excursions.length,2,'Partial guide failure must retain available excursion ideas');assert.equal(partial.facts.length,3);assert.equal(partial.livePrices,false);
  globalThis.fetch=async()=>({ok:false});
  await assert.rejects(discoverDestination('Unavailable-unique, Testland'),/temporarily unavailable/);
  const res={code:200,setHeader(){},status(code){this.code=code;return this;},json(value){this.body=value;}};
  await handler({method:'GET',url:'/api/destination-discovery?q=unavailable-city',headers:{}},res);
  assert.equal(res.code,503);assert.match(res.body.error,/temporarily unavailable/);
  await handler({method:'POST',url:'/api/destination-discovery',headers:{},body:{destination:''}},res);
  assert.equal(res.code,400);
}finally{globalThis.fetch=originalFetch;}
assert.match(source,/aria-activedescendant/);assert.match(source,/request!==version/);
const guides=[
  {id:'1',title:'Test Museum',description:'Test Museum is a museum in Tokyo, Japan. It opened in 1950 and is known for its sculpture collection.',sourceUrl:'https://en.wikipedia.org/?curid=1'},
  {id:'2',title:'Test Palace',description:'Test Palace is a historic palace in Tokyo, Japan.',sourceUrl:'https://en.wikipedia.org/?curid=2'},
  {id:'3',title:'Test Garden',description:'Test Garden is a botanical garden in Tokyo, Japan.',sourceUrl:'https://en.wikipedia.org/?curid=3'},
  {id:'4',title:'Test Neighborhood',description:'Test Neighborhood is a neighborhood in Tokyo, Japan.',sourceUrl:'https://en.wikipedia.org/?curid=4'},
  {id:'5',title:'Tourism in Tokyo',description:'Museums in Tokyo, Japan.'},
  {id:'6',title:'Wrong city',description:'This is a museum in Kyoto, Japan.'}
];
const excursions=destinationExcursions('Tokyo, Japan',[...guides,guides[0]]);
assert.equal(excursions.length,4);assert.equal(new Set(excursions.map(item=>item.title)).size,4);
assert.deepEqual(excursions.slice(0,3).map(item=>item.category),['Culture & history','Nature & outdoors','Neighborhoods']);
assert.equal(guideMatchesDestination('Paris, Texas, United States',{title:'Paris Museum',description:'A museum in Paris, France.'}),false);
assert.equal(guideMatchesDestination('Paris, Texas, United States',{title:'Paris landmark',description:'A landmark in Paris, Texas.'}),true);
const facts=destinationFacts([{title:'Tokyo',description:'Tokyo is the capital of Japan and is known for its historic neighborhoods.',sourceUrl:'https://en.wikipedia.org/?curid=7'}],excursions);
assert.equal(facts.length,3);assert.ok(facts.every(fact=>fact.text&&fact.sourceUrl&&fact.sourceTitle));
assert.ok(facts.some(fact=>fact.text.includes('opened in 1950')));
assert.deepEqual(destinationExcursions('Unknown',guides),[]);assert.deepEqual(destinationFacts([],[]),[]);
assert.match(source,/Ideas to research, not bookable tours/);assert.match(source,/renderDiscoveryFacts/);
const restaurants=destinationRestaurants('Tokyo, Japan',[
  {id:'20',title:'Example Bistro',description:'Example Bistro is a restaurant in Tokyo, Japan. It opened in 1980.'},
  {id:'21',title:'Wrong city',description:'A restaurant in Kyoto, Japan.'},
  {id:'22',title:'Japanese cuisine',description:'The cuisine of Tokyo, Japan includes restaurants.'},
  {id:'23',title:'Closed place',description:'A defunct restaurant in Tokyo, Japan.'},
  {id:'24',title:'Global chain',description:'A restaurant chain based in Tokyo, Japan.'},
  {id:'25',title:'Example restaurant attack',description:'An attack on a restaurant in Tokyo, Japan.'},
  {id:'20',title:'Example Bistro',description:'Example Bistro is a restaurant in Tokyo, Japan.'}
]);assert.equal(restaurants.length,1);assert.equal(restaurants[0].kind,'restaurant_idea');assert.equal(restaurants[0].category,'Restaurants');assert.match(source,/renderDiscoveryRestaurants/);
console.log('Destination discovery passed: suggestions, deduplication, cache, provider failures, empty search, exact-cent budget, invalid amounts, keyboard and stale-response guards.');
