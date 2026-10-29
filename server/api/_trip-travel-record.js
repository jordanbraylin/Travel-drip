import {sanitizeText} from './_security.js';

export function tripTravelRecord(body, userId) {
  const text=(key,max=180)=>sanitizeText(body[key],'',max);
  const date=key=>{
    if(!body[key])return null;
    if(typeof body[key]!=='string'||!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(body[key])||!Number.isFinite(Date.parse(body[key])))throw new Error(`Enter a valid ${key} date and time.`);
    const calendar=body[key].slice(0,10);
    if(new Date(`${calendar}T00:00:00Z`).toISOString().slice(0,10)!==calendar)throw new Error(`Enter a valid ${key} calendar date.`);
    return new Date(body[key]).toISOString();
  };
  const kind=body.kind;
  if(!['flight','stay','ride'].includes(kind))throw new Error('Choose a flight, stay, or ride.');
  const starts=date('startsAt'),ends=date('endsAt');
  if(!starts)throw new Error('Add a start date and time.');
  if(ends&&ends<=starts)throw new Error('The end must be after the start.');
  const base={trip_id:body.tripId,user_id:userId,details:{notes:text('notes',1500),source:'user_entered'}};
  if(kind==='flight'){
    const airline=text('name',120),flight=text('number',30),from=text('from',80),to=text('to',80),boarding=date('boardingAt');
    if(!airline||!flight||!from||!to)throw new Error('Add the airline, flight number, and both airports.');
    if(boarding&&boarding>starts)throw new Error('Boarding must not be after departure.');
    return {table:'flights',record:{...base,airline,flight_number:flight,departure_airport:from,arrival_airport:to,departs_at:starts,arrives_at:ends,status:'saved',details:{...base.details,boarding_time:boarding,gate:text('gate',40),seat:text('seat',40),confirmation_number:text('reference',100)}}};
  }
  if(kind==='stay'){
    const name=text('name');if(!name)throw new Error('Add the name of your stay.');
    return {table:'hotels',record:{...base,hotel_name:name,address:text('from',240),check_in_at:starts,check_out_at:ends,confirmation_number:text('reference',100),visibility:'assigned_user'}};
  }
  const name=text('name'),from=text('from',240),to=text('to',240);
  if(!name||!from||!to)throw new Error('Add the provider, pickup, and drop-off.');
  return {table:'transportation_records',record:{...base,provider_name:name,transportation_type:'ride_share',pickup_location:from,dropoff_location:to,pickup_at:starts,status:'planned',details:{...base.details,confirmation_number:text('reference',100)}}};
}
