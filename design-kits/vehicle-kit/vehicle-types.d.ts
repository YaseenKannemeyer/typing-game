export type Model = 'classic'|'formula'|'muscle'|'supercar'|'hypercar'|'drift'|'rally'|'monster'|'pickup'|'kart'|'vintage'|'cyber'|'police'|'taxi'|'rocket';
export type AnimationState = 'idle'|'start'|'driving'|'acceleration'|'mistake'|'overtake'|'finish'|'winner';
export interface VehicleProps { model: Model; primary: string; accent: string; wheels: 'sport'|'aero'|'retro'; stripes: boolean; number: number; effect: 'none'|'smoke'|'trails'|'neon'; playerName: string; position: number; progress: number; animation: AnimationState; }
export declare class VehicleView { constructor(element: HTMLElement, props?: Partial<VehicleProps>); props: VehicleProps; update(patch: Partial<VehicleProps>): void; play(state: AnimationState): void; destroy(): void; }
export declare class RaceVehicle { constructor(lane: HTMLElement, props: Partial<VehicleProps>); view: VehicleView; update(props: Partial<VehicleProps>): void; destroy(): void; }
