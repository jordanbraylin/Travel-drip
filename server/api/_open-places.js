const cache=new Map(),pending=new Map();
const tags={food:'amenity:restaurant',activities:'tourism:museum',trending:'tourism:attraction',outdoor:'leisure:park',hotels:'tourism:hotel'};
export function supportsOpenPlaces(category){return Boolean(tags[category]);}
async function photon(params){
  const url=new URL('https://photon.komoot.io/api/');url.search=new URLSearchParams({...params,lang:'en'});
  const r=await fetch(url,{headers:{Accept:'application/json','User-Agent':'Travel-Drip/1.0 (https://travel-drip.com)'},signal:AbortSignal.timeout(8000)});
  if(!r.ok)throw new Error('Place listings are temporarily unavailable.');
  const data=await r.json();if(!Array.isArray(data.features))throw new Error('Place listings are temporarily unavailable.');return data.features;
}
export async function searchOpenPlaces({destination='',category='trending',query=''}={}){
  destination=String(destination).trim().slice(0,160);query=String(query).trim().slice(0,180);
  if(!destination||!supportsOpenPlaces(category))throw new Error('Choose a destination and supported place category.');
  const key=JSON.stringify([destination.toLowerCase(),category,query.toLowerCase()]);
  const saved=cache.get(key);if(saved?.until>Date.now())return saved.value;if(pending.has(key))return pending.get(key);
  const task=(async()=>{
    const locations=await photon({q:destination,limit:'3'});
    const city=locations.find(x=>['city','town','village','municipality','province','state','island'].includes(x.properties?.osm_value));
    const [lon,lat]=city?.geometry?.coordinates||[];if(!Number.isFinite(lon)||!Number.isFinite(lat))throw new Error('Destination could not be resolved.');
    const [tag,tagValue]=tags[category].split(':');
    const bbox=[Math.max(-180,lon-.12),Math.max(-90,lat-.08),Math.min(180,lon+.12),Math.min(90,lat+.08)].join(',');
    const features=await photon({q:query||tagValue,limit:'8',osm_tag:tags[category],bbox,lat:String(lat),lon:String(lon)});
    const seen=new Set();
    const results=features.filter(x=>x.properties?.name&&x.properties.osm_key===tag&&x.properties.osm_value===tagValue).flatMap(x=>{
      const p=x.properties,type={N:'node',W:'way',R:'relation'}[p.osm_type];
      if(!type||!Number.isSafeInteger(Number(p.osm_id)))return[];
      const id=`osm-${p.osm_type}-${p.osm_id}`;if(seen.has(id))return[];seen.add(id);
      const location=[p.housenumber,p.street,p.city||p.town,p.country].filter(Boolean).join(', ');
      return [{id,title:String(p.name).slice(0,200),category,location,description:`${tagValue.replaceAll('_',' ')} listing near ${destination}: ${location||'street address not listed'}. Map data may be incomplete or outdated. Check details with the venue before visiting.`,sourceUrl:`https://www.openstreetmap.org/${type}/${p.osm_id}`,sourceLabel:'OpenStreetMap contributors',license:'ODbL',licenseUrl:'https://www.openstreetmap.org/copyright',kind:'place_listing'}];
    });
    const value={provider:'openstreetmap',sourceLabel:'OpenStreetMap contributors via Photon',searchMode:'in_app_places',live:false,liveAvailability:false,fetchedAt:new Date().toISOString(),destination,coverage:'Near the destination center; not a complete directory',results};
    if(cache.size>=200)cache.delete(cache.keys().next().value);cache.set(key,{value,until:Date.now()+3600000});return value;
  })();pending.set(key,task);try{return await task;}finally{pending.delete(key);}
}
