(function(g){const G=g.GridKit;const note=(start,duration,frequency,gain=.35,endFrequency=frequency,wave='sine')=>({start,duration,frequency,gain,endFrequency,wave});
G.soundRecipes={
'countdown-beep':{label:'Countdown beep',notes:[note(0,.13,660,.3)]},
'go-horn':{label:'GO signal',notes:[note(0,.34,523,.22,523,'triangle'),note(0,.34,659,.16),note(0,.34,784,.14)]},
'key-click':{label:'Soft key click',notes:[note(0,.025,1100,.10,600,'noise')]},
'mistake':{label:'Gentle mistake cue',notes:[note(0,.13,190,.16,130,'triangle')]},
'overtake':{label:'Overtake whoosh',notes:[note(0,.25,350,.09,1600,'noise'),note(0,.2,280,.10,740)]},
'finish':{label:'Finish chime',notes:[note(0,.22,659,.25),note(.13,.28,784,.22),note(.27,.5,1046,.25)]},
'winner':{label:'Winner fanfare',notes:[note(0,.2,523,.24,523,'triangle'),note(.15,.2,659,.24,659,'triangle'),note(.3,.2,784,.24,784,'triangle'),note(.48,.65,1046,.23),note(.48,.65,659,.14),note(.48,.65,784,.14)]},
'award-reveal':{label:'Trophy reveal',notes:[note(0,.16,880,.17),note(.08,.23,1175,.17),note(.17,.5,1568,.17)]},
'ui-click':{label:'UI click',notes:[note(0,.055,700,.11,920,'triangle')]},
'countdown-final':{label:'Final countdown beep',notes:[note(0,.16,880,.28)]}
};
G.soundSamples=(id,sampleRate=22050)=>{const recipe=G.soundRecipes[id];if(!recipe)throw Error('Unknown sound');const duration=Math.max(...recipe.notes.map(n=>n.start+n.duration))+.05,buffer=new Float32Array(Math.ceil(duration*sampleRate));let seed=123456;for(const n of recipe.notes){const length=Math.floor(n.duration*sampleRate);let phase=0;for(let i=0;i<length;i++){const t=i/length;const envelope=Math.min(1,i/(sampleRate*.006))*Math.pow(1-t,1.6);phase+=2*Math.PI*(n.frequency+(n.endFrequency-n.frequency)*t)/sampleRate;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const sample=n.wave==='noise'?(seed/4294967296*2-1)*Math.sin(phase):n.wave==='triangle'?2/Math.PI*Math.asin(Math.sin(phase)):Math.sin(phase);buffer[Math.floor(n.start*sampleRate)+i]+=sample*n.gain*envelope;}}return buffer};
class SoundPlayer{constructor(){this.muted=true;this.volume=.35;this.voices=new Set;this.lastKey=0;}async unlock(){if(!this.context)this.context=new(window.AudioContext||window.webkitAudioContext)();await this.context.resume();}setMuted(muted){this.muted=!!muted;if(this.muted){for(const v of this.voices){try{v.stop()}catch{}}this.voices.clear()}}setVolume(volume){this.volume=G.clamp(volume)}async play(id){if(this.muted)return;if(id==='key-click'){const now=Date.now();if(now-this.lastKey<45)return;this.lastKey=now}await this.unlock();if(this.muted)return;if(this.voices.size>=4){const v=this.voices.values().next().value;v.stop();this.voices.delete(v)}const samples=G.soundSamples(id,this.context.sampleRate),buffer=this.context.createBuffer(1,samples.length,this.context.sampleRate);buffer.copyToChannel(samples,0);const source=this.context.createBufferSource(),gain=this.context.createGain();gain.gain.value=this.volume;source.buffer=buffer;source.connect(gain).connect(this.context.destination);this.voices.add(source);source.onended=()=>{this.voices.delete(source);source.disconnect();gain.disconnect()};source.start();}destroy(){this.setMuted(true);this.context?.close();}}
G.SoundPlayer=SoundPlayer;
})(globalThis);
