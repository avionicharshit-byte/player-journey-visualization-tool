export interface PlayerEvent {
  user_id: string;
  match_id: string;
  map_id: MapId;
  x: number;
  y: number;
  z: number;
  ts: number;
  event: EventType;
}

export type MapId = 'AmbroseValley' | 'GrandRift' | 'Lockdown';

export type EventType =
  | 'Position'
  | 'BotPosition'
  | 'Kill'
  | 'Killed'
  | 'BotKill'
  | 'BotKilled'
  | 'KilledByStorm'
  | 'Loot';

export interface MapConfig {
  scale: number;
  originX: number;
  originZ: number;
  image: string;
}

export interface Filters {
  map: MapId | 'all';
  date: string | 'all';
  matchId: string | 'all';
  showHumans: boolean;
  showBots: boolean;
  showKills: boolean;
  showDeaths: boolean;
  showLoot: boolean;
  showStormDeaths: boolean;
}

export interface HeatmapMode {
  type: 'none' | 'kills' | 'deaths' | 'traffic';
}

export interface MatchInfo {
  matchId: string;
  mapId: MapId;
  date: string;
  playerCount: number;
  botCount: number;
}
