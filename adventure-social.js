/* Adventure Social: presentation over the existing authenticated trip workspaces. */
const adventureCategories = [
  {id:'food', title:'Food walks', image:'icons/adventure-food-reference.jpg', alt:'A beautifully prepared restaurant meal'},
  {id:'beaches', title:'Beach days', image:'icons/adventure-beach-reference.jpg', alt:'A sunny beach and blue sea'},
  {id:'activities', title:'Local culture', image:'icons/adventure-culture-reference.jpg', alt:'Colorful architecture beside the Mediterranean'},
  {id:'outdoor', title:'Outdoor adventures', image:'icons/adventure-outdoors-reference.jpg', alt:'Mountains and open-air travel inspiration'}
];
function adventureElement(tag, text, className='') {
  const el=document.createElement(tag); if(text)el.textContent=text; if(className)el.className=className; return el;
}
function adventureIcon(name) {
  const el=document.createElement('i');el.dataset.lucide=name;el.setAttribute('aria-hidden','true');return el;
}
function adventureButton(label, icon, action, className='') {
  const button=workspaceButton(label,action);button.className=`adventure-button ${className}`;
  if(icon)button.prepend(adventureIcon(icon));return button;
}
function adventurePhoto(src, alt, className='') {
  const img=adventureElement('img','',className);img.src=src;img.alt=alt;img.loading='lazy';img.decoding='async';
  img.addEventListener('error',()=>{if(!img.dataset.fallback){img.dataset.fallback='true';img.src='icons/planning-coast.jpg';img.alt='Coastal destination inspiration';}});return img;
}
function adventureTripModel(trip, counts={}, records={}, now=new Date()) {
  const count=Number(counts.members)||0;
  const start=/^\d{4}-\d{2}-\d{2}$/.test(trip?.starts_on||'')?new Date(`${trip.starts_on}T00:00:00`):null;
  const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const days=start?Math.round((start-today)/86400000):null;
  const timeline=(records.schedule_items||[]).filter(row=>row.title).map(row=>({...row,time:Date.parse(row.starts_at)})).sort((a,b)=>(Number.isFinite(a.time)?a.time:Infinity)-(Number.isFinite(b.time)?b.time:Infinity)).slice(0,3);
  return {count,countdown:days===null?'Dates to dream about':days>0?`${days} ${days===1?'day':'days'} to go`:days===0?'Adventure starts today':'Your travel story',timeline};
}
function adventureOpenDiscovery(category) {
  const destination=state.accountData.activeTrip?.destination||'';
  navigateSafely('exploreDrops',{updateHistory:true});
  const input=document.getElementById('destinationDiscoveryInput');
  if(destination&&input){input.value=destination;loadDestinationDiscovery(destination);}
  if(category)renderExplore(category);
  if(!destination)input?.focus();
}
function adventureOpenMemories() {
  navigateSafely('memoriesPanel',{updateHistory:true});
  const toggle=document.querySelector('.photo-composer-toggle');if(toggle)toggle.open=true;
  document.getElementById('photoCaption')?.focus();
}
function adventureOpenPoll() {
  navigateSafely('socialHub',{updateHistory:true});
  const form=document.getElementById('chatPollForm');if(form)setVisibilityWithoutCssLeaks(form,true);
  document.getElementById('chatPollQuestion')?.focus();
}
function initializeAdventureSocial() {
  document.body.classList.add('adventure-social');
  const menu=document.querySelector('.simple-main-menu');
  const icons={'Home':'house','My trips':'luggage','Plan a trip':'circle-plus','Find travel':'compass','Trip plan':'calendar-days','Wallet':'wallet','Messages':'messages-square','Photos':'images','Events':'calendar-heart','Account':'circle-user-round'};
  menu?.querySelectorAll(':scope > button').forEach(button=>{
    const text=button.textContent.trim();button.replaceChildren(adventureIcon(icons[text]||'compass'),adventureElement('span',text==='Find travel'?'Discover':text==='Photos'?'Memories':text));
    button.setAttribute('aria-label',text==='Find travel'?'Discover':text==='Photos'?'Memories':text);
  });
  const brand=document.querySelector('.sidebar .brand');
  if(brand){brand.replaceChildren(adventureIcon('plane'),adventureElement('strong','Travel-Drip'));}
  const topbar=document.querySelector('.topbar');
  if(topbar){const mobile=adventureElement('a','Travel-Drip','adventure-mobile-brand');mobile.id='adventureMobileBrand';mobile.href='/dashboard';mobile.dataset.routeLink='dashboardHome';mobile.prepend(adventureIcon('plane'));topbar.insertBefore(mobile,topbar.children[1]||null);}
  const mobileNav=document.querySelector('.mobile-nav');
  if(mobileNav){
    mobileNav.id='adventureMobileNav';
    // Keep all workspaces available from the side menu; give mobile the reference's five destinations.
    const items=[['Home','house','dashboard'],['Trips','luggage',''],['Discover','compass',''],['Memories','images','memories'],['Account','circle-user-round','settings']];
    mobileNav.replaceChildren(...items.map(([label,icon,id])=>{const b=document.createElement('button');b.type='button';if(id)b.dataset.mainNavId=id;else b.dataset.target=label==='Trips'?'tripsPanel':'exploreDrops';b.setAttribute('aria-label',label);b.append(adventureIcon(icon),adventureElement('span',label));return b;}));
  }
  window.lucide?.createIcons();
}
function preserveAdventureWidgets(host) {
  for(const id of ['incomingTripInvitationList','dashboardWidgets','dashboardHome']){const el=document.getElementById(id);if(el&&host?.contains(el))host.before(el);}
}
function finalizeAdventureNavigation(){
 const menu=document.querySelector('.simple-main-menu');if(!menu)return;
 const tools=document.createElement('details');tools.className='adventure-nav-tools';tools.dataset.consumerNav='';tools.append(adventureElement('summary','Trip tools'));
 for(const [selector,label,icon]of [[':scope > [data-target="transportationPanel"]','Transportation','car'],[':scope > [data-main-nav-id="itinerary"]','Trip plan','calendar-days']]){
  const button=menu.querySelector(selector);if(button){button.replaceChildren(adventureIcon(icon),adventureElement('span',label));tools.append(button);}
 }
 if(tools.children.length>1)menu.append(tools);
}
function resetAdventureDashboard() { const host=document.getElementById('adventureDashboard');preserveAdventureWidgets(host);host?.replaceChildren(); }
function renderAdventureDashboard(target) {
  const eligible=target==='dashboardHome'&&Boolean(state.session?.user)&&!document.body.classList.contains('corporate-employee-mode');
  let host=document.getElementById('adventureDashboard');
  if(!host){host=adventureElement('section','','adventure-dashboard');host.id='adventureDashboard';host.dataset.dashboardOnly='';host.setAttribute('aria-label','Your travel dashboard');document.querySelector('.topbar')?.after(host);}
  setVisibilityWithoutCssLeaks(host,eligible);
  document.body.classList.toggle('adventure-home',eligible);
  if(!eligible)return;
  preserveAdventureWidgets(host);
  host.replaceChildren();
  const trip=state.accountData.activeTrip,counts=state.accountData.counts||{},records=state.accountData.records||{};
  const userId=state.session.user.id,tripId=state.activeTripId;
  const model=adventureTripModel(trip,counts,records),photo=tripWorkspacePhoto(trip);
  if(/barcelona/i.test(trip?.destination||'')){photo.src='icons/adventure-barcelona.jpg';photo.alt='Barcelona destination illustration';}
  const header=adventureElement('header','','adventure-welcome');
  const title=adventureElement('div');const headline=adventureElement('h1');headline.append(adventureElement('span','More adventures. Better together.','adventure-heading-desktop'),adventureElement('span','Good plans. Great people.','adventure-heading-mobile'));title.append(headline,adventureElement('p','Your next great story starts here.'));
  const decoration=adventureElement('span','','adventure-sun');decoration.setAttribute('aria-hidden','true');decoration.append(adventureIcon('sun'),adventureIcon('plane'));header.append(title,decoration);host.append(header);
  const invitations=document.getElementById('incomingTripInvitationList');if(invitations)host.append(invitations);
  const row=adventureElement('div','','adventure-top-grid');
  const cover=adventureElement('article','','adventure-trip-cover');
  const image=adventurePhoto(trip?photo.src:'icons/adventure-barcelona.jpg',trip?photo.alt:'Barcelona destination illustration');image.loading='eager';image.fetchPriority='high';cover.append(image);
  const coverCopy=adventureElement('div','','adventure-cover-copy');coverCopy.append(adventureElement('span',trip?'YOUR NEXT TRIP':'YOUR NEXT CHAPTER','adventure-kicker'));
  coverCopy.append(adventureElement('h2',trip?.title||'Good plans. Great people.'));
  coverCopy.append(adventureElement('p',trip?[trip.destination,tripWorkspaceDates(trip),model.count?`${model.count} ${model.count===1?'traveler':'travelers'}`:''].filter(Boolean).join(' · '):'A whole world to explore. Make your first trip yours.'));
  const footer=adventureElement('div','','adventure-cover-footer');
  const people=adventureElement('div','','adventure-travelers');
  if(trip){const members=(records.trip_members||[]).slice(0,4);for(const member of members){const name=member.display_name||member.full_name;const dot=adventureElement('span',name?name.trim().split(/\s+/).map(s=>s[0]).slice(0,2).join(''):'','adventure-person');if(!name)dot.append(adventureIcon('user-round'));dot.setAttribute('aria-hidden','true');people.append(dot);}people.append(adventureElement('span',model.countdown,'adventure-countdown'));}
  else people.append(adventureElement('span','Destination inspiration','adventure-inspiration-label'));
  footer.append(people,adventureButton(trip?'Open trip':"Let's plan",null,()=>trip?navigateSafely('tripsPanel',{updateHistory:true}):openWorkspacePlanning(),'adventure-white'));
  coverCopy.append(footer);cover.append(coverCopy);row.append(cover);
  const steps=adventureElement('aside','','adventure-next');steps.append(adventureElement('h2',"What's the plan?"));
  for(const [label,icon,action]of [['Invite a friend','users-round',()=>trip?openTripInviteDialog():openWorkspacePlanning()],['Add a flight or stay','plane',()=>trip?navigateSafely('rideShareHub',{updateHistory:true}):openWorkspacePlanning()],['Build our itinerary','map-pin',()=>trip?navigateSafely('itineraryAlerts',{updateHistory:true}):openWorkspacePlanning()]]){
    const b=adventureButton(label,icon,action);if(label==='Add a flight or stay'){const text=b.childNodes[1];const group=adventureElement('span');group.append(adventureElement('span',label,'adventure-label-desktop'),adventureElement('span','Add travel details','adventure-label-mobile'));b.replaceChild(group,text);}b.append(adventureIcon('chevron-right'));steps.append(b);
  }
  row.append(steps);host.append(row);
  if(state.accountData.error){const error=adventureElement('p','Your saved trips could not be loaded. Refresh to try again.','adventure-notice');error.setAttribute('role','status');host.append(error);}
  else if(!state.accountData.loaded)host.append(adventureElement('p','Loading your saved travel plans…','adventure-notice'));
  const discovery=adventureElement('section','','adventure-discovery');const discoveryHeading=adventureElement('h2','Find your kind of fun');discoveryHeading.prepend(adventureIcon('sparkles'));discovery.append(discoveryHeading);
  const tiles=adventureElement('div','','adventure-discovery-grid');
  for(const item of adventureCategories){
    const tile=adventureElement('article','','adventure-discovery-tile');
    const explore=adventureButton(item.title,null,()=>adventureOpenDiscovery(item.id),'adventure-tile-button');explore.prepend(adventurePhoto(item.image,item.alt));
    const label=adventureElement('span',item.title,'adventure-tile-label');explore.replaceChild(label,explore.childNodes[1]);
    const key=`traveldrip:adventure-interests:${userId}`;let selected=[];try{selected=JSON.parse(localStorage.getItem(key)||'[]');if(!Array.isArray(selected))selected=[];}catch{selected=[];}
    const save=adventureButton('', 'heart',()=>{try{const current=JSON.parse(localStorage.getItem(key)||'[]');const list=Array.isArray(current)?current:[];const next=list.includes(item.id)?list.filter(id=>id!==item.id):[...list,item.id];localStorage.setItem(key,JSON.stringify(next));save.setAttribute('aria-pressed',String(next.includes(item.id)));status.textContent=next.includes(item.id)?`${item.title} saved on this device.`:`${item.title} removed from your saved ideas.`;}catch{status.textContent='This browser could not save the idea. You can still explore it.';}},'adventure-save');save.setAttribute('aria-label',`Save ${item.title} on this device`);save.setAttribute('aria-pressed',String(selected.includes(item.id)));tile.append(explore,save);tiles.append(tile);
  }
  const status=adventureElement('p','','adventure-save-status');status.setAttribute('role','status');discovery.append(tiles,status);host.append(discovery);
  const bottom=adventureElement('div','','adventure-bottom-grid');
  const timeline=adventureElement('section','','adventure-panel adventure-timeline');const timelineTitle=adventureElement('h2','Our trip timeline');timelineTitle.prepend(adventureIcon('calendar-days'));timeline.append(timelineTitle);
  if(model.timeline.length){const first=model.timeline[0];if(Number.isFinite(first.time))timeline.append(adventureElement('span',new Date(first.time).toLocaleDateString([],{weekday:'short',day:'numeric',month:'short'}),'adventure-date-chip'));
    const list=adventureElement('ol');for(const item of model.timeline){const entry=adventureElement('li');if(Number.isFinite(item.time))entry.append(adventureElement('time',new Date(item.time).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})));entry.append(adventureElement('strong',item.title));if(item.location_name)entry.append(adventureElement('span',item.location_name));list.append(entry);}timeline.append(list);
  }else timeline.append(adventureElement('p',trip?'Leave room for a little adventure. Add your first itinerary item.':'Your days, beautifully together. Create a trip to start your timeline.','adventure-empty-copy'));
  timeline.append(adventureButton(trip?'View itinerary':'Plan a trip',null,()=>trip?navigateSafely('itineraryAlerts',{updateHistory:true}):openWorkspacePlanning(),'adventure-text-button'));bottom.append(timeline);
  const voting=adventureElement('section','','adventure-panel adventure-voting');const votingTitle=adventureElement('h2','Let the group decide');votingTitle.prepend(adventureIcon('users-round'));voting.append(votingTitle);
  const poll=(state.chatData.polls||[]).find(p=>p.status==='open'&&p.options?.length);
  if(poll){voting.append(adventureElement('p',poll.question));for(const option of poll.options.slice(0,2)){const optionRow=adventureElement('div','','adventure-vote-row');optionRow.append(adventureElement('span',option.label));const vote=adventureButton(poll.selectedOptionId===option.id?'Voted':'Vote',null,async()=>{vote.disabled=true;try{await apiRequest('/api/chat',{method:'POST',body:JSON.stringify({action:'vote',tripId,pollId:poll.id,optionId:option.id})});if(state.session?.user?.id!==userId||state.activeTripId!==tripId)return;await loadTripChatData();renderAdventureDashboard(getTargetFromRoute());}catch{vote.disabled=false;voteStatus.textContent='Your vote could not be saved. Please try again.';}},'adventure-pink');vote.setAttribute('aria-label',`Vote for ${option.label}`);vote.setAttribute('aria-pressed',String(poll.selectedOptionId===option.id));optionRow.append(vote);voting.append(optionRow);}}
  else{const illustration=adventureElement('div','','adventure-vote-art');illustration.append(adventureIcon('sailboat'),adventureIcon('utensils'));voting.append(illustration,adventureElement('p','A boat day or a food tour? Make the next decision together.'),adventureButton('Create a poll',null,()=>trip?adventureOpenPoll():openWorkspacePlanning(),'adventure-white'));}
  const voteStatus=adventureElement('p','','adventure-save-status');voteStatus.setAttribute('role','status');voting.append(voteStatus);bottom.append(voting);
  const memories=adventureElement('section','','adventure-panel adventure-memories');const memoriesTitle=adventureElement('h2','Little moments, big memories');memoriesTitle.prepend(adventureIcon('camera'));memories.append(memoriesTitle);
  const collage=adventureElement('div','','adventure-memory-collage');
  const posts=typeof photoFeedState!=='undefined'&&photoFeedState.key===`${userId}:${tripId}`?photoFeedState.posts.filter(p=>p.mediaUrl&&p.mediaType?.startsWith('image/')).slice(0,3):[];
  if(posts.length)for(const post of posts)collage.append(adventurePhoto(post.mediaUrl,post.caption||'Saved travel photo'));
  else{collage.classList.add('is-inspiration');collage.append(adventurePhoto('icons/adventure-beach-reference.jpg','Beach inspiration'),adventurePhoto('icons/adventure-food-reference.jpg','Dining inspiration'),adventurePhoto('icons/adventure-culture-reference.jpg','Architecture inspiration'));}
  memories.append(collage,adventureElement('p',posts.length?'Your shared travel moments.':'Inspiration today. Your own memories tomorrow.','adventure-memory-note'),adventureButton('Add a moment','camera',()=>trip?adventureOpenMemories():openWorkspacePlanning(),'adventure-pink'));bottom.append(memories);host.append(bottom);
  const extras=adventureElement('details','','adventure-more');const summary=adventureElement('summary','More for your trip');extras.append(summary);
  const more=adventureElement('div','','adventure-more-grid');for(const [label,icon,target]of [['Build our itinerary','calendar-days','itineraryAlerts'],['Weather & travel','cloud-sun','rideShareHub'],['Transportation','car','transportationPanel'],['Trip documents','tickets-plane','importantInfo'],['Wallet & splitting','wallet','walletPanel'],['Messages','messages-square','socialHub'],['Events','calendar-heart','eventsPanel']])more.append(adventureButton(label,icon,()=>navigateSafely(target,{updateHistory:true})));more.append(adventureButton('Invite a friend','users-round',()=>trip?openTripInviteDialog():openWorkspacePlanning()));extras.append(more);
  for(const id of ['dashboardHome','dashboardWidgets']){const existing=document.getElementById(id);if(existing)extras.append(existing);}
  host.append(extras);
  window.lucide?.createIcons({root:host});
}
