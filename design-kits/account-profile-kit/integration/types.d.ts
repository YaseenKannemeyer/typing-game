export type AuthView = 'save'|'signup'|'signin'|'reset';
export type PreservationState = 'verify'|'saving'|'saved'|'retry'|'recovery';
export interface GuestSummary {name:string;races:number;wins:number;trophies:number;bestWpm:number;vehicle:Record<string,unknown>}
export interface ProfileView {name:string;handle:string;memberSince:string;bestWpm:number|null;races:number|null;wins:number|null;trophies:number|null;vehicle:Record<string,unknown>}
export interface DailyPoint {date:string;value:number|null}
export interface LeaderRow {id:string;name:string;wpm:number;accuracy:number;date:string;you?:boolean;vehicle:Record<string,unknown>}
export interface ConfirmedAwardEvent {eventId:string;trophyId:string;recipient:string;statistic:string}
export interface AchievementQueue {push(event:ConfirmedAwardEvent):boolean;next():void;destroy():void}
