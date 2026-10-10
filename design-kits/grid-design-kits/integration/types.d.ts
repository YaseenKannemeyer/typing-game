/** Reference interfaces for porting GridKit into the host's shared types.
 * These describe design inputs, not authenticated game-state validation.
 */
export type ModeId = 'easy' | 'medium' | 'hard' | 'coding' | 'shakespeare' | 'random';
export type SceneId = 'city' | 'desert' | 'neon' | 'theatre' | 'circuit';
export type VehicleId = 'classic'|'formula'|'muscle'|'supercar'|'hypercar'|'drift'|'rally'|'monster'|'pickup'|'kart'|'vintage'|'cyber'|'police'|'taxi'|'rocket';
export type VehicleAnimation = 'idle'|'start'|'driving'|'acceleration'|'mistake'|'overtake'|'finish'|'winner';
export interface VehicleAppearance { model: VehicleId; primary: string; accent: string; wheels?: 'sport'|'aero'|'retro'; stripes?: boolean; number?: number; effect?: 'none'|'smoke'|'trails'|'neon'; }
export interface RacerView { id: string; name: string; vehicle: VehicleAppearance; position: number; progress: number; wpm: number|null; accuracy?: number|null; mistakes?: number|null; time?: string|null; status?: 'finished'|'dnf'|'flagged'; you?: boolean; host?: boolean; ready?: boolean; online?: boolean; }
export interface AwardView { trophyId: string; recipient: string; statistic: string; }
export interface HudView { position?:number; total?:number; wpm?:number; accuracy?:number; mistakes?:number; elapsed?:string; progress?:number; }
export interface TypingView { mode?:'standard'|'coding'|'shakespeare'; passage?:string; index?:number; error?:boolean; state?:'ready'|'waiting'|'error'|'finished'; }
export type Cleanup = () => void;
export interface GridKitAPI {
  playerCard(player:RacerView):string;
  roomCode(code:string):string;
  lobby(props:{players:RacerView[];code?:string;host?:boolean}):string;
  environment(scene?:SceneId):string;
  track(props:{racers:RacerView[];localId:string;scene?:SceneId}):string;
  visibleRacers(ranked:RacerView[],localId:string):RacerView[];
  updateTrack(root:HTMLElement,updates:RacerView[]):void;
  hud(props?:HudView):string;
  minimap(racers:RacerView[],localId:string):string;
  typingPanel(props?:TypingView):string;
  podium(players:RacerView[]):string;
  resultRows(players:RacerView[]):string;
  awardCard(award:AwardView):string;
  countdown(element:HTMLElement,options:{deadline:number;now?:()=>number;onGo?:()=>void}):Cleanup;
  watchDeadline(deadline:number,onTick:(remainingSeconds:number)=>void,now?:()=>number):Cleanup;
  captureLanes(root:HTMLElement):Map<string,number>;
  animateLanes(root:HTMLElement,before:Map<string,number>):Cleanup;
  confetti(container:HTMLElement):Cleanup;
}
