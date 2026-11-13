import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

class Node {
  constructor() { this.children=[]; this.nodes={}; this.dataset={}; this.events={}; this.attrs={}; this.className=''; this.hidden=false; this.inert=false; }
  get classList() { const node=this; return {contains:name=>node.className.split(' ').includes(name),toggle(name,on){const set=new Set(node.className.split(' ').filter(Boolean));on?set.add(name):set.delete(name);node.className=[...set].join(' ');}}; }
  set innerHTML(_value) { for(const name of ['.passport-paper','.passport-prev','.passport-next','.passport-page-count','.passport-place','.passport-date','.passport-stamp','.passport-note','.passport-tally'])this.nodes[name]=new Node(); }
  querySelector(selector) { return this.nodes[selector]; }
  querySelectorAll() { return []; }
  append(...nodes) { this.children.push(...nodes); for(const node of nodes) node.parent=this; }
  before(node) { this.wrapper=node; }
  setAttribute(key,value) { this.attrs[key]=value; }
  removeAttribute(key) { delete this.attrs[key]; }
  addEventListener(type,fn) { this.events[type]=fn; }
  cloneNode() { const copy=new Node(); copy.dataset={...this.dataset};copy.className=this.className;return copy; }
  remove() { if(this.parent)this.parent.children=this.parent.children.filter(node=>node!==this); }
  animate(frames,options) { const animation={frames,options};animation.finished=new Promise((resolve,reject)=>{animation.finish=resolve;animation.cancel=()=>reject(new Error('cancelled'));});Node.animations.push(animation);return animation; }
}
Node.animations=[];
let reduced=false;
const context=vm.createContext({ window:{matchMedia:()=>({matches:reduced})}, document:{createElement:()=>new Node()}, Element:Node, WeakMap, Set, Date });
vm.runInContext(await readFile(new URL('../passport-book.js',import.meta.url),'utf8'),context);
const list=new Node();
const posts=[{id:'a',location:'Paris',createdAt:'2026-11-13'},{id:'b',location:'Tokyo',createdAt:'2026-11-12'},{id:'c',location:''}];
list.children=posts.map(post=>Object.assign(new Node(),{className:'photo-post',dataset:{postId:post.id}}));
const api=context.window.TravelDripPassport.mount(list);
assert.equal(context.window.TravelDripPassport.mount(list),api,'Do not wire duplicate controllers');
api.render(posts);
const book=list.wrapper, paper=book.nodes['.passport-paper'];
assert.equal(book.nodes['.passport-prev'].disabled,true);
assert.equal(book.nodes['.passport-next'].disabled,false);
assert.equal(list.children.filter(node=>!node.hidden).length,1);
assert.equal(await api.turn(-1),false);
const turning=api.turn(1);
assert.equal(list.children[1].inert,true,'Underlying controls must not receive clicks during a turn');
assert.equal(await api.turn(2),false,'Rapid clicks must not skip pages during an animation');
assert.equal(Node.animations.at(-1).options.duration,680);
assert.match(Node.animations.at(-1).frames[2].transform,/-179/);
Node.animations.at(-1).finish();await turning;
assert.equal(api.position,1);
assert.equal(book.nodes['.passport-page-count'].textContent,'Page 2 of 3');
assert.equal(list.children[1].inert,false);
const backwards=api.turn(0);assert.match(Node.animations.at(-1).frames[0].transform,/-179/);Node.animations.at(-1).finish();await backwards;
reduced=true;
const count=Node.animations.length;
await api.turn(2);
assert.equal(Node.animations.length,count,'Reduced motion skips the animated leaf');
assert.equal(book.nodes['.passport-next'].disabled,true);
api.render(posts.filter(post=>post.id!=='a'));
assert.equal(api.position,1,'Rendering preserves the selected post by ID');
const target={closest:()=>null};
paper.events.pointerdown({isPrimary:true,button:0,pointerId:1,clientX:200,clientY:100,target});
paper.events.pointerup({pointerId:1,clientX:290,clientY:104});
assert.equal(api.position,0,'A right swipe moves backward');
paper.events.pointerdown({isPrimary:true,button:0,pointerId:1,clientX:200,clientY:100,target});
paper.events.pointerup({pointerId:1,clientX:110,clientY:260});
assert.equal(api.position,0,'Vertical scrolling must not turn pages');
paper.events.pointerdown({isPrimary:true,button:0,pointerId:1,clientX:200,clientY:100,target:{closest:()=>({})}});
paper.events.pointerup({pointerId:1,clientX:100,clientY:100});
assert.equal(api.position,0,'Controls are excluded from swipe handling');
paper.events.keydown({target,key:'End',preventDefault(){}});
assert.equal(api.position,1);
paper.events.keydown({target:{closest:()=>({})},key:'Home',preventDefault(){throw new Error('Input key must not be intercepted');}});
assert.equal(api.position,1);
reduced=false;const pending=api.turn(0);api.reset();await pending;
assert.equal(book.nodes['.passport-place'].textContent,'Still collecting','Account reset clears private locations');
assert.equal(paper.children.some(node=>node.className==='passport-turning-leaf'),false,'Reset removes private animation clones');
assert.equal(book.nodes['.passport-next'].disabled,true);
assert.equal(context.window.TravelDripPassport.savedDate('bad'),'A travel memory');
console.log('Passport passed: page bounds, single live page, forward/back animation, rapid clicks, reduced motion, swipes, vertical scrolling, keyboard controls, selection retention and private reset.');
