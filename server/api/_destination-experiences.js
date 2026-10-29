export function guideMatchesDestination(destination,guide) {
  const normalize=value=>String(value||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase();
  const parts=String(destination).split(',').map(value=>value.trim()).filter(Boolean),text=normalize(`${guide.title} ${guide.description}`);
  if(!text.includes(normalize(parts[0])))return false;
  if(parts.length<2)return true;
  let regions=parts.slice(1);if(parts.length>2&&normalize(parts.at(-1))==='united states')regions=[parts[1]];
  if(regions.some(region=>normalize(region)==='united kingdom'))regions.push('England','Scotland','Wales','Northern Ireland');
  return regions.some(region=>text.includes(normalize(region)));
}

export function destinationExcursions(destination, guides) {
  const seen=new Set(),groups=new Map();
  for(const guide of guides){
    const title=String(guide.title||''),text=String(guide.description||'');
    if(!title||!text||seen.has(title.toLowerCase())||/^(lists? of|tourism in|tourist attractions)|disambiguation/i.test(title))continue;
    if(!guideMatchesDestination(destination,guide))continue;
    const intro=[...new Intl.Segmenter('en',{granularity:'sentence'}).segment(text)].slice(0,2).map(part=>part.segment).join(' ');
    if(/\b(ride|rides|simulator)\b/i.test(intro))continue;
    let category;
    if(/\b(museum|temple|shrine|palace|castle|cathedral|monument)\b/i.test(title))category='Culture & history';
    else if(/\b(garden|gardens|park|beach|waterfall|island|zoo|aquarium)\b/i.test(title))category='Nature & outdoors';
    else if(/\b(neighborhood|neighbourhood|district|market|quarter)\b/i.test(intro))category='Neighborhoods';
    else if(/\b(museum|temple|shrine|palace|castle|cathedral|archaeological|monument)\b/i.test(intro))category='Culture & history';
    else if(/\b(garden|park|beach|waterfall|island|nature reserve|zoo|aquarium)\b/i.test(intro))category='Nature & outdoors';
    else if(/\b(tower|landmark|observation)\b/i.test(intro))category='Landmarks';
    if(!category)continue;
    seen.add(title.toLowerCase());if(!groups.has(category))groups.set(category,[]);
    groups.get(category).push({...guide,category,kind:'excursion_idea'});
  }
  // Interleave categories so the first choices are not all the same experience.
  const result=[];while(result.length<6&&[...groups.values()].some(items=>items.length)){for(const items of groups.values()){if(items.length)result.push(items.shift());if(result.length===6)break;}}
  return result;
}

export function destinationFacts(about, excursions) {
  const facts=[],seen=new Set();const segmenter=new Intl.Segmenter('en',{granularity:'sentence'});
  const interesting=/\b(oldest|largest|first|founded|built|opened|known|historic|heritage|century|famous|capital|nickname|world|home to)\b/i;
  for(const guide of [...about.slice(0,1),...excursions]){
    const sentences=[...segmenter.segment(String(guide.description||''))].map(part=>part.segment.trim()).filter(text=>text.length>=40&&text.length<=500);
    const text=sentences.find(sentence=>interesting.test(sentence))||sentences[0];
    if(!text||seen.has(text))continue;seen.add(text);facts.push({text,sourceTitle:guide.title,sourceUrl:guide.sourceUrl});if(facts.length===3)break;
  }
  return facts;
}

export function destinationRestaurants(destination, guides) {
  const seen = new Set();
  return guides.filter(guide => {
    const title = String(guide.title || ''), text = String(guide.description || '');
    const intro = [...new Intl.Segmenter('en', {granularity:'sentence'}).segment(text)].slice(0,2).map(part=>part.segment).join(' ');
    if (!title || seen.has(title.toLowerCase()) || /^(lists? of|cuisine|tourism)|disambiguation|\b(attack|bombing|shooting|massacre|murder)\b/i.test(title)) return false;
    if (!guideMatchesDestination(destination, guide) || !/\b(restaurant|bistro|café|cafe|steakhouse|pizzeria)\b/i.test(intro)) return false;
    if (/\b(chain|closed|defunct|former restaurant|was a restaurant)\b/i.test(intro)) return false;
    seen.add(title.toLowerCase()); return true;
  }).slice(0,4).map(guide=>({...guide,category:'Restaurants',kind:'restaurant_idea'}));
}
