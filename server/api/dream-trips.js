import {applySecurityHeaders,getRequestBody,methodNotAllowed,requireAuthenticatedUser} from './_security.js';
import {takeSearchSlot} from './_search-store.js';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const text=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
export function cleanDream(value={}){
 const destination=text(value.destination,160);if(destination.length<2)throw Error('Choose a destination.');
 const budget=Number(value.budget||0),travelers=Number(value.travelers||1);if(!Number.isFinite(budget)||budget<0||budget>10000000||!Number.isInteger(travelers)||travelers<1||travelers>50)throw Error('Check your estimated budget and traveler count.');
 const date=v=>{if(!v)return null;if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw Error('Choose a valid travel date.');return v;};
 const starts=date(value.earliest),ends=date(value.latest);if(starts&&ends&&ends<starts)throw Error('The end of your date window must follow its start.');
 const currency=text(value.currency||'USD',3).toUpperCase();if(!Intl.supportedValuesOf('currency').includes(currency))throw Error('Choose a valid currency.');
 return {destination,departure_location:text(value.from,160),budget_cents:Math.round(budget*100),currency,starts_on:starts,ends_on:ends,answers:{dreamTrip:true,title:text(value.title,120),hotel:text(value.hotel,300),flight:text(value.flight,300),activities:text(value.activities,1200),flexible:value.flexible===true,travelers,priceAlerts:value.priceAlerts===true,tripAlerts:value.tripAlerts!==false}};
}
const columns='id,destination,departure_location,budget_cents,currency,starts_on,ends_on,answers,status,updated_at';
export async function dreamRequest(req,res,db,user){
 if(req.method==='GET'){
  const {data,error}=await db.from('ai_travel_plans').select(columns).eq('user_id',user.id).eq('trip_type','dream_trip').in('status',['saved','deleted']).order('updated_at',{ascending:false}).limit(50);
  if(error)return res.status(503).json({error:'Dream trips could not be loaded. Your existing trips are unaffected.'});
  const pref=await db.from('profiles').select('notification_preferences').eq('id',user.id).maybeSingle();
  return res.status(200).json({dreams:data||[],preferences:pref.data?.notification_preferences||{},preferencesAvailable:!pref.error,priceTracking:{available:false,reason:'Automatic airfare/hotel price monitoring is not connected. No live quotes or price-drop alerts are available.'}});
 }
 const body=getRequestBody(req);
 if(body.action==='preferences'){
  const previous=await db.from('profiles').select('notification_preferences').eq('id',user.id).maybeSingle();if(previous.error||!previous.data)return res.status(503).json({error:'Notification preferences could not be loaded.'});
  const preferences={...previous.data.notification_preferences,upcoming_trip_alerts:body.upcoming===true,dream_price_alerts:body.prices===true};
  const result=await db.from('profiles').update({notification_preferences:preferences}).eq('id',user.id).select('id').maybeSingle();if(result.error||!result.data)return res.status(503).json({error:'Notification preferences were not saved.'});return res.status(200).json({saved:true,preferences,priceTrackingAvailable:false});
 }
 if(body.id&&!uuid.test(body.id))return res.status(400).json({error:'Choose a saved dream trip.'});
 const base=db.from('ai_travel_plans');let query;
 if(['archive','restore'].includes(body.action)){
  if(!body.id)return res.status(400).json({error:'Choose a saved dream trip.'});
  query=base.update({status:body.action==='archive'?'deleted':'saved',deleted_at:body.action==='archive'?new Date().toISOString():null}).eq('id',body.id).eq('user_id',user.id).eq('trip_type','dream_trip');
 }else{
  let payload;try{payload=cleanDream(body.dream);}catch(e){return res.status(400).json({error:e.message});}
  query=body.id?base.update({...payload,updated_at:new Date().toISOString()}).eq('id',body.id).eq('user_id',user.id).eq('trip_type','dream_trip').eq('status','saved'):base.insert({...payload,user_id:user.id,trip_type:'dream_trip',status:'saved'});
 }
 const {data,error}=await query.select(columns).maybeSingle();if(error)return res.status(503).json({error:'Dream trip was not saved. Please try again.'});if(!data)return res.status(404).json({error:'Dream trip not found.'});return res.status(200).json({saved:true,dream:data,priceTrackingAvailable:false});
}
export default async function handler(req,res){applySecurityHeaders(res);if(!['GET','POST'].includes(req.method))return methodNotAllowed(res,'GET, POST');const {user,supabase}=await requireAuthenticatedUser(req,res);if(!user)return;if(!await takeSearchSlot(req,res,'dream-trips',30))return;return dreamRequest(req,res,supabase,user);}
