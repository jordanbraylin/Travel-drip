import {applySecurityHeaders,getRequestBody,methodNotAllowed,requireAuthenticatedUser,requireTripRole,writeAuditLog} from './_security.js';
import {tripTravelRecord} from './_trip-travel-record.js';

export default async function handler(req,res){
  applySecurityHeaders(res);
  if(req.method!=='POST')return methodNotAllowed(res,'POST');
  const {user,supabase}=await requireAuthenticatedUser(req,res);if(!user||!supabase)return;
  const body=getRequestBody(req);
  if(typeof body.tripId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.tripId))return res.status(400).json({error:'Choose a saved trip.'});
  // Match the existing operational-record write policy; never accept an assignee from the client.
  if(!await requireTripRole(supabase,body.tripId,user.id,['owner','admin','organizer']))return res.status(403).json({error:'Trip organizer access is required to add travel records.'});
  let entry;try{entry=tripTravelRecord(body,user.id);}catch(error){return res.status(400).json({error:error.message});}
  const {data,error}=await supabase.from(entry.table).insert(entry.record).select('id').single();
  if(error||!data?.id)return res.status(500).json({error:'Travel details could not be saved. Please retry.'});
  await writeAuditLog(supabase,{actorUserId:user.id,tripId:body.tripId,action:'trip_travel.created',entityType:entry.table,entityId:data.id});
  return res.status(201).json({record:{id:data.id,kind:body.kind},providerConfirmed:false});
}
