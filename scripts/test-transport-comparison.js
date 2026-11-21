import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../journey-dashboard.js',import.meta.url),'utf8');const c=vm.createContext({});vm.runInContext(source,c);
const total=(a,b,n,currency)=>vm.runInContext(`transportQuoteTotal(${JSON.stringify(a)},${JSON.stringify(b)},${n},${JSON.stringify(currency)})`,c);
assert.equal(total('10.25','person',3,'USD').totalUnits,3075);
assert.equal(total('30','group',3,'USD').totalUnits,3000);
assert.equal(total('1200','person',2,'JPY').totalUnits,2400);
assert.equal(total('1.234','person',2,'KWD').totalUnits,2468);
for(const [a,b,n,currency]of [['10.001','person',2,'USD'],['1.5','person',2,'JPY'],['1','person',0,'USD'],['1','person',1.5,'USD'],['-2','group',2,'USD'],['1','group',2,'ZZZ'],['','group',2,'USD']])assert.throws(()=>total(a,b,n,currency));
console.log('Transport cost comparison passed: group/per-person totals, exact currency precision, invalid prices and traveler counts rejected.');
