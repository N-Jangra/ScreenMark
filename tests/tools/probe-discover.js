const vm=require('vm'),fs=require('fs');const root=process.env.ROOT+'/frontend/';const window={};
const ctx=vm.createContext({window,location:{protocol:'https:',hostname:'p.test',href:'https://p.test/'},fetch,URL,URLSearchParams,Headers,Response,Blob,TextDecoder,AbortController,Promise,Map,Set,Object,Array,String,Number,Math,Date,RegExp,Error,JSON,encodeURIComponent,decodeURIComponent,setTimeout,clearTimeout,console,localStorage:{getItem:()=>null,setItem(){}}});
for(const f of ['metadata.js','sources.js','discover.js'])vm.runInContext(fs.readFileSync(root+'backend/features/'+f,'utf8'),ctx);
const settings={metadataSources:Object.fromEntries(window.SplitAppMetadata.providers.map(p=>[p.key,true])),apiKeys:{omdb:process.env.OMDB,tmdb:process.env.TMDB,tvdb:process.env.TVDB},sourceOptions:{},noCache:true};
const D=window.SplitAppDiscovery;
(async()=>{
 for(const src of ['tvmaze','tmdb','tvdb','imdb','omdb','rottentomatoes','anilist','kitsu','jikan'])for(const cat of ['series','movie']){
  const prov=window.SplitAppMetadata.providers.find(p=>p.key===src); if(!prov.categories.includes(cat))continue;
  try{const secs=await D.trending(cat,settings,src);const n=secs.map(s=>s.title+':'+s.items.length+(s.items.filter(i=>!i.image).length?'(noimg '+s.items.filter(i=>!i.image).length+')':'')).join(' | ');console.log(src,cat,'->',n||'NO SECTIONS')}catch(e){console.log(src,cat,'-> ERROR',String(e.message).slice(0,90))}
 }
 const queries=[['series','the office','The Office'],['movie','dune','Dune'],['series','one piece','One Piece'],['movie','spirited away','Spirited Away'],['series','stranger things','Stranger Things']];
 for(const [cat,q,want] of queries)for(const src of ['tvmaze','tmdb','tvdb','imdb','omdb','rottentomatoes','anilist','kitsu']){
  const prov=window.SplitAppMetadata.providers.find(p=>p.key===src); if(!prov.categories.includes(cat))continue;
  try{const rows=await D.searchSource(q,cat,settings,src);const top=rows[0];console.log('SEARCH',src,cat,q,'->',rows.length,top?`${top.title} (${top.year||'?'}) img=${!!top.image}`:'none', top&&!String(top.title).toLowerCase().includes(want.toLowerCase())?'  !!MISMATCH':'')}catch(e){console.log('SEARCH',src,cat,q,'-> ERROR',String(e.message).slice(0,80))}
 }
})();
