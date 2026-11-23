import {applySecurityHeaders,getRequestBody,methodNotAllowed,requireAuthenticatedUser,requireTripRole} from './_security.js';
const modes=new Set(['Flight','Train','Bus / coach','Ride share / taxi','Private transfer','Cruise / ferry']);
export function cleanComparison(value){
  if(!value||typeof value!=='object')throw new Error('Enter a route comparison.');
  const r=value.route,quotes=value.quotes;
  if(!r||typeof r.from!=='string'||typeof r.to!=='string'||!r.from.trim()||!r.to.trim()||r.from.length>160||r.to.length>160||r.from.trim().toLowerCase()===r.to.trim().toLowerCase())throw new Error('Enter two different route points.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!Number.isFinite(Date.parse(r.date))||new Date(r.date).toISOString().slice(0,10)!==r.date)throw new Error('Choose a valid travel date.');
  if(!Number.isInteger(r.travelers)||r.travelers<1||r.travelers>50||!Intl.supportedValuesOf('currency').includes(r.currency))throw new Error('Choose valid travelers and currency.');
  if(!Array.isArray(quotes)||quotes.length>50)throw new Error('Use no more than 50 quotes per comparison.');
  const scale=10**new Intl.NumberFormat('en',{style:'currency',currency:r.currency}).resolvedOptions().maximumFractionDigits;
  return {route:{from:r.from.trim(),to:r.to.trim(),date:r.date,travelers:r.travelers,currency:r.currency},quotes:quotes.map(q=>{
    if(!modes.has(q.mode)||typeof q.provider!=='string'||!q.provider.trim()||q.provider.length>100||q.scale!==scale||!Number.isSafeInteger(q.totalUnits)||q.totalUnits<0||q.totalUnits>50000000000)throw new Error('Check each provider price and currency.');
    return {mode:q.mode,provider:q.provider.trim(),scale,totalUnits:q.totalUnits};
  })};
}
export async function comparisonRequest(req,res,db,user){
  const body=getRequestBody(req),tripId=req.method==='GET'?new URL(req.url,'https://travel-drip.com').searchParams.get('tripId'):body.tripId;
  if(typeof tripId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tripId))return res.status(400).json({error:'Choose a saved trip.'});
  if(!await requireTripRole(db,tripId,user.id))return res.status(403).json({error:'Active trip membership is required.'});
  if(req.method==='GET'){
    const {data,error}=await db.from('transport_comparisons').select('document,updated_at').eq('user_id',user.id).eq('trip_id',tripId).maybeSingle();
    if(error)return res.status(503).json({error:'Saved comparison could not be loaded.'});
    return res.status(200).json({comparison:data?.document||null,updatedAt:data?.updated_at||null});
  }
  let document;try{document=cleanComparison(body.comparison);}catch(e){return res.status(400).json({error:e.message});}
  const {error}=await db.from('transport_comparisons').upsert({user_id:user.id,trip_id:tripId,document,updated_at:new Date().toISOString()},{onConflict:'user_id,trip_id'});
  if(error)return res.status(503).json({error:'Comparison could not be saved. Please retry.'});
  return res.status(200).json({saved:true,providerConfirmed:false});
}
export default async function handler(req,res){applySecurityHeaders(res);if(!['GET','PUT'].includes(req.method))return methodNotAllowed(res,'GET, PUT');const {user,supabase}=await requireAuthenticatedUser(req,res);if(!user||!supabase)return;return comparisonRequest(req,res,supabase,user);}
