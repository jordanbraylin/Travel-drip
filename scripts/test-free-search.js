import assert from 'node:assert/strict';
import handler from '../server/api/travel-search.js';
const originalFetch=globalThis.fetch;
const oldPlaces=process.env.GOOGLE_PLACES_API_KEY,oldMaps=process.env.GOOGLE_MAPS_API_KEY;
const response=()=>({headers:{},setHeader(name,value){this.headers[name]=value;},status(code){this.statusCode=code;return this;},json(body){this.body=body;}});
try{
  delete process.env.GOOGLE_PLACES_API_KEY;delete process.env.GOOGLE_MAPS_API_KEY;
  globalThis.fetch=async(url)=>{assert.equal(new URL(url).origin,'https://en.wikipedia.org');return {ok:true,json:async()=>({query:{pages:{1:{pageid:1,index:1,title:'Inline search guide',extract:'A reference guide.'}}}})};};
  for(const method of ['GET','POST'])for(const provider of [undefined,'auto','duckduckgo']){
    const data={destination:'Paris, France',category:'food',...(provider?{provider}:{})};const res=response();
    await handler({method,headers:{},...(method==='GET'?{query:data}:{body:data})},res);
    assert.equal(res.statusCode,200);assert.equal(res.body.provider,'in_app');assert.equal(res.body.liveAvailability,false);assert.equal(res.body.results.length,1);
    assert.equal(res.headers.Location,undefined);assert.equal(res.body.searchUrl,undefined,'No external search launch link');
  }
  process.env.GOOGLE_PLACES_API_KEY='test-only';
  globalThis.fetch=async(url,options)=>{assert.equal(String(url),'https://places.googleapis.com/v1/places:searchText');assert.equal(options.headers['X-Goog-Api-Key'],'test-only');return {ok:true,json:async()=>({places:[{id:'place',displayName:{text:'Paris museum'}}]})};};
  for(const method of ['GET','POST']){
    const data={destination:'Paris',category:'activities'};const res=response();await handler({method,headers:{},...(method==='GET'?{query:data}:{body:data})},res);
    assert.equal(res.body.provider,'google_places');assert.equal(res.body.results[0].title,'Paris museum');assert.equal(res.headers.Location,undefined);assert.equal(res.body.searchUrl,undefined);
  }
  const invalid=response();await handler({method:'POST',headers:{},body:{provider:'unknown'}},invalid);assert.equal(invalid.statusCode,400);
  console.log('Inline search passed: no search redirects or external launch links, legacy clients stay inline, Google preferred when configured, reference guides honestly labeled when Google is absent.');
}finally{
  globalThis.fetch=originalFetch;
  for(const [name,value]of [['GOOGLE_PLACES_API_KEY',oldPlaces],['GOOGLE_MAPS_API_KEY',oldMaps]])if(value===undefined)delete process.env[name];else process.env[name]=value;
}
