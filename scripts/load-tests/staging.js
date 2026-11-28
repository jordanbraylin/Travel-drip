// Run only in an approved, isolated staging environment with synthetic data.
// Requires k6 and a cost-approved execution plan. This file does not run in the site build.
import http from 'k6/http';
import {sleep,check} from 'k6';
const base=__ENV.LOAD_TEST_BASE_URL||'';
const level=Number(__ENV.LOAD_TEST_USERS||0);
if(__ENV.LOAD_TEST_AUTHORIZED!=='true'||!/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(base)||/travel-drip\.com|supabase\.co/.test(base))throw new Error('Only an explicitly authorized isolated staging deployment is allowed.');
if(![10,100,1000,10000,50000,100000,250000,500000].includes(level))throw new Error('Choose an approved test level.');
if(level>=10000&&__ENV.DISTRIBUTED_CAPACITY_APPROVED!=='true')throw new Error('Large tests require a distributed runner and separately approved capacity/budget.');
export const options={stages:[{duration:'2m',target:level},{duration:'5m',target:level},{duration:'2m',target:0}],thresholds:{http_req_failed:[{threshold:'rate<0.01',abortOnFail:true,delayAbortEval:'1m'}],http_req_duration:['p(95)<1500','p(99)<3000']}};
export function setup(){const r=http.get(base+'/.well-known/load-test-environment');let marker;try{marker=r.json();}catch{}if(r.status!==200||marker?.environment!=='isolated-staging'||marker?.syntheticData!==true||marker?.paidProvidersDisabled!==true)throw new Error('Staging safety marker missing. Refusing to generate load.');}
export default function(){
 // Public CDN workload only. Authenticated write, messaging, upload, fare and payment workloads
 // need a separate synthetic-data environment and provider sandboxes before adding them here.
 const r=http.get(base+'/login',{tags:{journey:'public_shell'}});check(r,{'shell loaded':v=>v.status===200});sleep(15+Math.random()*15);
}
