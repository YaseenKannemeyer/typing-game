/* Original vector trophy collection. Presentation only; awards come from the server. */
(function(global){
'use strict';
const catalog=[
['gold-champion','Gold Champion','Podium','Official first-place finisher.','1st place','crown'],
['silver-runner-up','Silver Runner-Up','Podium','Official second-place finisher.','2nd place','two'],
['bronze-racer','Bronze Racer','Podium','Official third-place finisher.','3rd place','three'],
['speed-demon','Speed Demon','Speed','Highest average WPM across the passage.','112.4 average WPM','flame'],
['fastest-fingers','Fastest Fingers','Speed','Highest peak WPM in a rolling 5-second window.','148.2 peak WPM','keys'],
['speed-over-power','Speed Over Power','Speed','Highest average WPM with accuracy ≥80% and <90%.','109.8 WPM · 86.2% accuracy','bolt'],
['quick-starter','Quick Starter','Speed','Highest WPM over the first 20% of passage progress.','126.0 WPM · first 20%','launch'],
['perfectionist','Perfectionist','Accuracy','Finish with 100% accuracy and zero incorrect attempts.','100% accuracy · 0 mistakes','diamond'],
['sharp-shooter','Sharp Shooter','Accuracy','Highest accuracy among finishers with at least one mistake.','99.1% accuracy · 3 mistakes','target'],
['clean-run','Clean Run','Accuracy','Finish without incorrect characters, backspace or delete.','0 mistakes · 0 deletions','check'],
['steady-hands','Steady Hands','Accuracy','Lowest standard deviation of accuracy over all ten passage sections.','0.42 percentage-point deviation','hand'],
['oops-factory','Oops Factory','Funny','Most incorrect character attempts among finishers.','42 incorrect attempts','factory'],
['keyboard-chaos','Keyboard Chaos','Funny','Highest mistakes per 100 attempts; at least 100 attempts.','18.5 mistakes / 100 attempts','chaos'],
['slow-and-steady','Slow and Steady','Funny','Lowest average WPM among finishers.','28.6 average WPM','turtle'],
['last-but-persistent','Last but Persistent','Funny','Last finisher; at least two players must finish.','15th of 15 finishers','flag'],
['comeback-kid','Comeback Kid','Special','Largest positive rank gain from first reaching 20% to final rank.','+7 positions · 12th → 5th','return'],
['consistency','Consistency King/Queen','Special','Lowest coefficient of variation in 10-second WPM windows; ≥3 valid samples and positive mean.','4.8% WPM variation','wave'],
['unstoppable','Unstoppable','Special','Complete three consecutive races in one lobby; repeat after another three.','3 consecutive completions','chain'],
['code-warrior','Code Warrior','Special','Highest Coding Mode score: average WPM × accuracy / 100.','96.4 score · Coding Mode','code'],
['participation','Participation Trophy','Special','Complete the passage and receive no other race trophy.','Passage completed','star']
].map(([id,name,category,criteria,example,symbol])=>({id,name,category,criteria,example,symbol,scope:id==='unstoppable'?'Progression achievement':'Race trophy'}));
const palettes={Podium:['#ffce65','#ab6a25','#fff0b2'],Speed:['#ff8b57','#ae4535','#ffd4a3'],Accuracy:['#70e3c6','#248479','#cefff0'],Funny:['#c19bff','#7855ae','#ebdcff'],Special:['#88bbff','#4269ad','#dfedff']};
const path=(d,fill='none',extra='')=>`<path d="${d}" fill="${fill}" ${extra}/>`;
const star=path('M100 62 L107 77 L124 79 L112 91 L115 108 L100 100 L85 108 L88 91 L76 79 L93 77Z','currentColor');
const icons={
crown:path('M74 78 L84 85 L100 67 L116 85 L126 78 L121 103 H79Z','currentColor')+'<path d="M83 95 H117" stroke="#172c30" stroke-width="3"/>',
two:path('M84 77 C84 61 117 61 117 78 C117 88 86 96 84 106 H119','none','stroke="currentColor" stroke-width="9"'),
three:path('M84 70 Q118 59 116 79 Q114 87 99 87 Q124 87 116 103 Q105 116 83 105','none','stroke="currentColor" stroke-width="9"'),
flame:path('M103 59 C116 80 90 78 113 92 L119 77 C140 109 107 123 86 109 C65 93 92 76 90 67 L96 81Z','currentColor')+path('M102 91 Q88 108 103 110 Q115 107 102 91','#172c30'),
keys:'<g fill="currentColor" stroke="none"><rect x="74" y="86" width="15" height="19" rx="3"/><rect x="93" y="80" width="15" height="25" rx="3"/><rect x="112" y="72" width="15" height="33" rx="3"/></g>'+path('M75 76 L87 64 M94 69 L100 59 M114 62 L118 53','none','stroke="currentColor" stroke-width="4"'),
bolt:path('M105 58 L76 92 H96 L90 117 L124 79 H104Z','currentColor'),
launch:path('M80 106 L92 75 Q110 61 127 61 Q124 80 110 92Z','currentColor')+path('M81 96 L71 101 L82 81 L94 76 M91 106 L90 116 L110 99 L111 88','currentColor')+'<circle cx="111" cy="76" r="5" fill="#172c30"/>'+path('M75 112 L68 119 M82 116 L77 122','none','stroke="currentColor" stroke-width="3"'),
diamond:path('M83 67 H117 L131 83 L100 112 L69 83Z','currentColor')+path('M70 83 H130 M84 68 L90 83 L100 110 L110 83 L116 68','none','stroke="#172c30" stroke-width="3"'),
target:'<g fill="none" stroke="currentColor" stroke-width="5"><circle cx="97" cy="90" r="24"/><circle cx="97" cy="90" r="12"/><path d="M97 90 L126 61 M117 62 H126 V71"/></g>',
check:path('M100 59 L126 70 V89 Q125 108 100 118 Q75 108 74 89 V70Z','currentColor')+path('M86 88 L96 99 L115 78','none','stroke="#172c30" stroke-width="6"'),
hand:path('M81 95 V79 Q81 74 86 77 L91 89 V64 Q95 58 99 64 V82 V59 Q103 54 107 60 V82 V65 Q112 59 116 67 V86 V75 Q121 71 124 77 V99 Q122 117 106 119 H96 Q84 111 76 101 Q74 92 81 95Z','currentColor')+path('M90 104 H115','none','stroke="#172c30" stroke-width="3"'),
factory:path('M74 111 V83 L88 92 V80 L104 90 V70 H116 V111Z','currentColor')+'<g fill="#172c30"><rect x="81" y="99" width="7" height="7"/><rect x="94" y="99" width="7" height="7"/><rect x="107" y="99" width="5" height="7"/></g><circle cx="110" cy="59" r="5" fill="currentColor"/><circle cx="122" cy="50" r="7" fill="currentColor"/>',
chaos:'<g fill="currentColor"><rect x="74" y="85" width="18" height="18" rx="3" transform="rotate(-15 83 94)"/><rect x="105" y="92" width="18" height="18" rx="3" transform="rotate(14 114 101)"/><rect x="96" y="65" width="18" height="18" rx="3" transform="rotate(25 105 74)"/></g>'+path('M73 67 L80 74 M124 77 L132 72 M93 111 L92 119','none','stroke="currentColor" stroke-width="4"'),
turtle:path('M74 98 Q74 69 98 72 Q120 72 121 98Z','currentColor')+'<circle cx="129" cy="91" r="9" fill="currentColor"/>'+path('M79 99 L75 109 M111 99 L116 109 M70 94 L65 90','none','stroke="currentColor" stroke-width="6"')+path('M98 74 V96 M79 82 L98 88 L115 82','none','stroke="#172c30" stroke-width="3"'),
flag:path('M79 116 V65 M80 65 Q96 57 108 68 Q120 75 128 66 V91 Q116 100 105 89 Q94 80 80 90','none','stroke="currentColor" stroke-width="5"')+path('M85 70 H95 V80 H85Z M107 73 H117 V84 H107Z','currentColor'),
return:path('M75 105 Q60 78 84 72 Q99 70 103 91 Q111 113 124 86 V68 M112 79 L124 65 L136 79','none','stroke="currentColor" stroke-width="7"'),
wave:path('M71 93 Q80 74 90 93 Q100 112 110 93 Q120 74 130 93','none','stroke="currentColor" stroke-width="6"')+path('M84 69 L80 58 L91 63 L100 51 L109 63 L120 58 L116 69Z','currentColor'),
chain:'<g fill="none" stroke="currentColor" stroke-width="7"><rect x="70" y="83" width="28" height="20" rx="10" transform="rotate(-35 84 93)"/><rect x="86" y="73" width="28" height="20" rx="10" transform="rotate(-35 100 83)"/><rect x="102" y="63" width="28" height="20" rx="10" transform="rotate(-35 116 73)"/></g>',
code:path('M85 76 L72 90 L85 104 M115 76 L128 90 L115 104 M106 68 L95 111','none','stroke="currentColor" stroke-width="6"'),star};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function renderTrophy(id,{size=160,state='earned',label}={}){const t=catalog.find(t=>t.id===id);if(!t)throw new Error('Unknown trophy: '+id);let [main,dark,light]=palettes[t.category];if(id==='silver-runner-up')[main,dark,light]=['#c9dfeb','#6d889d','#effaff'];if(id==='bronze-racer')[main,dark,light]=['#dc9d71','#805137','#ffe0bd'];if(state==='locked')[main,dark,light]=['#748782','#465955','#bccbc5'];const isPod=t.category==='Podium';const shell=isPod?path('M58 49 H35 V74 Q36 98 67 100 M142 49 H165 V74 Q164 98 133 100','none',`stroke="${main}" stroke-width="10"`)+path('M55 40 H145 L139 89 Q135 114 110 122 V143 H124 L130 153 H70 L76 143 H90 V122 Q65 114 61 89Z',main):t.category==='Speed'?path('M62 53 L31 57 L47 77 L27 81 L51 100 L67 99 M138 53 L169 57 L153 77 L173 81 L149 100 L133 99',main)+path('M100 34 L144 56 L140 110 L100 142 L60 110 L56 56Z',main):t.category==='Accuracy'?path('M100 31 L145 48 V91 Q145 122 100 144 Q55 122 55 91 V48Z',main):t.category==='Funny'?path('M67 116 L58 151 L81 144 L94 157 L103 119 M133 116 L142 151 L119 144 L106 157 L97 119',dark)+'<circle cx="100" cy="86" r="54" fill="'+main+'"/>':path('M100 28 L114 42 L135 41 L140 62 L157 75 L147 95 L151 116 L129 124 L117 143 L97 136 L77 145 L65 127 L43 118 L48 97 L39 78 L57 64 L62 43 L83 43Z',main);
const face=t.category==='Accuracy'?path('M100 43 L133 57 V90 Q133 114 100 130 Q67 114 67 90 V57Z',dark):'<circle cx="100" cy="87" r="43" fill="'+dark+'"/>';
return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${Math.max(24,Math.min(1024,Number(size)||160))}" height="${Math.max(24,Math.min(1024,Number(size)||160))}" role="img" aria-label="${esc(label||t.name)}" class="trophy-art ${state==='reveal'?'reveal':''}"><title>${esc(label||t.name)}</title><g stroke="#172c30" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${shell}${face}<g color="${light}" stroke="none">${icons[t.symbol]}</g>${isPod?'':path('M84 140 H116 V153 H84Z',dark)}<rect x="61" y="153" width="78" height="13" rx="4" fill="${main}"/><path d="M55 167 H145 L153 184 H47Z" fill="#273d3b"/><path d="M57 170 H143" stroke="${dark}"/><rect x="79" y="173" width="42" height="5" rx="2" fill="${main}"/><path d="M47 38 L47 26 M41 32 H53 M153 122 V114 M149 118 H157" stroke="${light}" stroke-width="2"/></g></svg>`;}
function mountAward(container,award){const t=catalog.find(t=>t.id===award.trophyId);if(!t)throw new Error('Unknown trophy');container.replaceChildren();const card=document.createElement('article');card.className='award-card';const icon=document.createElement('div');icon.innerHTML=renderTrophy(t.id,{state:'reveal'});card.append(icon);for(const [tag,text] of [['small',t.scope],['h3',t.name],['strong',award.recipient],['p',award.statistic]]){const el=document.createElement(tag);el.textContent=text;card.append(el)}container.append(card);return card;}
global.TrophyKit={catalog,renderTrophy,mountAward};
})(typeof window==='undefined'?globalThis:window);
