import assert from 'node:assert/strict';
import {handleFriends} from '../server/api/friends.js';
import {appFriendIds} from '../server/api/_friends.js';
import {handlePhotoFeed} from '../server/api/photo-feed.js';
const rows={profiles:[{id:'b',username:'alex_a',full_name:'Alex'}],app_friendships:[]};
const db={from(table){let filters=[],operation='read',value,single=false;const q={select(){return q;},eq(k,v){filters.push(r=>r[k]===v);return q;},neq(k,v){filters.push(r=>r[k]!==v);return q;},or(text){const id=text.split('.eq.')[1].split(',')[0];filters.push(r=>r.user_a===id||r.user_b===id);return q;},in(k,ids){filters.push(r=>ids.includes(r[k]));return q;},limit(){return q;},maybeSingle(){single=true;return q;},upsert(v){operation='upsert';value=v;return q;},update(v){operation='update';value=v;return q;},delete(){operation='delete';return q;},then(resolve){let selected=rows[table].filter(r=>filters.every(f=>f(r)));if(operation==='upsert'&&!rows[table].some(r=>r.user_a===value.user_a&&r.user_b===value.user_b))rows[table].push(value);if(operation==='update')selected.forEach(r=>Object.assign(r,value));if(operation==='delete')rows[table]=rows[table].filter(r=>!selected.includes(r));return Promise.resolve(resolve({data:single?selected[0]||null:selected,error:null}));}};return q;}};
async function call(user,body,method='POST'){const res={code:200,status(c){this.code=c;return this;},json(data){this.body=data;}};await handleFriends({method,body},res,db,{id:user});return res;}
assert.equal((await call('a',{action:'request',username:'alex%'})).code,400);
assert.equal((await call('a',{action:'request',username:'@alex_a'})).body.saved,true);
assert.equal(rows.app_friendships[0].status,'pending');
assert.equal((await call('a',{action:'accept',friendId:'b'})).code,400,'Requester cannot self-accept');
assert.deepEqual(await appFriendIds(db,'a'),[],'Pending requests never grant sharing');
assert.equal((await call('b',{},'GET')).body.friends[0].incoming,true);
assert.equal((await call('b',{action:'accept',friendId:'a'})).body.saved,true);
assert.deepEqual(await appFriendIds(db,'a'),['b']);
rows.media=[{id:'friend-post',trip_id:'other-trip',user_id:'b',visibility:'friends'},{id:'private-post',trip_id:'other-trip',user_id:'b',visibility:'private'},{id:'member-post',trip_id:'other-trip',user_id:'b',visibility:'members'}];rows.trip_members=[];rows.photo_likes=[];
async function react(postId){const res={status(c){this.code=c;return this;},json(body){this.body=body;}};await handlePhotoFeed({method:'POST',url:'/api/photo-feed',body:{action:'like',tripId:'not-the-authors-trip',postId,liked:true}},res,db,{id:'a'});return res;}
assert.equal((await react('friend-post')).code,200,'Accepted friends can react without joining the author\'s trip');
assert.equal((await react('private-post')).code,404,'Friendship never grants private access');
assert.equal((await react('member-post')).code,404,'Friendship never grants trip-member access');
await call('a',{action:'request',username:'alex_a'});assert.equal(rows.app_friendships[0].status,'accepted','Repeated requests cannot overwrite consent');
assert.equal((await call('c',{action:'accept',friendId:'a'})).code,404);
await call('b',{action:'remove',friendId:'a'});assert.deepEqual(await appFriendIds(db,'a'),[]);
assert.equal((await react('friend-post')).code,404,'Revocation removes access to friend-shared posts');
console.log('App friends passed: exact usernames, pending consent, recipient-only acceptance, repeat requests, unrelated-user protection, and revocation.');
