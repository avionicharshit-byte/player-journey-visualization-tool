import type { MapConfig, MapId } from '../types';

export const MAP_CONFIGS: Record<MapId, MapConfig> = {
  AmbroseValley: {
    scale: 900,
    originX: -370,
    originZ: -473,
    image: '/minimaps/AmbroseValley_Minimap.png'
  },
  GrandRift: {
    scale: 581,
    originX: -290,
    originZ: -290,
    image: '/minimaps/GrandRift_Minimap.png'
  },
  Lockdown: {
    scale: 1000,
    originX: -500,
    originZ: -500,
    image: '/minimaps/Lockdown_Minimap.jpg'
  }
};

export const MAP_SIZE = 1024;

export function worldToPixel(
  x: number,
  z: number,
  mapId: MapId
): { pixelX: number; pixelY: number } {
  const config = MAP_CONFIGS[mapId];

  const u = (x - config.originX) / config.scale;
  const v = (z - config.originZ) / config.scale;

  const pixelX = u * MAP_SIZE;
  const pixelY = (1 - v) * MAP_SIZE;

  return { pixelX, pixelY };
}

export function isHumanPlayer(userId: string): boolean {
  // Human players have UUID format, bots have numeric IDs
  return userId.includes('-');
}

export const EVENT_COLORS: Record<string, string> = {
  Position: '#3b82f6',      // Blue for human movement
  BotPosition: '#94a3b8',   // Gray for bot movement
  Kill: '#22c55e',          // Green for kills
  Killed: '#ef4444',        // Red for deaths
  BotKill: '#86efac',       // Light green for bot kills
  BotKilled: '#fca5a5',     // Light red for bot deaths
  KilledByStorm: '#a855f7', // Purple for storm deaths
  Loot: '#eab308'           // Yellow for loot
};

export const DATES = [
  'February_10',
  'February_11',
  'February_12',
  'February_13',
  'February_14'
];
