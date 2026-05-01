import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { PlayerEvent, MapId, Filters, HeatmapMode } from '../types';
import { MAP_CONFIGS, MAP_SIZE, worldToPixel, isHumanPlayer } from '../utils/mapConfig';

interface MapCanvasProps {
  events: PlayerEvent[];
  mapId: MapId;
  filters: Filters;
  heatmapMode: HeatmapMode;
  currentTime: number; // 0-1 progress through match
}

interface Transform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export function MapCanvas({
  events,
  mapId,
  filters,
  heatmapMode,
  currentTime
}: MapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<Transform>({ scale: 1, offsetX: 0, offsetY: 0 });
  const [mapImage, setMapImage] = useState<HTMLImageElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 800 });

  // Load map image
  useEffect(() => {
    const img = new Image();
    img.src = MAP_CONFIGS[mapId].image;
    img.onload = () => setMapImage(img);
  }, [mapId]);

  // Handle resize
  useEffect(() => {
    function handleResize() {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const size = Math.min(rect.width, rect.height);
        setCanvasSize({ width: size, height: size });
      }
    }

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Filter events based on current time and filters
  const getVisibleEvents = useCallback(() => {
    if (events.length === 0) return [];

    const minTs = Math.min(...events.map(e => e.ts));
    const maxTs = Math.max(...events.map(e => e.ts));
    const timeRange = maxTs - minTs;
    const cutoffTs = minTs + timeRange * currentTime;

    return events.filter(event => {
      // Time filter
      if (event.ts > cutoffTs) return false;

      // Player type filter
      const isHuman = isHumanPlayer(event.user_id);
      if (isHuman && !filters.showHumans) return false;
      if (!isHuman && !filters.showBots) return false;

      // Event type filters
      if (event.event === 'Kill' && !filters.showKills) return false;
      if (event.event === 'Killed' && !filters.showDeaths) return false;
      if (event.event === 'BotKill' && !filters.showKills) return false;
      if (event.event === 'BotKilled' && !filters.showDeaths) return false;
      if (event.event === 'KilledByStorm' && !filters.showStormDeaths) return false;
      if (event.event === 'Loot' && !filters.showLoot) return false;

      return true;
    });
  }, [events, currentTime, filters]);

  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mapImage) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvasSize;
    const { scale, offsetX, offsetY } = transform;

    // Clear canvas
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, width, height);

    // Apply transform
    ctx.save();
    ctx.translate(offsetX + width / 2, offsetY + height / 2);
    ctx.scale(scale, scale);
    ctx.translate(-width / 2, -height / 2);

    // Draw map image
    const mapScale = width / MAP_SIZE;
    ctx.drawImage(mapImage, 0, 0, width, height);

    const visibleEvents = getVisibleEvents();

    // Draw heatmap if enabled
    if (heatmapMode.type !== 'none') {
      drawHeatmap(ctx, visibleEvents, mapId, mapScale, width, height, heatmapMode.type);
    }

    // Group events by user to draw paths
    const eventsByUser = new Map<string, PlayerEvent[]>();
    visibleEvents.forEach(event => {
      const existing = eventsByUser.get(event.user_id) || [];
      existing.push(event);
      eventsByUser.set(event.user_id, existing);
    });

    // Draw player paths
    eventsByUser.forEach((userEvents, userId) => {
      const positionEvents = userEvents.filter(e =>
        e.event === 'Position' || e.event === 'BotPosition'
      ).sort((a, b) => a.ts - b.ts);

      if (positionEvents.length < 2) return;

      const isHuman = isHumanPlayer(userId);
      ctx.strokeStyle = isHuman ? 'rgba(59, 130, 246, 0.6)' : 'rgba(148, 163, 184, 0.4)';
      ctx.lineWidth = isHuman ? 2 : 1;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      const firstPos = worldToPixel(positionEvents[0].x, positionEvents[0].z, mapId);
      ctx.moveTo(firstPos.pixelX * mapScale, firstPos.pixelY * mapScale);

      for (let i = 1; i < positionEvents.length; i++) {
        const pos = worldToPixel(positionEvents[i].x, positionEvents[i].z, mapId);
        ctx.lineTo(pos.pixelX * mapScale, pos.pixelY * mapScale);
      }
      ctx.stroke();

      // Draw current position marker
      if (positionEvents.length > 0) {
        const lastPos = positionEvents[positionEvents.length - 1];
        const { pixelX, pixelY } = worldToPixel(lastPos.x, lastPos.z, mapId);

        ctx.beginPath();
        ctx.arc(pixelX * mapScale, pixelY * mapScale, isHuman ? 5 : 3, 0, Math.PI * 2);
        ctx.fillStyle = isHuman ? '#3b82f6' : '#94a3b8';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });

    // Draw event markers
    visibleEvents.forEach(event => {
      if (event.event === 'Position' || event.event === 'BotPosition') return;

      const { pixelX, pixelY } = worldToPixel(event.x, event.z, mapId);
      const x = pixelX * mapScale;
      const y = pixelY * mapScale;

      ctx.save();

      switch (event.event) {
        case 'Kill':
        case 'BotKill':
          drawKillMarker(ctx, x, y, event.event === 'Kill');
          break;
        case 'Killed':
        case 'BotKilled':
          drawDeathMarker(ctx, x, y, event.event === 'Killed');
          break;
        case 'KilledByStorm':
          drawStormDeathMarker(ctx, x, y);
          break;
        case 'Loot':
          drawLootMarker(ctx, x, y);
          break;
      }

      ctx.restore();
    });

    ctx.restore();
  }, [mapImage, canvasSize, transform, events, currentTime, filters, heatmapMode, mapId, getVisibleEvents]);

  // Mouse handlers for pan/zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform(prev => ({
      ...prev,
      scale: Math.max(0.5, Math.min(5, prev.scale * delta))
    }));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - transform.offsetX, y: e.clientY - transform.offsetY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setTransform(prev => ({
      ...prev,
      offsetX: e.clientX - dragStart.x,
      offsetY: e.clientY - dragStart.y
    }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const resetView = () => {
    setTransform({ scale: 1, offsetX: 0, offsetY: 0 });
  };

  return (
    <div ref={containerRef} className="relative w-full h-full flex items-center justify-center bg-slate-900">
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="cursor-grab active:cursor-grabbing rounded-lg shadow-xl"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        <button
          onClick={() => setTransform(prev => ({ ...prev, scale: Math.min(5, prev.scale * 1.2) }))}
          className="w-8 h-8 bg-slate-700 hover:bg-slate-600 rounded flex items-center justify-center text-white"
        >
          +
        </button>
        <button
          onClick={() => setTransform(prev => ({ ...prev, scale: Math.max(0.5, prev.scale * 0.8) }))}
          className="w-8 h-8 bg-slate-700 hover:bg-slate-600 rounded flex items-center justify-center text-white"
        >
          -
        </button>
        <button
          onClick={resetView}
          className="w-8 h-8 bg-slate-700 hover:bg-slate-600 rounded flex items-center justify-center text-white text-xs"
        >
          R
        </button>
      </div>

      {/* Legend */}
      <div className="absolute top-4 right-4 bg-slate-800/90 p-3 rounded-lg text-xs">
        <div className="font-semibold mb-2">Legend</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span>Human Player</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-slate-400"></div>
            <span>Bot</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500" style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }}></div>
            <span>Kill</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rotate-45"></div>
            <span>Death</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500"></div>
            <span>Storm Death</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-yellow-500"></div>
            <span>Loot</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper drawing functions
function drawKillMarker(ctx: CanvasRenderingContext2D, x: number, y: number, isHumanKill: boolean) {
  const size = isHumanKill ? 8 : 6;
  ctx.fillStyle = isHumanKill ? '#22c55e' : '#86efac';
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x - size, y + size);
  ctx.lineTo(x + size, y + size);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawDeathMarker(ctx: CanvasRenderingContext2D, x: number, y: number, isHumanDeath: boolean) {
  const size = isHumanDeath ? 6 : 4;
  ctx.fillStyle = isHumanDeath ? '#ef4444' : '#fca5a5';
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-size, -size, size * 2, size * 2);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.strokeRect(-size, -size, size * 2, size * 2);
  ctx.restore();
}

function drawStormDeathMarker(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#a855f7';
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Inner ring
  ctx.strokeStyle = '#a855f7';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.stroke();
}

function drawLootMarker(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#eab308';
  ctx.fillRect(x - 4, y - 4, 8, 8);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 4, y - 4, 8, 8);
}

function drawHeatmap(
  ctx: CanvasRenderingContext2D,
  events: PlayerEvent[],
  mapId: MapId,
  mapScale: number,
  width: number,
  height: number,
  type: 'kills' | 'deaths' | 'traffic'
) {
  // Filter events based on heatmap type
  let heatmapEvents: PlayerEvent[];

  switch (type) {
    case 'kills':
      heatmapEvents = events.filter(e => e.event === 'Kill' || e.event === 'BotKill');
      break;
    case 'deaths':
      heatmapEvents = events.filter(e =>
        e.event === 'Killed' || e.event === 'BotKilled' || e.event === 'KilledByStorm'
      );
      break;
    case 'traffic':
      heatmapEvents = events.filter(e => e.event === 'Position' || e.event === 'BotPosition');
      break;
    default:
      return;
  }

  if (heatmapEvents.length === 0) return;

  // Create heatmap data
  const resolution = 50;
  const cellWidth = width / resolution;
  const cellHeight = height / resolution;
  const grid: number[][] = Array(resolution).fill(0).map(() => Array(resolution).fill(0));

  // Populate grid
  heatmapEvents.forEach(event => {
    const { pixelX, pixelY } = worldToPixel(event.x, event.z, mapId);
    const gridX = Math.floor((pixelX * mapScale) / cellWidth);
    const gridY = Math.floor((pixelY * mapScale) / cellHeight);

    if (gridX >= 0 && gridX < resolution && gridY >= 0 && gridY < resolution) {
      grid[gridY][gridX]++;
    }
  });

  // Find max value for normalization
  let maxVal = 0;
  grid.forEach(row => row.forEach(val => { if (val > maxVal) maxVal = val; }));

  if (maxVal === 0) return;

  // Draw heatmap
  for (let y = 0; y < resolution; y++) {
    for (let x = 0; x < resolution; x++) {
      const val = grid[y][x];
      if (val === 0) continue;

      const intensity = val / maxVal;
      let color: string;

      switch (type) {
        case 'kills':
          color = `rgba(34, 197, 94, ${intensity * 0.6})`;
          break;
        case 'deaths':
          color = `rgba(239, 68, 68, ${intensity * 0.6})`;
          break;
        case 'traffic':
          color = `rgba(59, 130, 246, ${intensity * 0.5})`;
          break;
        default:
          color = `rgba(255, 255, 255, ${intensity * 0.5})`;
      }

      ctx.fillStyle = color;
      ctx.fillRect(x * cellWidth, y * cellHeight, cellWidth + 1, cellHeight + 1);
    }
  }
}
