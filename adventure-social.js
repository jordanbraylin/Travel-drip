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
  const icons={'Home':'house','My trips':'luggage','Plan a trip':'plane','Find travel':'compass','Trip plan':'calendar-days','Wallet':'credit-card','Messages':'message-circle','Photos':'images','Events':'calendar-days','Account':'circle-user-round'};
  menu?.querySelectorAll(':scope > button').forEach(button=>{
    const text=button.textContent.trim();button.replaceChildren(adventureIcon(icons[text]||'compass'),adventureElement('span',text==='Find travel'?'Discover':text==='Photos'?'Memories':text));
    button.setAttribute('aria-label',text==='Find travel'?'Discover':text==='Photos'?'Memories':text);
  });
  const brand=document.querySelector('.sidebar .brand');
  if(brand){brand.replaceChildren(coastalBrandMark(),adventureElement('strong','Travel-Drip'));}
  const authBrand=document.querySelector('.auth-brand');if(authBrand)authBrand.replaceChildren(coastalBrandMark(),adventureElement('strong','Travel-Drip'));
  const topbar=document.querySelector('.topbar');
  if(topbar){const mobile=adventureElement('a','Travel-Drip','adventure-mobile-brand');mobile.id='adventureMobileBrand';mobile.href='/dashboard';mobile.dataset.routeLink='dashboardHome';mobile.prepend(coastalBrandMark());topbar.insertBefore(mobile,topbar.children[1]||null);}
  const mobileNav=document.querySelector('.mobile-nav');
  if(mobileNav){
    mobileNav.id='adventureMobileNav';
    // Keep all workspaces available from the side menu; give mobile the reference's five destinations.
    const items=[['Home','house','dashboard'],['Trips','luggage',''],['Discover','compass',''],['Memories','images','memories'],['Account','circle-user-round','settings']];
    mobileNav.replaceChildren(...items.map(([label,icon,id])=>{const b=document.createElement('button');b.type='button';if(id)b.dataset.mainNavId=id;else b.dataset.target=label==='Trips'?'tripsPanel':'exploreDrops';b.setAttribute('aria-label',label);b.append(adventureIcon(icon),adventureElement('span',label));return b;}));
  }
  window.lucide?.createIcons();
}
function coastalBrandMark(){const mark=adventureElement('span','','coastal-brand-mark');mark.setAttribute('aria-hidden','true');mark.append(adventureIcon('sun'),adventureIcon('plane'));return mark;}
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
function coastalMemberBubble(member,index){
 const own=member.user_id===state.session.user.id;
 const name=member.display_name||member.full_name||(own?(document.getElementById('profileFullNameInput')?.value||state.session.user.user_metadata?.full_name):'')||`Trip member ${index+1}`;
 const dot=adventureElement('span','','adventure-person');dot.title=name;dot.setAttribute('aria-label',name);
 const initials=name.startsWith('Trip member')?'':name.trim().split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase();
 if(own&&state.profilePhoto?.dataUrl)dot.append(adventurePhoto(state.profilePhoto.dataUrl,name));
 else if(member.avatar_url)dot.append(adventurePhoto(member.avatar_url,name));
 else if(initials)dot.textContent=initials;else dot.append(adventureIcon('user-round'));
 return dot;
}
async function hydrateCoastalMembers(host,members,userId,tripId){
 if(!state.supabase||!members.length)return;
 try{
  const ids=members.map(m=>m.user_id).filter(Boolean).slice(0,6);
  if(!ids.length)return;
  // Use the signed-in client: profile and storage RLS remain authoritative.
  const {data,error}=await state.supabase.from('profiles').select('id,full_name,avatar_storage_path,avatar_visibility').in('id',ids);
  if(error||!host.isConnected||state.session?.user?.id!==userId||state.activeTripId!==tripId)return;
  const hydrated=await Promise.all(members.map(async m=>{const p=data?.find(p=>p.id===m.user_id);if(!p)return m;let avatar_url='';if(p.avatar_storage_path&&(p.id===userId||['public','trip_members'].includes(p.avatar_visibility))){const signed=await state.supabase.storage.from('profile-photos').createSignedUrl(p.avatar_storage_path,300);avatar_url=signed.data?.signedUrl||'';}return {...m,full_name:p.full_name,avatar_url};}));
  if(!host.isConnected||state.session?.user?.id!==userId||state.activeTripId!==tripId)return;
  const group=host.querySelector('.coastal-member-bubbles');group?.replaceChildren(...hydrated.map(coastalMemberBubble));window.lucide?.createIcons({root:group});
 }catch{/* Initials and member icons remain available when a private portrait cannot be read. */}
}
function updateCoastalScenic(){
 const host=document.querySelector('.coastal-scenic');if(!host||!document.body.classList.contains('adventure-home'))return;
 const upcoming=confirmedUpcomingTrips(state.accountData.trips||[]),trip=upcoming[Math.floor(experienceTick/3)%Math.max(1,upcoming.length)];
 const place=publicInspiration(),gallery=trip?experienceGalleries.get(trip.destination):null,item=gallery?.slides?.[experienceTick%Math.max(1,gallery.slides.length)];if(trip)loadExperienceGallery(trip.destination);
 const src=trip?(item?.photo.url||tripWorkspacePhoto(trip).src):place.city==='Lisbon'?'icons/coastal-lisbon-hero.jpg':place.photo;
 const image=host.querySelector('img');if(image.getAttribute('src')!==src)image.src=src;image.alt=trip?(item?.title||`${trip.destination} destination inspiration`):place.alt;
 host.querySelector('h2').textContent=trip?`Your next chapter: ${trip.destination}.`:'Take the scenic route.';
 host.querySelector('p').textContent=trip?`${trip.title} · ${tripWorkspaceDates(trip)} · ${departureCountdown(trip,state.accountData.records?.flights||[])}`:'Everything for your next trip, beautifully together.';
 const actions=host.querySelector('.coastal-scenic-actions');actions.replaceChildren(adventureButton(trip?'View my trip':`Explore ${place.city}`,null,()=>{if(trip)return openConfirmedItinerary(trip);navigateSafely('exploreDrops',{updateHistory:true});const input=document.getElementById('destinationDiscoveryInput');if(input)input.value=place.location;loadDestinationDiscovery(place.location);},'coastal-explore'));
 if(trip&&item?.photo)actions.append(adventureButton('Photo credits',null,()=>joyDialog('Destination photo',[item.title,item.photo.artist,item.photo.license,item.photo.sourceUrl].filter(Boolean)),'coastal-credit'));
 host.querySelector('.experience-rotation-controls')?.remove();rotationButtons(host);window.lucide?.createIcons({root:host});
}
function renderAdventureDashboard(target) {
 const eligible=target==='dashboardHome'&&Boolean(state.session?.user)&&!document.body.classList.contains('corporate-employee-mode');
 let host=document.getElementById('adventureDashboard');if(!host){host=adventureElement('section','','adventure-dashboard');host.id='adventureDashboard';host.dataset.dashboardOnly='';host.setAttribute('aria-label','Your travel dashboard');document.querySelector('.topbar')?.after(host);}
 setVisibilityWithoutCssLeaks(host,eligible);document.body.classList.toggle('adventure-home',eligible);if(!eligible)return;
 preserveAdventureWidgets(host);host.replaceChildren();
 const trip=state.accountData.activeTrip,records=state.accountData.records||{},counts=state.accountData.counts||{},userId=state.session.user.id,tripId=state.activeTripId,model=adventureTripModel(trip,counts,records);
 const firstName=(document.getElementById('profileFullNameInput')?.value||state.session.user.user_metadata?.full_name||'').trim().split(/\s+/)[0];
 const header=adventureElement('header','','adventure-welcome'),h1=adventureElement('h1');h1.append(adventureElement('span',`A new adventure awaits${firstName?', '+firstName:''}.`,'adventure-heading-desktop'),adventureElement('span','Your next chapter.','adventure-heading-mobile'));header.append(h1,adventureElement('p','Everything for your next trip, beautifully together.'));host.append(header);
 const scenic=adventureElement('section','','coastal-scenic');const heroImage=adventurePhoto('icons/coastal-lisbon-hero.jpg','Lisbon rooftops at sunset');heroImage.loading='eager';scenic.append(heroImage);const heroCopy=adventureElement('div','','coastal-scenic-copy');heroCopy.append(adventureElement('h2','Take the scenic route.'),adventureElement('p','Everything for your next trip, beautifully together.'));const heroActions=adventureElement('div','','coastal-scenic-actions');heroActions.append(adventureButton('Explore Lisbon',null,()=>{navigateSafely('exploreDrops',{updateHistory:true});document.getElementById('destinationDiscoveryInput').value='Lisbon, Portugal';loadDestinationDiscovery('Lisbon, Portugal');}));heroCopy.append(heroActions);scenic.append(heroCopy);host.append(scenic);
 const invitations=document.getElementById('incomingTripInvitationList');if(invitations)host.append(invitations);
 const row=adventureElement('div','','coastal-trip-grid');
 const card=adventureElement('article','','coastal-trip-card');const photo=trip?tripWorkspacePhoto(trip):{src:'icons/coastal-lisbon-tram.jpg',alt:'Lisbon tram destination inspiration'};if(/lisbon/i.test(trip?.destination||'')){photo.src='icons/coastal-lisbon-tram.jpg';photo.alt='Lisbon tram destination inspiration';}card.append(adventurePhoto(photo.src,photo.alt));
 const copy=adventureElement('div','','coastal-trip-copy');copy.append(adventureElement('h2',trip?.title||'Your next adventure, with good company'),adventureElement('p',trip?[tripWorkspaceDates(trip),model.count?`${model.count} travelers`:''].filter(Boolean).join(' · '):'Choose a destination. Bring your favorite people.'));
 const people=adventureElement('div','','coastal-people');const bubbles=adventureElement('div','','coastal-member-bubbles');bubbles.setAttribute('role','group');bubbles.setAttribute('aria-label','Friends on this trip');const members=(records.trip_members||[]).slice(0,4);bubbles.append(...members.map(coastalMemberBubble));people.append(bubbles);
 const invite=adventureButton('', 'user-plus',()=>trip?openTripInviteDialog():openWorkspacePlanning(),'coastal-add-person');invite.setAttribute('aria-label','Invite friends to your trip');people.append(invite);copy.append(people);
 const footer=adventureElement('div','','coastal-trip-footer');footer.append(adventureElement('span',trip?model.countdown:'Start a new chapter','coastal-countdown'),adventureButton(trip?'Open trip':"Let's plan",null,()=>trip?navigateSafely('tripsPanel',{updateHistory:true}):openWorkspacePlanning(),'coastal-navy'));copy.append(footer);card.append(copy);row.append(card);
 const timeline=adventureElement('section','','coastal-panel coastal-timeline');timeline.append(adventureElement('h2','Your itinerary'));
 if(model.timeline.length){const list=adventureElement('ol');for(const item of model.timeline){const li=adventureElement('li');if(Number.isFinite(item.time))li.append(adventureElement('strong',new Date(item.time).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})));li.append(adventureElement('span',item.title));list.append(li);}timeline.append(list);}else timeline.append(adventureElement('p','A little room for adventure. Add the first stop to your itinerary.','coastal-empty'));
 timeline.append(adventureButton('View all plans','arrow-right',()=>trip?navigateSafely('itineraryAlerts',{updateHistory:true}):openWorkspacePlanning(),'coastal-text'));row.append(timeline);host.append(row);
 const bottom=adventureElement('div','','coastal-bottom-grid');const before=adventureElement('section','','coastal-panel coastal-checklist');before.append(adventureElement('h2','Before you go'));
 for(const [label,done,action]of [['Invite friends',model.count>1,()=>trip?openTripInviteDialog():openWorkspacePlanning()],['Add your stay',counts.hotels>0,()=>trip?navigateSafely('rideShareHub',{updateHistory:true}):openWorkspacePlanning()],['Upload boarding pass',(records.documents||[]).some(d=>/boarding|flight pass|cruise pass/i.test([d.title,d.document_type,d.file_name,d.name].filter(Boolean).join(' '))),()=>trip?navigateSafely('itineraryAlerts',{updateHistory:true}):openWorkspacePlanning()]]){const b=adventureButton(label,done?'square-check':'square',action);b.classList.add('coastal-check');b.dataset.complete=String(done);before.append(b);}bottom.append(before);
 const favorites=adventureElement('section','','coastal-panel coastal-favorites');favorites.append(adventureElement('h2','Group favorites'),adventureElement('small','Ideas to choose together','coastal-inspiration-note'));const photos=adventureElement('div','','coastal-favorite-photos');for(const [src,alt,category]of [['icons/coastal-pastries.jpg','Portuguese pastry inspiration','food'],['icons/coastal-sailing.jpg','Coastal sailing inspiration','activities']]){const b=adventureButton('',null,()=>adventureOpenDiscovery(category));b.setAttribute('aria-label',`Explore ${category==='food'?'food experiences':'excursions'}`);b.append(adventurePhoto(src,alt),adventureIcon('heart'));photos.append(b);}favorites.append(photos,adventureButton('Choose together',null,()=>trip?adventureOpenPoll():openWorkspacePlanning()));bottom.append(favorites);
 const journal=adventureElement('section','','coastal-panel coastal-journal');journal.append(adventureElement('h2','Your travel journal'));const collage=adventureElement('div','','coastal-polaroids');const posts=typeof photoFeedState!=='undefined'&&photoFeedState.key===`${userId}:${tripId}`?photoFeedState.posts.filter(p=>p.mediaUrl&&p.mediaType?.startsWith('image/')).slice(0,2):[];if(posts.length)for(const p of posts)collage.append(adventurePhoto(p.mediaUrl,p.caption||'Your saved travel memory'));else{collage.append(adventurePhoto('icons/coastal-lisbon-hero.jpg','Lisbon destination inspiration'),adventurePhoto('icons/coastal-sailing.jpg','Coastal sailing inspiration'));journal.append(adventureElement('small','Destination inspiration · Your own memories belong here.','coastal-inspiration-note'));}journal.append(collage,adventureButton('Add a memory',null,()=>trip?adventureOpenMemories():openWorkspacePlanning()));bottom.append(journal);host.append(bottom);
 if(state.accountData.error)host.append(adventureElement('p','Your saved trips could not be loaded. Refresh to try again.','adventure-notice'));
 hydrateCoastalMembers(host,members,userId,tripId);window.lucide?.createIcons({root:host});
}
function renderCoastalTripTools(container){
 const details=adventureElement('details','','adventure-more');details.append(adventureElement('summary','More for your trip'));const tools=adventureElement('div','','adventure-more-grid');for(const [label,icon,target]of [['Weather & travel','cloud-sun','rideShareHub'],['Transportation','car','transportationPanel'],['Trip documents','tickets-plane','importantInfo'],['Wallet & splitting','wallet','walletPanel'],['Messages','messages-square','socialHub'],['Events','calendar-heart','eventsPanel']])tools.append(adventureButton(label,icon,()=>navigateSafely(target,{updateHistory:true})));details.append(tools);
 const widgets=document.getElementById('dashboardWidgets');if(widgets){widgets.removeAttribute('data-dashboard-only');setVisibilityWithoutCssLeaks(widgets,true);details.append(widgets);}container.append(details);
}
function coastalWidgetPhoto(title){
 const rules=[[/people|friend|group/i,'coastal-friends.jpg','Friends enjoying a trip together'],[/fun|adventure|excursion/i,'coastal-camel.jpg','Camel riding adventure inspiration'],[/cruise|sail/i,'coastal-cruise.jpg','Cruise travel inspiration'],[/flight|boarding/i,'coastal-flight.jpg','Air travel inspiration'],[/ride|around|transport/i,'coastal-transport.jpg','Transportation inspiration'],[/stay|hotel/i,'coastal-stay.jpg','Hotel stay inspiration'],[/day|itinerary|plan|yours/i,'coastal-lisbon-tram.jpg','Travel planning inspiration']];
 const match=rules.find(([pattern])=>pattern.test(title));return adventurePhoto('icons/'+(match?.[1]||'coastal-lisbon-hero.jpg'),match?.[2]||'Destination inspiration','coastal-widget-photo');
}
function renderCoastalDiscoveryInvitations(host){
 if(host.querySelector('.coastal-discovery-play'))return;
 const section=adventureElement('section','','coastal-discovery-play');section.append(adventureElement('h3','What kind of story will you create?'),adventureElement('p','Start with a place, follow your curiosity, and make it yours.'));const grid=adventureElement('div','','coastal-discovery-choices');
 for(const [title,subtitle,src,category]of [['Taste something new','Markets, restaurants & local flavors','coastal-pastries.jpg','food'],['A little adventure','Excursions & unforgettable days','coastal-camel.jpg','activities'],['Find the hidden gems','Neighborhoods, culture & local stories','coastal-lisbon-tram.jpg','hidden'],['Slow down by the sea','Coastal escapes & outdoor moments','coastal-sailing.jpg','outdoor']]){
  const wrapper=adventureElement('article','','coastal-discovery-item');
  const b=adventureButton('',null,()=>{const input=host.querySelector('#destinationDiscoveryInput');const destination=input.value.trim();if(!destination){input.focus();const status=host.querySelector('#destinationDiscoveryStatus');status.textContent=`Where would you like to explore? Enter a destination to discover ${title.toLowerCase()}.`;return;}loadDestinationDiscovery(destination);renderExplore(category);},'coastal-discovery-choice');b.append(adventurePhoto('icons/'+src,subtitle),adventureElement('strong',title),adventureElement('span',subtitle));
  const key=`traveldrip:adventure-interests:${state.session?.user?.id||''}`;let selected=[];try{const saved=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(saved))selected=saved;}catch{}
  const save=adventureButton('','heart',()=>{try{const saved=JSON.parse(localStorage.getItem(key)||'[]');const list=Array.isArray(saved)?saved:[];const next=list.includes(category)?list.filter(x=>x!==category):[...list,category];localStorage.setItem(key,JSON.stringify(next));save.setAttribute('aria-pressed',String(next.includes(category)));host.querySelector('#destinationDiscoveryStatus').textContent=next.includes(category)?`${title} saved on this device.`:`${title} removed from saved ideas.`;}catch{host.querySelector('#destinationDiscoveryStatus').textContent='Your browser could not save this idea.';}},'coastal-interest-save');save.setAttribute('aria-label',`Save ${title} on this device`);save.setAttribute('aria-pressed',String(selected.includes(category)));wrapper.append(b,save);grid.append(wrapper);
 }
 section.append(grid);const actions=adventureElement('div','','coastal-discovery-actions');actions.append(adventureButton('Build my trip','sparkles',()=>navigateSafely('aiTravelPlanner',{updateHistory:true}),'coastal-navy'),adventureButton('Start a dream trip','notebook-pen',()=>{navigateSafely('letsPlan',{updateHistory:true});getRouteComponentById('letsPlan')?.querySelector('.dream-trip-workspace')?.scrollIntoView({behavior:'smooth'});}));section.append(actions);host.querySelector('#destinationDiscoveryForm')?.after(section);
}
