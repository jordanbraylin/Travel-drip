function itineraryDate(value) {
  if (!value) return null;
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const date = new Date(`${raw}T12:00:00`);
    if (Number.isNaN(date.getTime()) || date.getFullYear() !== Number(raw.slice(0,4)) || date.getMonth()+1 !== Number(raw.slice(5,7)) || date.getDate() !== Number(raw.slice(8,10))) return null;
    return {key:raw,date,allDay:true,sort:date.getTime()};
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  const key = [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
  return {key,date,allDay:false,sort:date.getTime()};
}

function tripItineraryEntries(trip, records = {}, userId = '') {
  if (!trip?.id) return [];
  const entries = [];
  const rows = table => (records[table] || []).filter(row => row.trip_id === trip.id);
  const field = (label,value) => value === null || value === undefined || value === '' ? null : [label,String(value)];
  const add = (table,row,phase,category,icon,title,when,place,fields) => {
    const details = row.details || row.metadata || {};
    const assignment = details.traveler_name || details.passenger_name || (row.user_id === userId ? 'You' : row.user_id ? 'Assigned traveler' : 'Trip plan');
    entries.push({id:`${table}:${row.id}:${phase}`,table,category,icon,title,when,date:itineraryDate(when),place:place || 'Location not added',status:row.status || row.reservation_status || 'Saved plan',fields:[field('Assigned to',assignment),...fields].filter(Boolean)});
  };
  for (const row of rows('flights')) {
    const d=row.details||{},name=[row.airline,row.flight_number].filter(Boolean).join(' ')||'Flight';
    const fields=[field('Airline',row.airline),field('Flight number',row.flight_number),field('Booking reference',row.provider_ref),field('Departure airport',row.departure_airport),field('Arrival airport',row.arrival_airport),field('Gate',d.gate),field('Terminal',d.terminal),field('Seat',d.seat),field('Baggage',d.baggage),field('Notes',d.notes)];
    if(d.boarding_time)add('flights',row,'boarding','flight','ticket',`Boarding · ${name}`,d.boarding_time,row.departure_airport,fields);
    add('flights',row,'departure','flight','plane-takeoff',`Depart · ${name}`,row.departs_at,[row.departure_airport,row.arrival_airport].filter(Boolean).join(' → '),fields);
    if(row.arrives_at)add('flights',row,'arrival','flight','plane-landing',`Arrive · ${name}`,row.arrives_at,row.arrival_airport,fields);
  }
  for (const row of rows('hotels')) {
    const d=row.details||{},fields=[field('Property',row.hotel_name),field('Address',row.address),field('Booking reference',row.confirmation_number),field('Room',d.room_type||d.room),field('Notes',d.notes)];
    add('hotels',row,'check-in','stay','bed-double',`Check in · ${row.hotel_name}`,row.check_in_at,row.address,fields);
    if(row.check_out_at)add('hotels',row,'check-out','stay','door-open',`Check out · ${row.hotel_name}`,row.check_out_at,row.address,fields);
  }
  for (const row of rows('transportation_records')) {
    const d=row.details||{},type=String(row.transportation_type||'Transportation').replaceAll('_',' ');
    add('transportation_records',row,'pickup','transport','car-front',`${row.provider_name||'Transportation'} · ${type}`,row.pickup_at,[row.pickup_location,row.dropoff_location].filter(Boolean).join(' → '),[field('Pickup',row.pickup_location),field('Drop-off',row.dropoff_location),field('Booking reference',d.confirmation_number||d.booking_reference),field('Vehicle',d.vehicle),field('Notes',d.notes)]);
  }
  for (const row of rows('cruise_bookings')) {
    const name=[row.cruise_line,row.ship_name].filter(Boolean).join(' · ')||'Cruise';
    const fields=[field('Cruise line',row.cruise_line),field('Ship',row.ship_name),field('Booking reference',row.booking_confirmation),field('Departure port',row.departure_port),field('Arrival port',row.arrival_port),field('Terminal',row.departure_terminal),field('Nights',row.number_of_nights)];
    if(row.boarding_time)add('cruise_bookings',row,'boarding','cruise','ticket',`Board cruise · ${name}`,row.boarding_time,row.departure_port,fields);
    add('cruise_bookings',row,'sailing','cruise','ship',`Sail · ${name}`,row.sailing_date,row.departure_port,fields);
    if(row.return_date)add('cruise_bookings',row,'return','cruise','anchor',`Cruise return · ${name}`,row.return_date,row.arrival_port,fields);
  }
  for (const row of rows('schedule_items')) {
    const d=row.details||{};
    add('schedule_items',row,'activity','activity','calendar-days',row.title||'Planned activity',row.starts_at,row.location_name,[field('Address',row.location_address),field('Ends',row.ends_at?joyDate(row.ends_at):null),field('Booking reference',d.confirmation_number||d.booking_reference),field('Notes',d.notes||d.description)]);
  }
  for (const row of rows('cruise_excursions')) {
    const d=row.metadata||{};
    add('cruise_excursions',row,'excursion','activity','map-pinned',row.title||'Excursion',row.starts_at,row.meeting_location,[field('Meeting place',row.meeting_location),field('Ends',row.ends_at?joyDate(row.ends_at):null),field('Description',row.description),field('Booking reference',d.confirmation_number||d.booking_reference)]);
  }
  return entries.sort((a,b)=>(a.date?.key||'9999').localeCompare(b.date?.key||'9999') || Number(b.date?.allDay||false)-Number(a.date?.allDay||false) || (a.date?.sort||0)-(b.date?.sort||0) || a.id.localeCompare(b.id));
}

function itineraryEntryLines(entry) {
  const time=entry.date ? entry.date.allDay ? `${entry.date.date.toLocaleDateString()} · Time not added` : entry.date.date.toLocaleString() : 'Date and time not added';
  return [time,entry.place,`Saved status: ${String(entry.status).replaceAll('_',' ')}`,...entry.fields.map(([label,value])=>`${label}: ${value}`)];
}

function tripItineraryWidgetModels(trip, records) {
  const entries=tripItineraryEntries(trip,records,state.session?.user?.id);
  return [['Flights & boarding','plane-takeoff','aqua',['flight']],['Your stays','bed-double','yellow',['stay']],['Rides & cruising','ship','green',['transport','cruise']],['Activities & excursions','map-pinned','pink',['activity']]].map(([title,icon,tone,categories])=>{
    const matching=entries.filter(entry=>categories.includes(entry.category));
    const count=new Set(matching.map(entry=>`${entry.table}:${entry.id.split(':')[1]}`)).size;
    const summary=count?`${count} saved ${count===1?'plan':'plans'}`:'Nothing saved yet';
    const lines=matching.length?matching.flatMap(entry=>[entry.title,...itineraryEntryLines(entry)]):['No saved details in this category for this trip.'];
    return [title,icon,tone,summary,()=>document.querySelector('#detailedTripItinerary')?.scrollIntoView({behavior:document.documentElement.dataset.reduceMotion==='true'?'auto':'smooth',block:'start'}),lines];
  });
}

function renderDetailedTripItinerary(workspace,trip) {
  const records=trip?.id===state.activeTripId?state.accountData.records||{}:{};
  const entries=tripItineraryEntries(trip,records,state.session?.user?.id);
  const section=document.createElement('section');section.id='detailedTripItinerary';section.className='detailed-trip-itinerary';section.setAttribute('aria-labelledby','tripItineraryHeading');
  const header=document.createElement('header');header.append(joyText('p','EVERY PART OF YOUR ADVENTURE','eyebrow'),joyText('h3','Your day-by-day itinerary'));header.querySelector('h3').id='tripItineraryHeading';
  const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone;
  header.append(joyText('p',`Times shown in ${timezone}. Saved booking details, not live travel status.`,'itinerary-time-note'));section.append(header);
  if(!trip){section.append(joyText('p','Create or select a saved trip to see its bookings and day-by-day plans.'));workspace.append(section);return;}
  const failed=['flights','hotels','transportation_records','cruise_bookings','cruise_excursions','schedule_items'].filter(table=>state.accountData.moduleErrors?.[table]);
  if(failed.length){const warning=joyText('p',`Some trip details could not load: ${failed.map(name=>({flights:'flights',hotels:'stays',transportation_records:'transportation',cruise_bookings:'cruises',cruise_excursions:'excursions',schedule_items:'activities'})[name]).join(', ')}.`,'itinerary-load-warning');warning.setAttribute('role','status');section.append(warning,workspaceButton('Refresh trip details',()=>loadAccountData()));}
  if(!entries.length){section.append(joyText('p','Your itinerary is ready for its first plan. Saved travel and activities will appear here.'));workspace.append(section);return;}
  const groups=new Map();for(const entry of entries){const key=entry.date?.key||'undated';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(entry);}
  const filter=joyText('label','Jump to a day','itinerary-day-filter'),select=document.createElement('select');select.setAttribute('aria-label','Itinerary day');select.append(joyText('option','All days'));select.options[0].value='all';filter.append(select);section.append(filter);
  const days=document.createElement('div');days.className='itinerary-days';
  for(const [key,items]of groups){
    const day=document.createElement('section');day.className='itinerary-day';day.dataset.day=key;
    const dayLabel=key==='undated'?'Dates to arrange':items[0].date.date.toLocaleDateString([],{weekday:'long',month:'long',day:'numeric',year:'numeric'});
    day.append(joyText('h4',dayLabel));const option=joyText('option',dayLabel);option.value=key;select.append(option);
    const list=document.createElement('ol');list.className='itinerary-timeline';
    for(const entry of items){
      const item=document.createElement('li');item.className=`itinerary-moment itinerary-${entry.category}`;
      const time=joyText('time',entry.date?entry.date.allDay?'Time to come':entry.date.date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):'Date to come');if(entry.date)time.dateTime=entry.when;
      const content=document.createElement('article');const kind=joyText('span',entry.category==='stay'?'Stay':entry.category==='transport'?'Transportation':entry.category==='activity'?'Activity':entry.category==='cruise'?'Cruise':'Flight','itinerary-kind');
      content.append(kind,joyText('h5',entry.title),joyText('p',entry.place),joyText('span',`Saved status: ${String(entry.status).replaceAll('_',' ')}`,'itinerary-saved-status'));
      const details=document.createElement('details');details.append(joyText('summary','Booking & plan details'));const fields=document.createElement('dl');for(const [label,value]of entry.fields){const pair=document.createElement('div');pair.append(joyText('dt',label),joyText('dd',value));fields.append(pair);}details.append(fields,workspaceButton('Open full details',()=>joyDialog(entry.title,itineraryEntryLines(entry),{label:'Trip documents',run:()=>navigateSafely('importantInfo',{updateHistory:true})})));content.append(details);item.append(time,content);list.append(item);
    }
    day.append(list);days.append(day);
  }
  select.addEventListener('change',()=>{for(const day of days.children)day.hidden=select.value!=='all'&&day.dataset.day!==select.value;});section.append(days);workspace.append(section);window.lucide?.createIcons();
}
