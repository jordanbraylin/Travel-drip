export async function appFriendIds(db,userId) {
  const {data,error}=await db.from('app_friendships').select('user_a,user_b').eq('status','accepted').or(`user_a.eq.${userId},user_b.eq.${userId}`);
  if(error) { if(['42P01','PGRST205'].includes(error.code)) return []; throw error; }
  return (data||[]).map(row=>row.user_a===userId?row.user_b:row.user_a);
}
