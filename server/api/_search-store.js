import {createHash,createHmac} from 'node:crypto';
import {createSupabaseAdminClient} from './_security.js';
const local=new Map(),pending=new Map(),rates=new Map();
function digest(value){return createHash('sha256').update(value).digest('hex');}
function remember(key,value,seconds){if(local.size>=200)local.delete(local.keys().next().value);local.set(key,{value,until:Date.now()+seconds*1000});}
export async function takeSearchSlot(req,res,scope,limit,seconds=60){
  const ip=String(req.headers?.['x-forwarded-for']||req.headers?.['x-real-ip']||'unknown').split(',')[0].trim();
  const key=createHmac('sha256',process.env.GUEST_ACCESS_PEPPER||'development-only').update(`${scope}:${ip}`).digest('hex');
  const {client}=createSupabaseAdminClient();let allowed;
  if(client){
    const {data,error}=await client.rpc('app_take_search_slot',{p_key:key,p_limit:limit,p_seconds:seconds});
    if(error||typeof data!=='boolean'){res.status(503).json({error:'Search protection is temporarily unavailable. Please try again.',code:'search_protection_unavailable'});return false;}
    allowed=data;
  }else{
    if(process.env.VERCEL_ENV==='production'){res.status(503).json({error:'Search protection is temporarily unavailable. Please try again.',code:'search_protection_unavailable'});return false;}
    let entry=rates.get(key);if(!entry||entry.until<Date.now()){entry={count:0,until:Date.now()+seconds*1000};if(rates.size>=500)rates.delete(rates.keys().next().value);rates.set(key,entry);}allowed=++entry.count<=limit;
  }
  if(!allowed){res.setHeader('Retry-After',String(seconds));res.status(429).json({error:'Please pause briefly before searching again.',code:'search_rate_limited'});return false;}return true;
}
export async function cachedPublicResult(scope,key,seconds,produce){
  const hash=digest(`${scope}:${key}`),saved=local.get(hash);if(saved?.until>Date.now())return saved.value;if(pending.has(hash))return pending.get(hash);
  const task=(async()=>{
    const {client}=createSupabaseAdminClient();
    if(client){const {data,error}=await client.from('app_public_cache').select('payload,expires_at').eq('key',hash).maybeSingle();if(error)throw new Error('Public search cache is temporarily unavailable.');if(data&&Date.parse(data.expires_at)>Date.now()){remember(hash,data.payload,Math.min(seconds,(Date.parse(data.expires_at)-Date.now())/1000));return data.payload;}}
    const value=await produce();remember(hash,value,seconds);
    if(client)await client.from('app_public_cache').upsert({key:hash,payload:value,expires_at:new Date(Date.now()+seconds*1000).toISOString()},{onConflict:'key'});
    return value;
  })();pending.set(hash,task);try{return await task;}finally{pending.delete(hash);}
}

export async function takeProviderSlot(provider,limit=30){
  const {client}=createSupabaseAdminClient();if(!client){if(process.env.VERCEL_ENV==='production')throw new Error('Public search protection is unavailable.');return;}
  const {data,error}=await client.rpc('app_take_search_slot',{p_key:digest(`upstream:${provider}`),p_limit:limit,p_seconds:60});
  if(error||data!==true)throw new Error('Public data service is busy. Please try again shortly.');
}
