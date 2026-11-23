import {timingSafeEqual} from 'node:crypto';
import {applySecurityHeaders,createSupabaseAdminClient,methodNotAllowed} from './_security.js';
export default async function handler(req,res){
  applySecurityHeaders(res);if(req.method!=='GET')return methodNotAllowed(res,'GET');
  const expected=process.env.CRON_SECRET||'',actual=String(req.headers?.authorization||'').replace(/^Bearer /,'');
  if(!expected||Buffer.byteLength(actual)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(actual),Buffer.from(expected)))return res.status(401).json({error:'Unauthorized'});
  const {client}=createSupabaseAdminClient();if(!client)return res.status(503).json({error:'Maintenance storage unavailable.'});
  const {error}=await client.rpc('app_expire_search_cache');
  return res.status(error?503:200).json({ok:!error});
}
