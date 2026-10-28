import { applySecurityHeaders, getRequestBody, methodNotAllowed, requireAuthenticatedUser, requireTripRole } from './_security.js';
import { randomUUID } from 'node:crypto';
import {appFriendIds} from './_friends.js';

export function canReadPhoto(post, userId, friends = [], isMember = true) {
  return post.user_id === userId || (post.visibility === 'members' && isMember) || (post.visibility === 'friends' && friends.includes(post.user_id));
}

export function photoTags(value) {
  return [...new Set(String(value || '').match(/#[\p{L}\p{N}_]{1,32}/gu) || [])].slice(0, 10);
}

export function validPhotoStorage(post) {
  return Boolean(post.user_id && typeof post.storage_path === 'string' && post.storage_path.startsWith(`${post.user_id}/`) && !post.storage_path.includes('..'));
}

function checked(result) {
  if (result.error) throw result.error;
  return result.data;
}

async function namesFor(db, ids) {
  if (!ids.length) return new Map();
  const rows = checked(await db.from('profiles').select('id, full_name, username').in('id', [...new Set(ids)]));
  return new Map((rows || []).map(p => [p.id, p.full_name || p.username || 'Trip friend']));
}

export async function handlePhotoFeed(request, response, db, user) {
  const url = new URL(request.url, 'https://traveldrip.local');
  const body = getRequestBody(request);
  const tripId = request.method === 'GET' ? url.searchParams.get('tripId') : body.tripId;
  if (body.action === 'create_blog' && (!tripId || !await requireTripRole(db, tripId, user.id))) {
    response.status(403).json({ error: 'Active trip membership is required.' }); return;
  }
  if (request.method === 'POST' && body.action === 'create_blog') {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!title || title.length > 120 || !text || text.length > 4000 || !['private','members','friends'].includes(body.visibility)) {
      response.status(400).json({error:'Add a title (up to 120 characters), a story (up to 4,000 characters), and a sharing choice.'}); return;
    }
    const saved = checked(await db.from('media').insert({trip_id:tripId,user_id:user.id,storage_path:`${user.id}/journal/${randomUUID()}`,media_type:'text/plain',caption:text,visibility:body.visibility,metadata:{postKind:'blog',title,tags:photoTags(String(body.tags || '').slice(0,330)).join(' ')}}).select('id').single());
    response.status(201).json({saved:true,id:saved.id}); return;
  }
  const friends = await appFriendIds(db,user.id);
  const postId = request.method === 'GET' ? url.searchParams.get('postId') : body.postId;
  let post;
  if (postId) {
    post = checked(await db.from('media').select('id, trip_id, user_id, visibility, storage_path, media_type').eq('id', postId).maybeSingle());
    if (!post || !canReadPhoto(post, user.id, friends, await requireTripRole(db,post.trip_id,user.id))) { response.status(404).json({ error: 'Post not found.' }); return; }
  }
  if (request.method === 'GET' && post) {
    const before = url.searchParams.get('before');
    let query = db.from('photo_comments').select('id, user_id, body, created_at').eq('media_id', post.id).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(21);
    const offset = Math.floor(Math.max(0, Math.min(10000, Number(url.searchParams.get('offset')) || 0)));
    // Offset pagination is bounded and returned explicitly; clients de-duplicate IDs.
    if (before) query = query.lt('created_at', before);
    const rows = checked(await query.range(offset, offset + 20));
    const names = await namesFor(db, rows.map(c => c.user_id));
    response.status(200).json({ comments: rows.slice(0,20).map(c => ({ ...c, author: names.get(c.user_id) || 'Trip friend', own: c.user_id === user.id })), nextOffset: rows.length > 20 ? offset + 20 : null }); return;
  }
  if (request.method === 'GET') {
    const offset = Math.floor(Math.max(0, Math.min(10000, Number(url.searchParams.get('offset')) || 0)));
    // Only member-shared posts and the viewer's own private uploads are eligible.
    const memberships = checked(await db.from('trip_members').select('trip_id').eq('user_id',user.id).eq('status','active')) || [];
    const memberTrips = memberships.map(m=>m.trip_id);
    const filters = [`user_id.eq.${user.id}`];
    if(memberTrips.length) filters.push(`and(visibility.eq.members,trip_id.in.(${memberTrips.join(',')}))`);
    if(friends.length) filters.push(`and(visibility.eq.friends,user_id.in.(${friends.join(',')}))`);
    const rows = checked(await db.from('media').select('id, trip_id, user_id, storage_path, media_type, caption, visibility, metadata, created_at').or(filters.join(',')).order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + 12));
    const visible = rows.slice(0,12).filter(p => canReadPhoto(p, user.id, friends, memberTrips.includes(p.trip_id)));
    const names = await namesFor(db, visible.map(p => p.user_id).filter(Boolean));
    const probe = await db.from('photo_likes').select('media_id').limit(0);
    const engagementReady = !probe.error;
    if (probe.error && !['42P01', 'PGRST205'].includes(probe.error.code)) throw probe.error;
    const posts = await Promise.all(visible.map(async p => {
      const isBlog = p.media_type === 'text/plain';
      const signed = !isBlog && validPhotoStorage(p) ? await db.storage.from('travel-memories').createSignedUrl(p.storage_path, 300) : {data:null};
      let likeCount = 0, commentCount = 0, liked = false;
      if (engagementReady) {
        const [likes, comments, mine] = await Promise.all([
          db.from('photo_likes').select('media_id', { count: 'exact', head: true }).eq('media_id',p.id),
          db.from('photo_comments').select('id', { count: 'exact', head: true }).eq('media_id',p.id),
          db.from('photo_likes').select('media_id').eq('media_id',p.id).eq('user_id',user.id).maybeSingle()
        ]);
        checked(likes); checked(comments); checked(mine);
        likeCount = likes.count || 0; commentCount = comments.count || 0; liked = Boolean(mine.data);
      }
      return { id:p.id, author:names.get(p.user_id) || 'Trip friend', own:p.user_id === user.id, postKind:isBlog ? 'blog' : p.media_type?.startsWith('video/') ? 'vlog' : 'photo', title:String(p.metadata?.title || '').slice(0,120), caption:p.caption || '', tags:photoTags(p.metadata?.tags), visibility:['members','friends'].includes(p.visibility) ? p.visibility : 'private', createdAt:p.created_at, mediaType:p.media_type, mediaUrl:signed.data?.signedUrl || null, likeCount, commentCount, liked };
    }));
    response.status(200).json({ posts, engagementReady, nextOffset:rows.length > 12 ? offset + 12 : null }); return;
  }
  if (!post) { response.status(400).json({ error:'Choose a post.' }); return; }
  if (body.action === 'like' && typeof body.liked === 'boolean') {
    checked(body.liked
      ? await db.from('photo_likes').upsert({media_id:post.id,user_id:user.id},{onConflict:'media_id,user_id'})
      : await db.from('photo_likes').delete().eq('media_id',post.id).eq('user_id',user.id));
    response.status(200).json({ saved:true, liked:body.liked }); return;
  }
  if (body.action === 'comment') {
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text || text.length > 1000) { response.status(400).json({error:'Write a comment of 1 to 1,000 characters.'}); return; }
    const comment = checked(await db.from('photo_comments').insert({media_id:post.id,user_id:user.id,body:text}).select('id').single());
    response.status(201).json({saved:true,id:comment.id}); return;
  }
  if (body.action === 'report') {
    if (!['Harassment','Privacy concern','Inappropriate content','Spam','Other'].includes(body.reason)) { response.status(400).json({error:'Choose a report reason.'}); return; }
    checked(await db.from('photo_reports').upsert({media_id:post.id,user_id:user.id,reason:body.reason},{onConflict:'media_id,user_id'}));
    response.status(200).json({saved:true}); return;
  }
  if (body.action === 'remove' && post.user_id === user.id) {
    checked(await db.from('media').delete().eq('id',post.id).eq('user_id',user.id));
    if (post.media_type !== 'text/plain' && validPhotoStorage(post)) await db.storage.from('travel-memories').remove([post.storage_path]);
    response.status(200).json({saved:true}); return;
  }
  response.status(400).json({error:'Unsupported photo action.'});
}

export default async function handler(request,response) {
  applySecurityHeaders(response);
  if (!['GET','POST'].includes(request.method)) return methodNotAllowed(response,'GET, POST');
  const {user,supabase} = await requireAuthenticatedUser(request,response);
  if (!user) return;
  try { await handlePhotoFeed(request,response,supabase,user); }
  catch (error) {
    const missing = ['42P01','PGRST205'].includes(error.code);
    response.status(missing ? 503 : 500).json({error:missing ? 'Photo engagement is awaiting database setup. Your uploads are still safe.' : 'Photos could not be updated. Please try again.'});
  }
}
