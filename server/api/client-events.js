import {applySecurityHeaders,getRequestBody,methodNotAllowed} from './_security.js';
import {takeSearchSlot} from './_search-store.js';
export default async function handler(req,res){applySecurityHeaders(res);if(req.method!=='POST')return methodNotAllowed(res,'POST');if(!await takeSearchSlot(req,res,'client-errors',5))return;
 const body=getRequestBody(req);const kind=['runtime','promise'].includes(body.kind)?body.kind:'runtime';const routes=new Set(['dashboard','planning','itinerary','explore','travel','transportation','wallet','chat','memories','events','account','login','register']);const route=routes.has(body.route)?body.route:'other';
 // Never log submitted error messages, stack traces, session tokens, user IDs or full URLs.
 console.error(JSON.stringify({event:'client_runtime_error',kind,route,release:'trip-experiences-1'}));return res.status(202).json({recorded:true});}
