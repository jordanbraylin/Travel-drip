import assert from 'node:assert/strict';
import {searchOpenPlaces} from '../server/api/_open-places.js';
const oldFetch=globalThis.fetch;let calls=0;
try{
  globalThis.fetch=async url=>{calls++;const u=new URL(url);assert.equal(u.origin,'https://photon.komoot.io');assert.equal(u.searchParams.get('lang'),'en');return {ok:true,json:async()=>u.searchParams.has('bbox')?{features:[{properties:{name:'Test Restaurant',osm_key:'amenity',osm_value:'restaurant',osm_type:'N',osm_id:123,city:'Test City'}},{properties:{name:'Wrong category',osm_key:'highway',osm_value:'bus_stop',osm_type:'N',osm_id:124}},{properties:{name:'Duplicate',osm_key:'amenity',osm_value:'restaurant',osm_type:'N',osm_id:123}}]}:{features:[{properties:{name:'Test City',osm_value:'city'},geometry:{coordinates:[2.35,48.85]}}]}};};
  const p=await searchOpenPlaces({destination:'Test City',category:'food'});assert.equal(p.provider,'openstreetmap');assert.equal(p.live,false);assert.equal(p.liveAvailability,false);assert.equal(p.results.length,1);assert.equal(p.results[0].sourceUrl,'https://www.openstreetmap.org/node/123');assert.equal(p.results[0].license,'ODbL');assert.equal(p.results[0].sourceLabel,'OpenStreetMap contributors');
  await searchOpenPlaces({destination:'Test City',category:'food'});assert.equal(calls,2,'Cache avoids repeat provider traffic');
  await assert.rejects(()=>searchOpenPlaces({destination:'Test',category:'flights'}));
  globalThis.fetch=async()=>({ok:false,status:429});await assert.rejects(()=>searchOpenPlaces({destination:'Unavailable City',category:'food'}));
  globalThis.fetch=async()=>({ok:true,json:async()=>({features:[{properties:{osm_value:'city'},geometry:{coordinates:['invalid',null]}}]})});await assert.rejects(()=>searchOpenPlaces({destination:'Bad Coordinates',category:'food'}));
  console.log('Open places passed: bounded searches, correct category, deduplication, source attribution, no live availability claims, cached responses, provider failure and coordinate validation.');
}finally{globalThis.fetch=oldFetch;}
