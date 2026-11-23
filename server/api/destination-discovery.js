import {takeSearchSlot} from './_search-store.js';
import {searchOpenPlaces,photonPublicLookup} from './_open-places.js';
import {applySecurityHeaders,getRequestBody,methodNotAllowed} from './_security.js';
import {searchTravelGuides} from './_travel-guides.js';
import {destinationExcursions,destinationFacts,destinationRestaurants,guideMatchesDestination} from './_destination-experiences.js';
import {destinationPhotos} from './_destination-photos.js';
const cache=new Map();
function remember(key,value,ttl){if(cache.size>=200)cache.delete(cache.keys().next().value);cache.set(key,{value,until:Date.now()+ttl});return value;}
export async function suggestDestinations(query){
  const q=String(query||'').trim().slice(0,120);if(q.length<2)return[];
  const key=`suggest:${q.toLowerCase()}`,saved=cache.get(key);if(saved?.until>Date.now())return saved.value;
  const data={features:await photonPublicLookup({q,limit:'7'})};const results=(data.features||[]).filter(f=>['city','town','village','municipality','country','state','county','province','island'].includes(f.properties?.osm_value)&&!['house','street'].includes(f.properties?.type)&&! /\bairport\b/i.test(f.properties?.name||'')).map(f=>{const p=f.properties;return {name:p.name,country:p.country||'',label:[...new Set([p.name,p.state,p.country].filter(Boolean))].join(', ')};}).filter(p=>p.name);
  return remember(key,[...new Map(results.map(p=>[p.label,p])).values()].slice(0,5),300000);
}
export async function discoverDestination(query){
  const q=String(query||'').trim().slice(0,160);if(q.length<2)throw Object.assign(new Error('Enter a city and country.'),{status:400});
  const key=`discover:${q.toLowerCase()}`,saved=cache.get(key);if(saved?.until>Date.now())return saved.value;
  const city=q.split(',')[0].replace(/["\\]/g,'').trim();
  const locationTerms=q.split(',').slice(1).map(part=>part.replace(/["\\]/g,'').trim()).filter(Boolean).map(part=>`"${part}"`).join(' ');
  const results=await Promise.allSettled([
    searchTravelGuides({query:q,category:'trending'}),
    searchTravelGuides({query:`intitle:"${city}" tourist attractions`,category:'activities'}),
    searchTravelGuides({query:`"${city}" ${locationTerms} cuisine`,category:'food'}),
    searchTravelGuides({query:`"${city}" ${locationTerms} museums landmarks`,category:'activities'}),
    searchTravelGuides({query:`"${city}" ${locationTerms} parks gardens`,category:'activities'}),
    searchTravelGuides({query:`"${city}" ${locationTerms} restaurant`,category:'food'})
  ]);
  const sections=['about','activities','food'];const payload={destination:q,fetchedAt:new Date().toISOString(),source:'Wikipedia contributors',livePrices:false};
  results.slice(0,3).forEach((result,i)=>{let rows=result.status==='fulfilled'?result.value.results:[];rows=rows.filter(row=>! /disambiguation/i.test(row.title));if(i===0)rows=rows.filter(row=>row.title.toLowerCase()===city.toLowerCase()||row.title.toLowerCase().startsWith(`${city.toLowerCase()},`));if(i===1)rows=rows.filter(row=>/touris|museum|attraction|scenic|neighborhood|district|temple|park|palace|garden|building complex/i.test(`${row.title} ${row.description}`));payload[sections[i]]=rows.slice(0,4);});
  payload.about=payload.about.filter(guide=>guideMatchesDestination(q,guide));
  payload.activities=payload.activities.filter(guide=>guideMatchesDestination(q,guide));
  payload.excursions=destinationExcursions(q,[1,3,4].flatMap(index=>results[index].status==='fulfilled'?results[index].value.results:[]));
  payload.facts=destinationFacts(payload.about,payload.excursions);
  const restaurants=destinationRestaurants(q,results[5].status==='fulfilled'?results[5].value.results:[]);
  const illustrated=await destinationPhotos([...payload.excursions,...restaurants].map(item=>({...item,fact:destinationFacts([],[item])[0]?.text||null})));
  payload.restaurants=illustrated.filter(item=>item.kind==='restaurant_idea');
  payload.excursions=illustrated.filter(item=>item.kind==='excursion_idea');
  payload.restaurantsUnavailable=results[5].status==='rejected';
  payload.excursionsUnavailable=[1,3,4].every(index=>results[index].status==='rejected');
  const listings=await Promise.allSettled(['food','activities'].map(category=>searchOpenPlaces({destination:q,category})));
  payload.placeListings=listings.flatMap(result=>result.status==='fulfilled'?result.value.results:[]);
  payload.placeListingsSource='OpenStreetMap contributors via Photon';
  if(results.every(result=>result.status==='rejected')&&!payload.placeListings.length)throw new Error('Destination guides and place listings are temporarily unavailable. Please try again.');
  return remember(key,payload,600000);
}
export default async function handler(req,res){applySecurityHeaders(res);if(!['GET','POST'].includes(req.method))return methodNotAllowed(res,'GET, POST');if(!await takeSearchSlot(req,res,'destination-discovery',60))return;try{if(req.method==='GET'){const url=new URL(req.url,'https://travel-drip.com');return res.status(200).json({suggestions:await suggestDestinations(url.searchParams.get('q'))});}res.status(200).json(await discoverDestination(getRequestBody(req).destination));}catch(error){res.status(error.status||503).json({error:error.message});}}
