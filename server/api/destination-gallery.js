import {applySecurityHeaders,methodNotAllowed} from './_security.js';
import {takeSearchSlot,cachedPublicResult} from './_search-store.js';
import {discoverDestination} from './destination-discovery.js';
export default async function handler(req,res){applySecurityHeaders(res);if(req.method!=='GET')return methodNotAllowed(res,'GET');
 const destination=String(new URL(req.url,'https://travel-drip.com').searchParams.get('destination')||'').trim();
 // This CDN-cacheable endpoint only accepts public city/country names, never trip IDs or addresses.
 if(!/^[\p{L} .,'()\-]{2,100}$/u.test(destination))return res.status(400).json({error:'Enter a city and country, without a street address.'});
 if(!await takeSearchSlot(req,res,'destination-gallery',20))return;
 try{const gallery=await cachedPublicResult('destination-gallery',destination.toLowerCase(),3600,async()=>{const d=await discoverDestination(destination);return {destination,slides:[...(d.excursions||[]),...(d.restaurants||[])].filter(x=>x.photo?.url).slice(0,8).map(x=>({title:x.title,description:x.description,photo:x.photo})),facts:d.facts||[],source:d.source,liveAvailability:false};});res.setHeader('Cache-Control','public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');return res.status(200).json(gallery);}catch{return res.status(503).json({error:'Destination photographs are temporarily unavailable.'});}
}
