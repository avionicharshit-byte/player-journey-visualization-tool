import type { PlayerEvent, MapId } from '../types';
import { MAP_CONFIGS, MAP_SIZE, worldToPixel } from './mapConfig';

export interface Hotspot {
  /** Number of qualifying events in this cluster */
  count: number;
  /** Centroid in world coordinates (for tooltips/debug) */
  worldX: number;
  worldZ: number;
  /** Centroid in normalized [0..1] minimap pixel coords (for "where") */
  normalizedX: number;
  normalizedY: number;
  /** Human-friendly region label: NW / N / NE / W / Center / E / SW / S / SE */
  region: string;
  /** Sample of event types in the cluster (e.g., for icons) */
  eventTypes: Set<string>;
}

/**
 * Cluster events spatially and return the top N densest clusters.
 *
 * @param events     full event list for the match
 * @param mapId      map id, used for world→pixel conversion
 * @param eventTypes which event types to include (defaults to kill events)
 * @param radiusPx   merge events within this minimap-pixel radius (default 80)
 * @param topN       number of hotspots to return
 */
export function computeHotspots(
  events: PlayerEvent[],
  mapId: MapId,
  options: {
    eventTypes?: PlayerEvent['event'][];
    radiusPx?: number;
    topN?: number;
  } = {}
): Hotspot[] {
  const allowedTypes = new Set(
    options.eventTypes ?? (['Kill', 'BotKill'] as PlayerEvent['event'][])
  );
  const radius = options.radiusPx ?? 80;
  const topN = options.topN ?? 3;

  const filtered = events.filter(e => allowedTypes.has(e.event));
  if (filtered.length === 0) return [];

  type RawCluster = {
    pxX: number;
    pxY: number;
    worldX: number;
    worldZ: number;
    count: number;
    types: Set<string>;
  };
  const clusters: RawCluster[] = [];

  for (const e of filtered) {
    const { pixelX, pixelY } = worldToPixel(e.x, e.z, mapId);
    let merged = false;
    for (const c of clusters) {
      const dx = c.pxX - pixelX;
      const dy = c.pxY - pixelY;
      if (Math.sqrt(dx * dx + dy * dy) <= radius) {
        // Running average to keep the centroid stable
        const n = c.count;
        c.pxX = (c.pxX * n + pixelX) / (n + 1);
        c.pxY = (c.pxY * n + pixelY) / (n + 1);
        c.worldX = (c.worldX * n + e.x) / (n + 1);
        c.worldZ = (c.worldZ * n + e.z) / (n + 1);
        c.count++;
        c.types.add(e.event);
        merged = true;
        break;
      }
    }
    if (!merged) {
      clusters.push({
        pxX: pixelX,
        pxY: pixelY,
        worldX: e.x,
        worldZ: e.z,
        count: 1,
        types: new Set([e.event])
      });
    }
  }

  return clusters
    .sort((a, b) => b.count - a.count)
    .slice(0, topN)
    .map(c => ({
      count: c.count,
      worldX: Math.round(c.worldX),
      worldZ: Math.round(c.worldZ),
      normalizedX: c.pxX / MAP_SIZE,
      normalizedY: c.pxY / MAP_SIZE,
      region: regionLabel(c.pxX / MAP_SIZE, c.pxY / MAP_SIZE),
      eventTypes: c.types
    }));
}

/**
 * Map a normalized minimap position to one of nine compass-style regions.
 * (0,0) is the top-left of the minimap image.
 */
function regionLabel(nx: number, ny: number): string {
  const col = nx < 0.33 ? 'W' : nx > 0.67 ? 'E' : 'C';
  const row = ny < 0.33 ? 'N' : ny > 0.67 ? 'S' : 'M';
  if (row === 'M' && col === 'C') return 'Center';
  if (row === 'M') return col === 'W' ? 'West' : 'East';
  if (col === 'C') return row === 'N' ? 'North' : 'South';
  // corners
  return `${row}${col}`;
}

/** Allow callers to ask for the world bounds of the map (handy for tooltips). */
export function getMapBounds(mapId: MapId) {
  const cfg = MAP_CONFIGS[mapId];
  return {
    minX: cfg.originX,
    minZ: cfg.originZ,
    maxX: cfg.originX + cfg.scale,
    maxZ: cfg.originZ + cfg.scale
  };
}
