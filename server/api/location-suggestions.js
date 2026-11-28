import {applySecurityHeaders,methodNotAllowed} from './_security.js';
import {takeSearchSlot} from './_search-store.js';
import {photonPublicLookup} from './_open-places.js';
export function locationLabels(features){return [...new Map(features.filter(f=>f.properties?.name||f.properties?.street).map(f=>{const p=f.properties,coordinates=f.geometry?.coordinates;const label=[p.name,[p.housenumber,p.street].filter(Boolean).join(' '),p.city||p.town,p.state,p.country].filter((v,i,a)=>v&&a.indexOf(v)===i).join(', ');return [label,{label,name:p.name||p.street,latitude:Number(coordinates?.[1]),longitude:Number(coordinates?.[0])}];})).values()].slice(0,7);}
export default async function handler(req,res){applySecurityHeaders(res);if(req.method!=='GET')return methodNotAllowed(res,'GET');if(!await takeSearchSlot(req,res,'location-suggestions',40))return;
 const url=new URL(req.url,'https://travel-drip.com'),q=String(url.searchParams.get('q')||'').trim().slice(0,160);if(q.length<2)return res.status(200).json({suggestions:[],source:'OpenStreetMap'});
 const params={q,limit:'7'};for(const [name,max]of [['lat',90],['lon',180]]){const raw=url.searchParams.get(name);if(raw!==null){const n=Number(raw);if(!Number.isFinite(n)||Math.abs(n)>max)return res.status(400).json({error:'Invalid approximate location.'});params[name]=String(Math.round(n*100)/100);}}
 try{const data=await photonPublicLookup(params);return res.status(200).json({suggestions:locationLabels(data),source:'Photon / OpenStreetMap',notice:'Map suggestions, not live fares or verified operating status.'});}catch{return res.status(503).json({error:'Location suggestions are temporarily unavailable. You can enter the location manually.'});}
}
