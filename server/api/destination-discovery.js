import {applySecurityHeaders,getRequestBody,methodNotAllowed} from './_security.js';
import {searchTravelGuides} from './_travel-guides.js';
const cache=new Map(),rates=new Map();
function remember(key,value,ttl){if(cache.size>=200)cache.delete(cache.keys().next().value);cache.set(key,{value,until:Date.now()+ttl});return value;}
export async function suggestDestinations(query){
  const q=String(query||'').trim().slice(0,120);if(q.length<2)return[];
  const key=`suggest:${q.toLowerCase()}`,saved=cache.get(key);if(saved?.until>Date.now())return saved.value;
  const url=new URL('https://photon.komoot.io/api/');url.search=new URLSearchParams({q,limit:'7',lang:'en'}).toString();
  const response=await fetch(url,{headers:{'User-Agent':'Travel-Drip/1.0 (https://travel-drip.com)',Accept:'application/json'},signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw new Error('Location suggestions are temporarily unavailable.');
  const data=await response.json();const results=(data.features||[]).filter(f=>['city','town','village','municipality','country','state','county','province','island'].includes(f.properties?.osm_value)&&!['house','street'].includes(f.properties?.type)&&! /\bairport\b/i.test(f.properties?.name||'')).map(f=>{const p=f.properties;return {name:p.name,country:p.country||'',label:[...new Set([p.name,p.state,p.country].filter(Boolean))].join(', ')};}).filter(p=>p.name);
  return remember(key,[...new Map(results.map(p=>[p.label,p])).values()].slice(0,5),300000);
}
export async function discoverDestination(query){
  const q=String(query||'').trim().slice(0,160);if(q.length<2)throw Object.assign(new Error('Enter a city and country.'),{status:400});
  const key=`discover:${q.toLowerCase()}`,saved=cache.get(key);if(saved?.until>Date.now())return saved.value;
  const city=q.split(',')[0].replace(/["\\]/g,'').trim();
  const results=await Promise.allSettled([
    searchTravelGuides({query:q,category:'trending'}),
    searchTravelGuides({query:`intitle:"${city}" tourist attractions`,category:'activities'}),
    searchTravelGuides({query:`"${city}" cuisine`,category:'food'})
  ]);
  const sections=['about','activities','food'];const payload={destination:q,fetchedAt:new Date().toISOString(),source:'Wikipedia contributors',livePrices:false};
  results.forEach((result,i)=>{let rows=result.status==='fulfilled'?result.value.results:[];rows=rows.filter(row=>! /disambiguation/i.test(row.title));if(i===0)rows=rows.filter(row=>row.title.toLowerCase()===city.toLowerCase()||row.title.toLowerCase().startsWith(`${city.toLowerCase()},`));if(i===1)rows=rows.filter(row=>/touris|museum|attraction|scenic|neighborhood|district|temple|park|palace|garden|building complex/i.test(`${row.title} ${row.description}`));payload[sections[i]]=rows.slice(0,4);});
  if(!sections.some(key=>payload[key].length))throw new Error('Destination guides are temporarily unavailable. Please try again.');
  return remember(key,payload,600000);
}
export default async function handler(req,res){applySecurityHeaders(res);if(!['GET','POST'].includes(req.method))return methodNotAllowed(res,'GET, POST');const ip=String(req.headers['x-forwarded-for']||'unknown').split(',')[0],now=Date.now();let rate=rates.get(ip);if(!rate||rate.until<now){rate={count:0,until:now+60000};if(rates.size>=500)rates.delete(rates.keys().next().value);rates.set(ip,rate);}if(++rate.count>60)return res.status(429).json({error:'Please pause briefly before searching again.'});try{if(req.method==='GET'){const url=new URL(req.url,'https://travel-drip.com');return res.status(200).json({suggestions:await suggestDestinations(url.searchParams.get('q'))});}res.status(200).json(await discoverDestination(getRequestBody(req).destination));}catch(error){res.status(error.status||503).json({error:error.message});}}
