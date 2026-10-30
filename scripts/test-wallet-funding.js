import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {walletFundingStatus} from '../server/api/_wallet-funding.js';

const configured={STRIPE_SECRET_KEY:'test-only',STRIPE_WEBHOOK_SECRET:'test-only',APP_BASE_URL:'https://travel-drip.com'};
assert.equal(walletFundingStatus(configured).available,true);
for(const key of Object.keys(configured)){const env={...configured,[key]:' '};assert.equal(walletFundingStatus(env).available,false);assert.deepEqual(walletFundingStatus(env).missing,[key]);}
const source=await readFile(new URL('../server/api/wallet.js',import.meta.url),'utf8');
const checkout=source.slice(source.indexOf('async function createContributionCheckout('),source.indexOf('async function createPaymentRequest('));
const user={id:'member-one'},trip={id:'trip-one',status:'draft',trip_type:'group_trip'},wallet={id:'wallet-one',status:'active',currency:'USD'};
const body={tripId:trip.id,amountCents:1000,idempotencyKey:'attempt-one'};
let ready=false,contextCalls=0,existing=null,existingError=null,filters=[],inserts=0,checkouts=0;
const supabase={from(){const query={select(){return query;},eq(key,value){filters.push([key,value]);return query;},maybeSingle:async()=>({data:existing,error:existingError}),insert(){inserts++;return query;},single:async()=>({data:{id:'contribution-one',amount_cents:1000,currency:'USD',status:'pending'},error:null}),update(){return query;},then(resolve){return Promise.resolve(resolve({error:null}));}};return query;}};
const context=vm.createContext({walletFundingStatus:()=>walletFundingStatus(ready?configured:{...configured,STRIPE_WEBHOOK_SECRET:''}),getTripContext:async()=>{contextCalls++;return {trip,wallet,role:'member'};},sanitizeText:(value,fallback)=>value||fallback,isFundingTrip:()=>true,walletDisplayName:()=> 'Friend Group Funds',moneyCents:value=>value,randomUUID:()=> 'attempt-one',accessPayload:()=>({canContribute:true}),stripeCheckout:async()=>{checkouts++;return {id:'session-one',url:'https://checkout.stripe.com/test-only'};},writeAuditLog:async()=>{},supabase,user,body});
vm.runInContext(checkout,context);
const run=async()=>{const res={status(code){this.code=code;return this;},json(body){this.body=body;}};context.res=res;await vm.runInContext('createContributionCheckout({},res,supabase,user,body)',context);return res;};
let res=await run();assert.equal(res.code,503);assert.equal(contextCalls,0);assert.equal(inserts,0);assert.equal(checkouts,0,'Never start checkout without the settlement webhook');
ready=true;existing={id:'old',user_id:user.id,amount_cents:1000,currency:'USD',status:'processing',metadata:{checkoutUrl:'https://checkout.stripe.com/existing'}};
res=await run();assert.equal(res.code,200);assert.equal(res.body.checkoutUrl,existing.metadata.checkoutUrl);assert.ok(filters.some(([key,value])=>key==='user_id'&&value===user.id));assert.equal(inserts,0);
existing={...existing,amount_cents:2000};res=await run();assert.equal(res.code,409);
existing={...existing,amount_cents:1000,currency:'EUR'};res=await run();assert.equal(res.code,409);
existing={...existing,currency:'USD'};
existing={...existing,amount_cents:1000,user_id:'other-member'};res=await run();assert.equal(res.code,409);
existing={...existing,user_id:user.id,status:'completed'};res=await run();assert.equal(res.code,409);
existing=null;existingError={message:'query failed'};res=await run();assert.equal(res.code,503);assert.equal(checkouts,0);
existingError=null;res=await run();assert.equal(res.code,201);assert.equal(checkouts,1);assert.equal(inserts,1);
assert.match(source,/funding\.available && isFundingTrip/);
console.log('Wallet funding passed: webhook requirement, no writes/payment start while unconfigured, per-user idempotency, amount/currency checks, completed-payment guard, failed lookup and configured checkout fixture.');
