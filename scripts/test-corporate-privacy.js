import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {listOperations} from '../server/api/corporate-bookings.js';

const rows={
  corporate_travel_policies:[{id:'policy',trip_id:'trip',status:'active',flight_cap_cents:99000,allowed_airlines:['Confidential supplier']}],
  corporate_bookings:[
    {id:'mine',trip_id:'trip',traveler_user_id:'employee',created_by:'admin',title:'Assigned flight',total_cents:88000,currency:'USD',details:{contractRate:77000},metadata:{secret:'finance'},provider_reference:'QA-ONLY'},
    {id:'other',trip_id:'trip',traveler_user_id:'someone-else',created_by:'employee',title:'Other flight',total_cents:44000}
  ],
  corporate_booking_approvals:[{id:'approval',trip_id:'trip',amount_cents:88000,reason:'Confidential finance note'}],
  corporate_service_cases:[{id:'case',trip_id:'trip',traveler_user_id:'employee',created_by:'employee',status:'open',case_type:'change',subject:'QA change',metadata:{supplierContract:'private'},internal_notes:'finance only'}],
  corporate_attendees:[{id:'attendee',trip_id:'trip',user_id:'employee',access_status:'active',metadata:{documentsComplete:true}}]
};
async function run(role){
  const tables=[];
  const db={from(table){tables.push(table);const filters=[];let single=false;const q={select(){return q;},eq(k,v){filters.push(r=>r[k]===v);return q;},or(){filters.push(r=>r.traveler_user_id==='employee'||r.created_by==='employee');return q;},order(){return q;},limit(){return q;},maybeSingle(){single=true;return q;},then(resolve){const selected=rows[table].filter(r=>filters.every(f=>f(r)));return Promise.resolve(resolve({data:single?selected[0]||null:selected,error:null}));}};return q;}};
  const res={status(code){this.code=code;return this;},json(data){this.body=data;}};
  await listOperations(res,db,{id:'employee'},{role,trip:{id:'trip'}},'trip');
  assert.equal(res.code,200);return {data:res.body,tables};
}
const employee=await run('employee');
assert.equal(employee.data.policy,null);
assert.deepEqual(employee.data.approvals,[]);
assert.equal(employee.tables.includes('corporate_travel_policies'),false);
assert.equal(employee.tables.includes('corporate_booking_approvals'),false);
assert.equal(employee.data.permissions.canViewFinance,false);
assert.equal(employee.data.bookings.length,1,'Only assigned travel, not another traveler record created by this employee');
assert.equal(employee.data.bookings[0].title,'Assigned flight');
assert.equal(employee.data.bookings[0].provider_reference,'QA-ONLY');
for(const field of ['total_cents','currency','details','metadata'])assert.equal(Object.hasOwn(employee.data.bookings[0],field),false);
for(const field of ['metadata','internal_notes'])assert.equal(Object.hasOwn(employee.data.serviceCases[0],field),false);
const lead=await run('team_lead');
assert.equal(lead.data.bookings.length,2,'Service leads retain operational travel coverage');
assert.equal(lead.data.permissions.canManageService,true);
assert.equal(lead.data.policy,null);
assert.deepEqual(lead.data.approvals,[]);
assert.equal(JSON.stringify(lead.data).includes('Confidential'),false);
for(const role of ['owner','admin','organizer','finance_admin']){
  const {data}=await run(role);
  assert.equal(data.permissions.canViewFinance,true);
  assert.equal(data.policy.flight_cap_cents,99000);
  assert.equal(data.bookings[0].total_cents,88000);
  assert.equal(data.approvals[0].amount_cents,88000);
}
const sql=await readFile(new URL('../supabase-corporate-finance-repair.sql',import.meta.url),'utf8');
assert.match(sql,/as restrictive for select to authenticated/);
assert.doesNotMatch(sql,/drop table|delete from|truncate/i);
const source=await readFile(new URL('../server/api/corporate-bookings.js',import.meta.url),'utf8');
let dbCalls=0;
const fixture=vm.createContext({managerRoles:new Set(['owner']),bookingTypes:new Set(['flight']),sanitizeText:(value,fallback)=>String(value||fallback).trim(),supabase:{from(){dbCalls++;throw new Error('Valid input reached database');}}});
vm.runInContext(source.slice(source.indexOf('async function createBooking('),source.indexOf('async function createServiceCase(')),fixture);
for(const total of [undefined,null,'',-1,'bad',Infinity,Number.MAX_SAFE_INTEGER*2]){
  const res={status(code){this.code=code;return this;},json(data){this.body=data;}};
  fixture.res=res;fixture.body={bookingType:'flight',providerName:'QA',travelerName:'Test',totalCents:total};
  await vm.runInContext('createBooking(res,supabase,{id:"owner"},{role:"owner",trip:{}},"trip",body)',fixture);
  assert.equal(res.code,400);
}
assert.equal(dbCalls,0,'Invalid costs must never become zero-cost compliant bookings');
const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
assert.match(app,/No support request has been sent/);
assert.doesNotMatch(app,/Organizer support request prepared/);
console.log('Corporate privacy passed: employee assignment, team-lead redaction, admin finance preservation, no confidential queries for employees, restrictive migration.');
