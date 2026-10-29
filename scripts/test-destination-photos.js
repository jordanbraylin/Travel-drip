import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {destinationPhotos,allowedPhotoUrl} from '../server/api/_destination-photos.js';
assert.equal(allowedPhotoUrl('javascript:alert(1)'),null);
assert.equal(allowedPhotoUrl('https://example.com/photo.jpg'),null);
assert.equal(allowedPhotoUrl('https://upload.wikimedia.org/file.svg'),null);
assert.equal(allowedPhotoUrl('https://thumb.wikimedia.org/photo.jpg?tracking=1'),'https://thumb.wikimedia.org/photo.jpg');
const originalFetch=globalThis.fetch,items=[{id:'1',title:'Museum'}];let calls=0;
try{
  globalThis.fetch=async()=>({ok:true,json:async()=>++calls===1?{query:{pages:{1:{pageid:1,pageimage:'Museum_photo.jpg'}}}}:{query:{pages:{9:{title:'File:Museum photo.jpg',imageinfo:[{thumburl:'https://thumb.wikimedia.org/photo.jpg',mime:'image/jpeg',extmetadata:{Artist:{value:'<a href="https://example.com">Photographer &amp; friend</a>'},LicenseShortName:{value:'CC BY-SA 4.0'},LicenseUrl:{value:'https://creativecommons.org/licenses/by-sa/4.0/'}}}]}}}}});
  const result=await destinationPhotos(items);assert.equal(calls,2);assert.equal(result[0].photo.artist,'Photographer & friend');assert.equal(result[0].photo.license,'CC BY-SA 4.0');assert.equal(result[0].photo.url,'https://thumb.wikimedia.org/photo.jpg');
  globalThis.fetch=async()=>{throw new Error('Unavailable');};assert.deepEqual(await destinationPhotos(items),items,'Missing photos must not break discovery');
  let fetched=false;globalThis.fetch=async()=>{fetched=true;};assert.deepEqual(await destinationPhotos([{id:'not-a-page-id'}]),[{id:'not-a-page-id'}]);assert.equal(fetched,false);
}finally{globalThis.fetch=originalFetch;}
const js=await readFile(new URL('../discovery-studio.js',import.meta.url),'utf8'),css=await readFile(new URL('../discovery-studio.css',import.meta.url),'utf8');
for(const label of ['Overview','Fun fact','Before you go','Photo & source'])assert.ok(js.includes(label));
assert.match(js,/aria-haspopup','dialog/);assert.match(js,/ArrowRight/);assert.match(js,/Photo unavailable/);
assert.match(css,/hover:hover/);assert.match(css,/prefers-reduced-motion:reduce/);assert.match(css,/data-reduce-motion="true"/);assert.match(css,/height:380px/);
console.log('Discovery photos passed: host validation, tracking removal, attribution, filename normalization, provider failure, invalid IDs, keyboard tabs, fixed dimensions, and reduced motion.');
