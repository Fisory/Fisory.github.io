import { LOCATIONS, PLACE, FACTIONS, PLAYER_ID } from './config.js';
const NS = 'http://www.w3.org/2000/svg';
const element = (tag, attributes = {}, text = '') => { const node = document.createElementNS(NS, tag); for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value); if (text) node.textContent = text; return node; };
const symbols = `<defs>
 <linearGradient id="world-land" x2="0.8" y2="1"><stop stop-color="#e6ead8"/><stop offset="1" stop-color="#cfdbc7"/></linearGradient>
 <radialGradient id="world-sea"><stop stop-color="#eef1eb"/><stop offset="1" stop-color="#e3eaf0"/></radialGradient>
 <radialGradient id="world-aura"><stop stop-color="#bd99ee" stop-opacity=".7"/><stop offset="1" stop-color="#af94d8" stop-opacity="0"/></radialGradient>
 <filter id="world-shadow" x="-20%" y="-30%" width="140%" height="170%"><feDropShadow dx="0" dy="12" stdDeviation="12" flood-color="#55746b" flood-opacity=".15"/></filter>
 <symbol id="world-tree" viewBox="0 0 36 50"><path d="M18 4 3 25h7L1 38h34l-9-13h7Z" fill="#83a290"/><path d="M18 7 18 38H34L24 25h7Z" fill="#759385"/><path d="M18 35v12" stroke="#718579" stroke-width="3"/></symbol>
 <symbol id="world-mountain" viewBox="0 0 80 80"><path d="m0 71 40-65 40 65Z" fill="#acb3b3"/><path d="m40 6 40 65H39Z" fill="#939eaa"/><path d="m40 6-14 23 14-7 13 7Z" fill="#f8faf7"/></symbol>
 <symbol id="world-house" viewBox="0 0 48 48"><path d="M9 22h30v22H9Z" fill="#e6d9bc"/><path d="m4 23 20-17 20 17Z" fill="#a494aa"/><path d="M21 32h9v12h-9Z" fill="#ac9d91"/><path d="M12 28h6v7h-6Z" fill="#f7eddb"/></symbol>
 <symbol id="world-person" viewBox="0 0 40 40"><path d="M8 35c1-12 5-23 12-29 7 6 11 17 12 29Z" fill="currentColor"/><path d="m13 20 7-8 7 8-7 7Z" fill="#242a39"/><circle cx="20" cy="23" r="3" fill="#ddd5ef"/><path d="m12 35 8-8 8 8" fill="none" stroke="#fff" stroke-opacity=".3"/></symbol>
</defs>`;

