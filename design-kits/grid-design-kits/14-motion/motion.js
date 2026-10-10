(function(g){const G=g.GridKit;G.motion={laneSwap:260,progressInterpolation:180,awardReveal:650,ease:'cubic-bezier(.2,.7,.3,1)'};
// Capture before keyed DOM reordering, then call animateLanes after rendering.
G.captureLanes=root=>new Map([...root.querySelectorAll('[data-player-id]')].map(el=>[el.dataset.playerId,el.getBoundingClientRect().top]));
G.animateLanes=(root,before)=>{if(matchMedia('(prefers-reduced-motion: reduce)').matches)return()=>{};const animations=[];for(const el of root.querySelectorAll('[data-player-id]')){const old=before.get(el.dataset.playerId);if(old==null)continue;const delta=old-el.getBoundingClientRect().top;if(delta)animations.push(el.animate([{transform:`translateY(${delta}px)`},{transform:'translateY(0)'}],{duration:G.motion.laneSwap,easing:G.motion.ease}));}return()=>animations.forEach(a=>a.cancel())};
})(globalThis);
