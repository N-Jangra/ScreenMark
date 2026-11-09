// Live probe of every metadata source (search, details, cast, characters, episodes). Keys come from the environment only:
//   ROOT=$PWD OMDB=... TMDB=... TVDB=... PLAN='[["tvmaze","series","breaking bad","Breaking Bad","Cranston",62,"Pilot"]]' [DEEP=1] node tests/tools/probe-sources.js
const vm=require('vm'),fs=require('fs');
const root=process.env.ROOT+'/frontend/';
const window={};
const ctx=vm.createContext({window,location:{protocol:'https:',hostname:'probe.test',href:'https://probe.test/'},fetch,URL,URLSearchParams,Headers,Response,Blob,TextDecoder,AbortController,Promise,Map,Set,Object,Array,String,Number,Math,Date,RegExp,Error,JSON,encodeURIComponent,decodeURIComponent,setTimeout,clearTimeout,console,localStorage:{getItem:()=>null,setItem(){}},DOMParser:undefined});
for(const f of ['backend/features/metadata.js','backend/features/sources.js','backend/features/discover.js','backend/features/show-detail-controller.js','backend/features/show-detail.js'])vm.runInContext(fs.readFileSync(root+f,'utf8'),ctx,{filename:f});
const settings={metadataSources:Object.fromEntries(window.SplitAppMetadata.providers.map(p=>[p.key,true])),apiKeys:{omdb:process.env.OMDB,tmdb:process.env.TMDB,tvdb:process.env.TVDB},sourceOptions:{},offlineFallback:'none',noCache:true};
const D=window.SplitAppDiscovery, DET=window.SplitAppDetails;
const plan=JSON.parse(process.env.PLAN||'[]');
const short=v=>String(v??'').replace(/\s+/g,' ').slice(0,70);
async function probe(source,category,query,wantTitle,expectCast,expectEps,expectEp1){
  const out={source,category,query,issues:[]};
  const t0=Date.now();
  try{
    const rows=await D.searchSource(query,category,settings,source);
    out.results=rows.length; const row=rows.find(r=>String(r.title).toLowerCase().includes(wantTitle.toLowerCase()))||rows[0];
    if(!row){out.issues.push('SEARCH: no results');return out}
    out.picked=`${row.title} (${row.year||'?'}) id=${row.providerId}`;
    if(!String(row.title).toLowerCase().includes(wantTitle.toLowerCase()))out.issues.push(`SEARCH: top result "${row.title}" does not match "${wantTitle}"`);
    if(!row.image)out.issues.push('SEARCH: no image');
    const item={...row,metadataSource:source,category};
    const d=await DET.load(item,settings);
    out.title=d.title;out.year=d.year;out.rating=d.rating;out.descLen=(d.description||'').length;out.image=!!d.image;out.land=!!d.landscapeImage;
    out.sections=d.sections.map(s=>`${s.kind}:${s.title}:${s.items.length}`);
    out.fields=(d.fields||[]).length;out.facts={runtime:d.facts?.runtimeMinutes,eps:d.facts?.episodeCount,genres:(d.facts?.genres||[]).length,epRatings:d.facts?.episodeRatings?.length};
    if(!out.descLen)out.issues.push('OVERVIEW: empty description');
    if(!d.image)out.issues.push('OVERVIEW: no poster');
    if(!(d.rating>0))out.issues.push('RATING: no rating');
    const title=String(d.title||'').toLowerCase(); if(!title.includes(wantTitle.toLowerCase().split(' ')[0]))out.issues.push(`OVERVIEW: loaded title "${d.title}" mismatches "${wantTitle}"`);
    const secs=d.sections;
    if(d.rating>10)out.issues.push('RATING: out of range '+d.rating);
    const castNames=secs.filter(x=>/^(cast|characters)/i.test(x.title)).flatMap(x=>x.items.slice(0,6).map(i=>i.title+' '+(i.meta||'')));
    if(expectCast&&castNames.length&&!castNames.some(n=>n.toLowerCase().includes(expectCast.toLowerCase())))out.issues.push('CAST MISMATCH: expected '+expectCast+' in first entries, got '+castNames.slice(0,4).join(' | '));
    const epSec=secs.find(x=>x.kind==='episodes');
    if(expectEps&&epSec&&Math.abs(epSec.items.length-expectEps)>Math.max(3,expectEps*0.15))out.issues.push('EPISODES: count '+epSec.items.length+' vs expected ~'+expectEps);
    if(expectEp1&&epSec){const e1=epSec.items.find(e=>e.season===1&&e.number===1);if(!e1||!String(e1.title).toLowerCase().includes(expectEp1.toLowerCase()))out.issues.push('EPISODE S1E1 mismatch: '+(e1&&e1.title))}
    const cast=secs.find(s=>/^(cast|characters)/i.test(s.title)&&s.items.length), staff=secs.find(s=>/^(staff|crew)/i.test(s.title)&&s.items.length), shots=secs.find(s=>s.kind==='gallery'&&s.items.length), eps=secs.find(s=>s.kind==='episodes'&&s.items.length), rat=secs.find(s=>s.kind==='ratings'&&s.items.length);
    out.has={cast:!!cast,staff:!!staff,shots:!!shots,eps:!!eps,epRatings:!!rat};
    if(!cast)out.issues.push('CAST: none');
    if(!shots)out.issues.push('MEDIA: no screenshots/posters');
    if(category==='series'&&!eps)out.issues.push('EPISODES: none');
    if(category==='series'&&eps&&!rat)out.issues.push('RATINGS: no episode ratings section');
    if(cast){const first=cast.items[0];out.castSample=cast.items.slice(0,3).map(c=>`${short(c.title)}${c.meta?` [${short(c.meta)}]`:''}`);
      if(!first.ref)out.issues.push('CAST: first cast entry has no ref (no page)');
      else try{const r=await DET.loadRef(first.ref,settings);out.castPage=`${short(r.title)} | facts=${(r.facts||[]).length} sections=${(r.sections||[]).map(s=>s.title+':'+s.items.length).join(',')} img=${!!r.image}`;if(!r.title||/^(unknown|details)$/i.test(r.title))out.issues.push('CAST PAGE: empty title');if(!(r.sections||[]).some(s=>s.items.length)&&!(r.description||'').length)out.issues.push('CAST PAGE: no content')}catch(e){out.issues.push('CAST PAGE: '+short(e.message))}
      const chars=secs.find(s=>/^characters/i.test(s.title)&&s.items.length);const ch=chars?.items.find(c=>c.ref)||cast.items.find(c=>c.ref&&c.ref.type==='character');
      if(ch)try{const r=await DET.loadRef(ch.ref,settings);out.charPage=`${short(r.title)} | sections=${(r.sections||[]).map(s=>s.title+':'+s.items.length).join(',')}`}catch(e){out.issues.push('CHARACTER PAGE: '+short(e.message))}}
    if(eps){const ep=eps.items.find(e=>e.ref)||eps.items[0];out.epSample=`S${ep.season}E${ep.number} ${short(ep.title)}`;
      if(ep.ref)try{const r=await DET.loadRef(ep.ref,settings);out.episodePage=`${short(r.title)} | desc=${(r.description||'').length} facts=${(r.facts||[]).length} sections=${(r.sections||[]).map(s=>s.title+':'+s.items.length).join(',')}`;if(!r.title)out.issues.push('EPISODE PAGE: no title');}catch(e){out.issues.push('EPISODE PAGE: '+short(e.message))}
      else out.issues.push('EPISODE: first episode has no ref')}
    if(process.env.DEEP){
      const refs=[];const pick=(sec,n,label)=>sec.items.filter(i=>i.ref).slice(0,n).forEach(i=>refs.push([label,i.ref,i.title]));
      for(const sec of secs){ if(/^cast/i.test(sec.title))pick(sec,3,'cast'); else if(/^characters/i.test(sec.title))pick(sec,2,'character'); else if(/^staff|^crew/i.test(sec.title))pick(sec,2,'staff'); else if(/^you might/i.test(sec.title)||/^related/i.test(sec.title))pick(sec,1,'related'); else if(sec.kind==='episodes'){const its=sec.items.filter(i=>i.ref);[its[0],its[Math.floor(its.length/2)],its[its.length-1]].filter(Boolean).forEach(i=>refs.push(['episode',i.ref,'S'+i.season+'E'+i.number]));} else if(/^seasons/i.test(sec.title))pick(sec,1,'season'); }
      out.deep=[];
      for(const [label,ref,t] of refs){try{const r=await DET.loadRef(ref,settings);const nitems=(r.sections||[]).reduce((n,x)=>n+x.items.length,0);const bad=!r.title||(label!=='related'&&!nitems&&!(r.description||'').length&&!(r.facts||[]).length);out.deep.push(label+' '+short(t)+' -> '+short(r.title)+' ['+nitems+' items, desc '+(r.description||'').length+']'+(bad?' !!EMPTY':''));if(bad)out.issues.push('DEEP '+label+' "'+short(t)+'": empty page');
        if((label==='cast'||label==='character'||label==='staff')&&r.title&&t&&!String(r.title).toLowerCase().includes(String(t).toLowerCase().split(/[ ,]+/)[0]))out.issues.push('DEEP '+label+' title mismatch: asked "'+short(t)+'" got "'+short(r.title)+'"')}catch(e){out.issues.push('DEEP '+label+' "'+short(t)+'": '+short(e.message))}}
    }
  }catch(e){out.issues.push('FATAL: '+short(e.message)+(e.status?` (${e.status})`:''))}
  out.ms=Date.now()-t0;return out;
}
(async()=>{for(const [s,c,q,w,ec,ee,e1] of plan){const r=await probe(s,c,q,w,ec,ee,e1);console.log(JSON.stringify(r,null,1))}})();