export function mountMap(container, onPlace, onActor) {
  const svg = element('svg', { viewBox: '0 0 1000 650', role: 'img', 'aria-label': '中立城、集市、森林、湿地、矿山、高塔与遗迹的互动地图', class: 'world-map' });
  // All markup below is fixed artwork. User text is inserted only with textContent.
  svg.innerHTML = symbols + `<rect width="1000" height="650" fill="url(#world-sea)"/>
   <g opacity=".45" fill="none" stroke="#b3c7cc" stroke-width="2"><path d="M30 580q80-25 145 0m600 10q75-25 160 0M70 100q55-18 100 0m610-50q70-20 135 0"/><path d="M90 595q50-12 100 0m580 20q65-18 130 0"/></g>
   <path d="M116 363Q50 271 147 153T390 78Q454 19 560 77T796 64Q950 72 909 233T944 411Q974 502 835 537T650 593Q543 660 448 559T250 558Q105 581 93 475Z" fill="url(#world-land)" stroke="#c3cfbf" stroke-width="3" filter="url(#world-shadow)"/>
   <path d="M151 193Q265 95 384 158T410 295Q278 329 172 274Z" fill="#abc4ac" opacity=".48"/>
   <path d="M650 91Q820 55 862 185T771 250Q713 195 650 91Z" fill="#c8c4ce" opacity=".46"/>
   <path d="M718 379Q820 317 904 410L824 517 703 489Z" fill="#c5c7c5" opacity=".65"/>
   <path d="M149 414Q224 372 294 435T242 540L118 488Z" fill="#9fbdaf" opacity=".47"/>
   <path d="M460 111Q423 199 457 259T435 385Q450 459 370 535" fill="none" stroke="#bad3d2" stroke-width="22" stroke-linecap="round"/><path d="M462 111Q425 199 459 259T437 385Q452 459 372 535" fill="none" stroke="#d9e8e2" stroke-width="5"/>
   <g stroke="#f2f0e3" stroke-width="12" fill="none" stroke-linecap="round"><path d="M510 325 340 380 180 480M340 380 260 170 510 325 180 480M510 325 675 305 780 125 260 170M675 305 810 455"/></g>
   <g stroke="#bdb5a4" stroke-width="2.5" stroke-dasharray="4 9" fill="none" stroke-linecap="round"><path d="M510 325 340 380 180 480M340 380 260 170 510 325 180 480M510 325 675 305 780 125 260 170M675 305 810 455"/></g>
   <g opacity=".8"><ellipse cx="176" cy="465" rx="34" ry="10" fill="#99b6b3"/><ellipse cx="230" cy="510" rx="22" ry="7" fill="#99b6b3"/><ellipse cx="133" cy="435" rx="26" ry="9" fill="#99b6b3"/></g>
   <g fill="none" stroke="#789485" stroke-width="3"><path d="m140 490 3-19 6 11m38 35 2-23 7 11m56-48 4-18 6 8"/></g>
   <g fill="#c5bfce" stroke="#a69ab2" stroke-width="2"><path d="M749 152v-58h13v58m34-2v-65h13v65m-47-47h34v12h-34"/><path d="m735 154 40-6 51 10-44 15Z" fill="#ded9df"/></g>
   <g><path d="M665 314v-66h21v66Z" fill="#e3e0d4" stroke="#a8a4b0" stroke-width="2"/><path d="m655 248 20-34 21 34Z" fill="#8d7ba9"/><path d="M671 273h8v17h-8Z" fill="#b8a2d8"/></g>
   <g><circle cx="510" cy="320" r="68" fill="url(#world-aura)" class="world-core-aura"/><ellipse cx="510" cy="329" rx="48" ry="26" fill="#c6c2bb"/><path d="M470 329v-38h15v38m51 0v-38h15v38" fill="#e9e7db" stroke="#a5a1ab" stroke-width="2"/><path d="m467 291 11-17 10 17m47 0 9-17 11 17" fill="#8a7da1"/><path d="M490 324v-29h40v29" fill="#e8e2d4" stroke="#ada5b6" stroke-width="2"/><path d="m490 295 20-21 20 21Z" fill="#9c89bc"/><path d="m510 261-12 16 12 16 12-16Z" fill="#ab86dc" stroke="#dfc7ff" stroke-width="3" class="world-core-gem"/><path d="M490 339q20 11 40 0" fill="none" stroke="#b9a6d1" stroke-width="3"/></g>
   <g fill="#809392" font-family="Georgia,serif"><text x="930" y="60" text-anchor="middle" font-size="18">N</text><path d="m930 70-9 26 9-7 9 7Z" fill="#8c969b"/><text x="50" y="610" font-size="17" letter-spacing="3">THE COMMON REALM</text></g>`;
  const decorations = element('g');
  for (const [x, y, size] of [[173,192,42],[207,140,46],[235,201,50],[287,131,46],[332,167,50],[359,228,42],[176,244,46],[313,243,40],[390,160,37],[600,487,43],[643,520,40]]) decorations.append(element('use',{href:'#world-tree',x,y,width:size,height:size*1.4}));
  for (const [x,y,size] of [[736,397,90],[793,365,96],[835,431,82],[723,459,75]]) decorations.append(element('use',{href:'#world-mountain',x,y,width:size,height:size}));
  for (const [x,y] of [[305,359],[342,351],[364,393],[454,367],[528,366],[492,386],[642,343]]) decorations.append(element('use',{href:'#world-house',x,y,width:34,height:34}));
  svg.append(decorations);
  const places = element('g');
  for (const place of LOCATIONS) {
    const group = element('g', { class: 'world-place-marker', role: 'button', tabindex: '0', 'aria-label': `查看${place.name}`, 'data-place': place.id });
    group.append(element('rect',{x:place.x-76,y:place.y-62,width:152,height:33,rx:16,fill:'#faf9f1',opacity:'.9'}), element('text',{x:place.x,y:place.y-40,'text-anchor':'middle',fill:'#50605b','font-size':'22','font-weight':'500'},place.name));
    group.addEventListener('click',()=>onPlace(place.id)); group.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();onPlace(place.id);}}); places.append(group);
  }
  svg.append(places); const residents = element('g',{'data-residents':''}); svg.append(residents); container.replaceChildren(svg);
  return (state, selectedId) => {
    residents.replaceChildren(); const counts={};
    for(const actor of state.actors){
      const place=PLACE[actor.location],index=counts[place.id]||0;counts[place.id]=index+1;
      const x=place.x+(index%3-1)*42,y=place.y+42+Math.floor(index/3)*48,color=FACTIONS[actor.faction].color;
      const group=element('g',{role:'button',tabindex:'0','aria-label':`查看居民${actor.name}`,class:`world-resident-marker${selectedId===actor.id?' selected':''}`,transform:`translate(${x},${y})`});
      group.append(element('circle',{r:20,fill:'#faf8f4',stroke:selectedId===actor.id?'#8e70b5':color,'stroke-width':selectedId===actor.id?3:1.5}),element('use',{href:'#world-person',x:-17,y:-19,width:34,height:34,color}));
      if(actor.hiddenUntil>state.tick)group.append(element('circle',{r:25,fill:'none',stroke:'#9d80c4','stroke-dasharray':'3 4','stroke-width':1.5}));
      group.append(element('text',{x:0,y:34,'text-anchor':'middle','font-size':17,fill:'#45564e'},actor.id===PLAYER_ID?'你':[...actor.name].slice(0,2).join('')));
      group.addEventListener('click',()=>onActor(actor.id));group.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();onActor(actor.id);}}); residents.append(group);
    }
  };
}
