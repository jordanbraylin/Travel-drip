import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {handlePhotoFeed,canReadPhoto,photoTags,validPhotoStorage} from '../server/api/photo-feed.js';

assert.equal(canReadPhoto({user_id:'a',visibility:'private'},'b'),false);
assert.equal(canReadPhoto({user_id:'a',visibility:'selected'},'b'),false);
assert.equal(canReadPhoto({user_id:'a',visibility:'public'},'b'),false);
assert.equal(canReadPhoto({user_id:'a',visibility:'members'},'b'),true);
assert.equal(canReadPhoto({user_id:'a',visibility:'private'},'a'),true);
assert.deepEqual(photoTags('#Tokyo #Tokyo #旅 #food!'),['#Tokyo','#旅','#food']);
assert.equal(validPhotoStorage({user_id:'a',storage_path:'b/private.png'}),false);
assert.equal(validPhotoStorage({user_id:'a',storage_path:'a/../b.png'}),false);
assert.equal(validPhotoStorage({user_id:'a',storage_path:'a/photo.png'}),true);

const rows = {trip_members:[{trip_id:'trip',user_id:'friend',role:'member',status:'active'}],media:[{id:'shared',trip_id:'trip',user_id:'owner',visibility:'members',storage_path:'owner/photo.png'},{id:'secret',trip_id:'trip',user_id:'owner',visibility:'private'}],photo_likes:[],photo_comments:[],photo_reports:[]};
rows.app_friendships=[];
const db = {from(table) {
  let filters=[], op='read',payload,single=false,range=[0,Infinity];
  const q={select(){return q;},order(){return q;},limit(n){range=[0,n-1];return q;},range(a,b){range=[a,b];return q;},in(k,v){filters.push(r=>v.includes(r[k]));return q;},or(){filters.push(r=>r.user_id==='friend'||r.visibility==='members');return q;},eq(k,v){filters.push(r=>r[k]===v);return q;},maybeSingle(){single=true;return q;},single(){single=true;return q;},upsert(v){op='upsert';payload=v;return q;},insert(v){op='insert';payload=v;return q;},delete(){op='delete';return q;},then(resolve){
    let selected=rows[table].filter(r=>filters.every(f=>f(r))).slice(range[0],range[1]+1);
    if(op==='update')selected.forEach(row=>Object.assign(row,payload));
    if(op==='upsert'){const old=rows[table].find(r=>r.media_id===payload.media_id&&r.user_id===payload.user_id);if(old)Object.assign(old,payload);else rows[table].push(payload);}
    if(op==='insert'){payload={id:'new-comment',...payload};rows[table].push(payload);selected=[payload];}
    if(op==='delete')rows[table]=rows[table].filter(r=>!selected.includes(r));
    return Promise.resolve(resolve({data:single?selected[0]||null:selected,error:null,count:selected.length}));
  }}; q.update=v=>{op='update';payload=v;return q;};return q;
}};
async function request(body,user='friend') { const response={code:200,status(c){this.code=c;return this;},json(v){this.body=v;}}; await handlePhotoFeed({method:'POST',url:'/api/photo-feed',body:{tripId:'trip',postId:'shared',...body}},response,db,{id:user});return response; }
assert.equal((await request({action:'like',liked:true},'outsider')).code,404);
assert.equal((await request({action:'like',liked:true,postId:'secret'})).code,404);
assert.equal((await request({action:'like',liked:true})).body.saved,true);
await request({action:'like',liked:true});assert.equal(rows.photo_likes.length,1,'Retries must not add duplicate likes');
await request({action:'like',liked:false});assert.equal(rows.photo_likes.length,0);
assert.equal((await request({action:'comment',text:'  '})).code,400);
assert.equal((await request({action:'comment',text:'a'.repeat(1001)})).code,400);
assert.equal((await request({action:'comment',text:'Great photo!'})).body.id,'new-comment');
assert.equal(rows.photo_comments[0].user_id,'friend');
assert.equal((await request({action:'report',reason:'invalid'})).code,400);
await request({action:'report',reason:'Privacy concern'});assert.equal(rows.photo_reports.length,1);
assert.equal((await request({action:'remove'})).code,400,'Friends cannot delete another author\'s post');
assert.equal((await request({action:'share',visibility:'friends'})).code,403,'Only the author can widen an audience');
assert.equal((await request({action:'share',visibility:'public'},'owner')).code,400);
assert.equal((await request({action:'share',visibility:'private'},'owner')).body.saved,true);
assert.equal(rows.media[0].visibility,'private');
assert.equal((await request({action:'like',liked:true})).code,404,'Changing to private must revoke trip access');
assert.equal((await request({action:'share',visibility:'members'},'owner')).code,403,'Sharing to a trip requires active membership');
rows.trip_members.push({trip_id:'trip',user_id:'owner',role:'owner',status:'active'});
assert.equal((await request({action:'share',visibility:'members'},'owner')).body.saved,true);
rows.profiles=[{id:'owner',full_name:'Trip friend'}];
const signedPaths=[];
db.storage={from:()=>({createSignedUrl:async path=>{signedPaths.push(path);return {data:{signedUrl:'https://example.test/signed'}};}})};
const feedResponse={status(c){this.code=c;return this;},json(v){this.body=v;}};
await handlePhotoFeed({method:'GET',url:'/api/photo-feed?tripId=trip'},feedResponse,db,{id:'friend'});
assert.deepEqual(feedResponse.body.posts.map(p=>p.id),['shared']);
assert.deepEqual(signedPaths,['owner/photo.png'],'Only authorized media receive signed URLs');
assert.equal('storage_path' in feedResponse.body.posts[0],false);
assert.equal('reports' in feedResponse.body.posts[0],false);
assert.equal(feedResponse.body.engagementReady,true);
assert.equal(canReadPhoto({user_id:'owner',visibility:'friends'},'friend',[],true),false,'Trip membership is not app friendship');
assert.equal(canReadPhoto({user_id:'owner',visibility:'friends'},'friend',['owner'],false),true);
assert.equal(canReadPhoto({user_id:'owner',visibility:'private'},'friend',['owner'],true),false);
assert.equal(canReadPhoto({user_id:'owner',visibility:'members'},'friend',['owner'],false),false);
assert.equal((await request({action:'create_blog',title:'My day',text:'Story',visibility:'members'},'outsider')).code,403);
for (const invalid of [{title:''},{text:' '},{text:'x'.repeat(4001)},{title:'x'.repeat(121)},{visibility:'public'}]) {
  assert.equal((await request({action:'create_blog',title:'My day',text:'A memorable day',visibility:'private',...invalid})).code,400);
}
const blog = await request({action:'create_blog',title:'My travel journal',text:'A memorable day',visibility:'private',tags:'#Journey',user_id:'someone-else'});
assert.equal(blog.code,201); assert.equal(blog.body.saved,true);
const savedBlog = rows.media.find(p=>p.media_type==='text/plain');
assert.equal(savedBlog.user_id,'friend'); assert.equal(savedBlog.visibility,'private');
assert.equal(savedBlog.metadata.postKind,'blog'); assert.equal(savedBlog.metadata.title,'My travel journal');
signedPaths.length=0;
await handlePhotoFeed({method:'GET',url:'/api/photo-feed?tripId=trip'},feedResponse,db,{id:'friend'});
assert.equal(feedResponse.body.posts.find(p=>p.postKind==='blog').mediaUrl,null);
assert.deepEqual(signedPaths,['owner/photo.png'],'Text journals must not request nonexistent storage objects');

