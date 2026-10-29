import {discoverDestination} from './destination-discovery.js';
import {summarizePublicGuides} from './_gemini-public-guides.js';

export async function freePlanner(body){
  const candidate=String(body.query||body.answers?.destination||'').trim();
  const base={provider:'free_guides',generated:false,live:false,sourceLabel:'Free destination guides (not AI)',citations:[]};
  // Do not send serialized private trip details or documents to a public search service.
  if(!/^[\p{L}\p{N} .,'()\-]{2,120}$/u.test(candidate))return {...base,text:'Choose a city and country in Find travel for free excursion, restaurant, and destination guides. Your guided trip planner remains available without AI credits. No generative AI provider is connected in free mode.'};
  const data=await discoverDestination(candidate);
  const items=[...(data.about||[]).slice(0,1),...(data.excursions||[]).slice(0,3),...(data.restaurants||[]).slice(0,2)];
  const fallback={...base,text:[`Destination: ${data.destination}`,...items.map(item=>`${item.title}: ${item.description}`),'Reference guides, not AI-generated advice or live prices. Confirm hours, reservations, and availability before booking.'].join('\n\n'),citations:items.map(item=>({title:item.title,url:item.sourceUrl}))};
  return summarizePublicGuides(items,fallback);
}
