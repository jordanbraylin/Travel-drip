function photoText(value) {
  // Commons credits contain markup; return text only, never executable HTML.
  return String(value||'').replace(/<[^>]*>/g,' ').replace(/&(amp|quot|apos|lt|gt|nbsp);/g,(_,name)=>({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '})[name]).replace(/\s+/g,' ').trim().slice(0,500);
}
export function allowedPhotoUrl(value) {try{const url=new URL(value);if(url.protocol!=='https:'||!['upload.wikimedia.org','thumb.wikimedia.org'].includes(url.hostname)||/\.svg$/i.test(url.pathname))return null;url.search='';return url.href;}catch{return null;}}
export async function destinationPhotos(items) {
  const ids=items.slice(0,6).map(item=>String(item.id)).filter(id=>/^\d+$/.test(id));if(!ids.length)return items;
  try{
    const signal=AbortSignal.timeout(4500),headers={Accept:'application/json','User-Agent':'Travel-Drip/1.0 (https://travel-drip.com)'};
    const pagesUrl=new URL('https://en.wikipedia.org/w/api.php');pagesUrl.search=new URLSearchParams({action:'query',pageids:ids.join('|'),prop:'pageimages',piprop:'name',pilicense:'free',format:'json'}).toString();
    const pagesResponse=await fetch(pagesUrl,{signal,headers});if(!pagesResponse.ok)return items;
    const pages=Object.values((await pagesResponse.json()).query?.pages||{}),titles=[...new Set(pages.map(page=>page.pageimage?`File:${page.pageimage}`:null).filter(Boolean))];if(!titles.length)return items;
    const commonsUrl=new URL('https://commons.wikimedia.org/w/api.php');commonsUrl.search=new URLSearchParams({action:'query',titles:titles.join('|'),prop:'imageinfo',iiprop:'url|mime|extmetadata',iiurlwidth:'800',iiextmetadatafilter:'Artist|LicenseShortName|LicenseUrl',format:'json'}).toString();
    const commonsResponse=await fetch(commonsUrl,{signal,headers});if(!commonsResponse.ok)return items;
    const photos=new Map();for(const file of Object.values((await commonsResponse.json()).query?.pages||{})){
      const info=file.imageinfo?.[0],meta=info?.extmetadata||{},url=allowedPhotoUrl(info?.thumburl||info?.url),license=photoText(meta.LicenseShortName?.value),artist=photoText(meta.Artist?.value);
      if(!url||!['image/jpeg','image/png','image/webp'].includes(info.mime)||!artist||!/^(CC BY(?:-SA)? [\d.]+|CC0(?: [\d.]+)?|Public domain)$/i.test(license))continue;
      photos.set(file.title.replaceAll('_',' '),{url,artist,license,title:file.title.replace(/^File:/,''),sourceUrl:`https://commons.wikimedia.org/wiki/${encodeURIComponent(file.title)}`,licenseUrl:/^https?:\/\/(creativecommons\.org|www\.creativecommons\.org)\//.test(meta.LicenseUrl?.value||'')?meta.LicenseUrl.value.replace(/^http:/,'https:'):null});
    }
    const pageFiles=new Map(pages.map(page=>[String(page.pageid),`File:${page.pageimage}`.replaceAll('_',' ')]));return items.map(item=>({...item,photo:photos.get(pageFiles.get(String(item.id)))||null}));
  }catch{return items;}
}
