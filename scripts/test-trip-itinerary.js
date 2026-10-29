import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../trip-itinerary.js',import.meta.url),'utf8');
const context=vm.createContext({joyDate:value=>value,state:{session:{user:{id:'me'}}}});vm.runInContext(source,context);
const trip={id:'a'},records={
  flights:[{id:'f',trip_id:'a',user_id:'me',airline:'Air Example',flight_number:'123',departure_airport:'CLT',arrival_airport:'NRT',departs_at:'2026-11-01T12:00:00Z',arrives_at:'2026-11-02T03:00:00Z',provider_ref:'FLIGHT-REF',status:'scheduled',details:{seat:'12A',gate:'B2'}},{id:'private-other-trip',trip_id:'b',provider_ref:'DO-NOT-SHOW'}],
  hotels:[{id:'h',trip_id:'a',hotel_name:'Example stay',confirmation_number:'STAY-REF',check_in_at:'2026-11-02T07:00:00Z',check_out_at:'2026-11-04T01:00:00Z'}],
  transportation_records:[{id:'r',trip_id:'a',pickup_at:'2026-11-02T04:00:00Z',provider_name:'Saved ride',status:'planned'}],
  cruise_bookings:[{id:'c',trip_id:'a',ship_name:'Example ship',sailing_date:'2026-11-05',return_date:'2026-11-08',boarding_time:'2026-11-05T12:00:00Z',booking_confirmation:'CRUISE-REF',reservation_status:'planned'}],
  schedule_items:[{id:'s',trip_id:'a',title:'Dinner',starts_at:'2026-11-02T10:00:00Z',details:{notes:'Window table'}},{id:'u',trip_id:'a',title:'Time to arrange',starts_at:'invalid'}],
  cruise_excursions:[{id:'e',trip_id:'a',title:'Shore walk',starts_at:'2026-11-06T08:00:00Z',status:'saved',meeting_location:'Pier'}]
};
context.trip=trip;context.records=records;
const entries=vm.runInContext('tripItineraryEntries(trip,records,"me")',context);
assert.equal(entries.length,11);assert.equal(entries.at(-1).title,'Time to arrange');
assert.equal(entries.filter(e=>e.category==='flight').length,2);
assert.equal(entries.filter(e=>e.category==='stay').length,2);
assert.equal(entries.filter(e=>e.category==='cruise').length,3);
assert.equal(entries.find(e=>e.when==='2026-11-05').date.key,'2026-11-05','Date-only cruise dates must not shift with timezone');
assert.equal(entries.find(e=>e.when==='2026-11-05').date.allDay,true);
assert.ok(!JSON.stringify(entries).includes('DO-NOT-SHOW'),'Other trip records must never enter the itinerary');
assert.ok(entries[0].fields.some(([label,value])=>label==='Seat'&&value==='12A'));
assert.ok(entries[0].fields.some(([label,value])=>label==='Assigned to'&&value==='You'));
assert.equal(entries.find(e=>e.category==='stay').status,'Saved plan','Do not invent hotel confirmation');
assert.equal(vm.runInContext('tripItineraryEntries(null,records).length',context),0);
assert.equal(vm.runInContext('tripItineraryEntries({id:"b"},{}).length',context),0);
for(const date of ['',null,'invalid','2026-02-30','2026-13-01']){context.value=date;assert.equal(vm.runInContext('itineraryDate(value)',context),null);}
const models=vm.runInContext('tripItineraryWidgetModels(trip,records)',context);
assert.equal(models.length,4);assert.equal(models[0][3],'1 saved plan','Departure and arrival must count as one booking');
assert.equal(models[2][3],'2 saved plans');
assert.match(source,/day.hidden=select.value/);assert.match(source,/trip\?\.id===state.activeTripId/);
console.log('Detailed itinerary passed: trip isolation, all booking categories, date-only dates, undated plans, chronology, exact booking counts, assignments, references, and honest status labels.');
