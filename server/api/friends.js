import {applySecurityHeaders,getRequestBody,methodNotAllowed,requireAuthenticatedUser} from './_security.js';
export async function handleFriends(req,res,db,user) {
  const body=getRequestBody(req);
  if(req.method==='GET') {
    const {data,error}=await db.from('app_friendships').select('user_a,user_b,requested_by,status').or(`user_a.eq.${user.id},user_b.eq.${user.id}`).limit(200);
    if(error)throw error;
    const ids=(data||[]).map(r=>r.user_a===user.id?r.user_b:r.user_a);
    const profiles=ids.length?await db.from('profiles').select('id,full_name,username').in('id',ids):{data:[]};
    if(profiles.error)throw profiles.error;
    res.status(200).json({friends:(data||[]).map(r=>{const id=r.user_a===user.id?r.user_b:r.user_a;const p=(profiles.data||[]).find(p=>p.id===id);return {id,name:p?.full_name||p?.username||'App friend',status:r.status,incoming:r.requested_by!==user.id};})});return;
  }
  if(body.action==='request') {
    const username=String(body.username||'').replace(/^@/,'').trim();
    if(!/^[a-zA-Z0-9_.-]{2,32}$/.test(username)){res.status(400).json({error:'Enter an exact Travel-Drip username.'});return;}
    const {data:profile,error}=await db.from('profiles').select('id').eq('username',username).maybeSingle();
    if(error)throw error;
    if(!profile||profile.id===user.id){res.status(400).json({error:'No eligible account found with that username.'});return;}
    const [a,b]=[profile.id,user.id].sort();
    const result=await db.from('app_friendships').upsert({user_a:a,user_b:b,requested_by:user.id,status:'pending'},{onConflict:'user_a,user_b',ignoreDuplicates:true});
    if(result.error)throw result.error;
    res.status(200).json({saved:true});return;
  }
  const [a,b]=[String(body.friendId||''),user.id].sort();
  const {data:friend,error}=await db.from('app_friendships').select('requested_by,status').eq('user_a',a).eq('user_b',b).maybeSingle();
  if(error)throw error;
  if(!friend){res.status(404).json({error:'Friend request not found.'});return;}
  let result;
  if(body.action==='accept'&&friend.requested_by!==user.id&&friend.status==='pending')result=await db.from('app_friendships').update({status:'accepted'}).eq('user_a',a).eq('user_b',b).eq('status','pending').neq('requested_by',user.id);
  else if(body.action==='remove')result=await db.from('app_friendships').delete().eq('user_a',a).eq('user_b',b);
  else {res.status(400).json({error:'This friend request cannot be accepted.'});return;}
  if(result.error)throw result.error;
  res.status(200).json({saved:true});
}
export default async function handler(req,res){applySecurityHeaders(res);if(!['GET','POST'].includes(req.method))return methodNotAllowed(res,'GET, POST');const {user,supabase}=await requireAuthenticatedUser(req,res);if(!user)return;try{await handleFriends(req,res,supabase,user);}catch(error){res.status(503).json({error:['42P01','PGRST205'].includes(error.code)?'App friends are awaiting database setup.':'Friends could not be updated. Please retry.'});}}