const source=await readFile(new URL('../photo-feed.js',import.meta.url),'utf8');
let resolveRequest, status='';
const list={replaceChildren(){}};
const statusEl={replaceChildren(){},set textContent(v){status=v;}};
const context=vm.createContext({state:{session:{user:{id:'a'}},activeTripId:'trip'}, document:{querySelectorAll:()=>[],querySelector:s=>s==='#photoFeedList'?list:s==='#photoFeedStatus'?statusEl:s==='#photoFeedMore'?{}:null},apiRequest:()=>new Promise(r=>{resolveRequest=r;})});
vm.runInContext(source,context);
const pending=vm.runInContext('loadPhotoFeed()',context);
context.state.session.user.id='b';resolveRequest({posts:[{id:'private-a'}],engagementReady:true});await pending;
assert.equal(vm.runInContext('photoFeedState.posts.length',context),0,'Late responses must not cross accounts');
let duration = 60, revoked = 0;
const videoContext=vm.createContext({setTimeout,clearTimeout,document:{createElement:()=>({get duration(){return duration;},removeAttribute(){},load(){},set src(value){queueMicrotask(()=>this.onloadedmetadata?.());}})},URL:{createObjectURL:()=> 'blob:test',revokeObjectURL:()=>{revoked++;}}});
vm.runInContext(source,videoContext);
await vm.runInContext("validateShortVlog({type:'video/mp4',size:1000})",videoContext);
for (const invalid of [0,181,Infinity]) { duration=invalid; await assert.rejects(vm.runInContext("validateShortVlog({type:'video/mp4',size:1000})",videoContext)); }
await assert.rejects(vm.runInContext("validateShortVlog({type:'image/png',size:1000})",videoContext));
await assert.rejects(vm.runInContext("validateShortVlog({type:'video/mp4',size:104857601})",videoContext));
assert.equal(revoked,4,'Video previews must release object URLs');
const sql=await readFile(new URL('../supabase-photo-feed.sql',import.meta.url),'utf8');
assert.match(sql,/revoke all on public.photo_likes, public.photo_comments, public.photo_reports from anon, authenticated/);
console.log('Photo feed passed: membership, private access, storage ownership, idempotent likes, comments, reports, deletion authorization, and stale-account isolation.');
