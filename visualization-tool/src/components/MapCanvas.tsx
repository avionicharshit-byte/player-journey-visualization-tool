import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { PlayerEvent, MapId, Filters, HeatmapMode } from '../types';
import { MAP_CONFIGS, MAP_SIZE, worldToPixel, isHumanPlayer } from '../utils/mapConfig';

interface MapCanvasProps {
  events: PlayerEvent[];
  mapId: MapId;
  filters: Filters;
  heatmapMode: HeatmapMode;
  currentTime: number;
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
  const [animationFrame, setAnimationFrame] = useState(0);

  // Animation loop for pulsing effects
  useEffect(() => {
    let frameId: number;
    const animate = () => {
      setAnimationFrame(prev => (prev + 1) % 60);
      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, []);

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
    const timeRange = maxTs - minTs || 1;

    // When timeline is at 0, show all events (full match view)
    // Otherwise, show events up to the current time point
    const cutoffTs = currentTime === 0 ? maxTs : minTs + timeRange * currentTime;

    return events.filter(event => {
      if (event.ts > cutoffTs) return false;

      const isHuman = isHumanPlayer(event.user_id);
      if (isHuman && !filters.showHumans) return false;
      if (!isHuman && !filters.showBots) return false;

      // Position events are always shown (for paths)
      if (event.event === 'Position' || event.event === 'BotPosition') return true;

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
    const pulse = Math.sin(animationFrame * 0.1) * 0.3 + 0.7;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(offsetX + width / 2, offsetY + height / 2);
    ctx.scale(scale, scale);
    ctx.translate(-width / 2, -height / 2);

    const mapScale = width / MAP_SIZE;
    ctx.drawImage(mapImage, 0, 0, width, height);

    const visibleEvents = getVisibleEvents();

    // Draw heatmap if enabled
    if (heatmapMode.type !== 'none') {
      drawHeatmap(ctx, visibleEvents, mapId, mapScale, width, height, heatmapMode.type);
    }

    // Group events by user
    const eventsByUser = new Map<string, PlayerEvent[]>();
    visibleEvents.forEach(event => {
      const existing = eventsByUser.get(event.user_id) || [];
      existing.push(event);
      eventsByUser.set(event.user_id, existing);
    });

    // Draw player paths and positions
    eventsByUser.forEach((userEvents, userId) => {
      const positionEvents = userEvents.filter(e =>
        e.event === 'Position' || e.event === 'BotPosition'
      ).sort((a, b) => a.ts - b.ts);

      const isHuman = isHumanPlayer(userId);

      // Draw path if more than 1 position
      if (positionEvents.length >= 2) {
        // Glow effect
        ctx.shadowColor = isHuman ? '#00ffff' : '#ff6600';
        ctx.shadowBlur = 8;
        ctx.strokeStyle = isHuman ? '#00ffff' : '#ff6600';
        ctx.lineWidth = isHuman ? 3 : 2;
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
        ctx.shadowBlur = 0;
      }

      // Draw current position marker (even if only 1 position)
      if (positionEvents.length > 0) {
        const lastPos = positionEvents[positionEvents.length - 1];
        const { pixelX, pixelY } = worldToPixel(lastPos.x, lastPos.z, mapId);
        const x = pixelX * mapScale;
        const y = pixelY * mapScale;
        const baseSize = isHuman ? 8 : 6;
        const size = baseSize * pulse;

        // Outer glow
        ctx.shadowColor = isHuman ? '#00ffff' : '#ff6600';
        ctx.shadowBlur = 15;

        // Outer ring
        ctx.beginPath();
        ctx.arc(x, y, size + 3, 0, Math.PI * 2);
        ctx.strokeStyle = isHuman ? '#00ffff' : '#ff6600';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Inner filled circle
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = isHuman ? '#00ffff' : '#ff6600';
        ctx.fill();

        // Center dot
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#000';
        ctx.fill();

        ctx.shadowBlur = 0;
      }
    });

    // Draw event markers with high visibility
    visibleEvents.forEach(event => {
      if (event.event === 'Position' || event.event === 'BotPosition') return;

      const { pixelX, pixelY } = worldToPixel(event.x, event.z, mapId);
      const x = pixelX * mapScale;
      const y = pixelY * mapScale;

      ctx.save();

      switch (event.event) {
        case 'Kill':
        case 'BotKill':
          drawKillMarker(ctx, x, y, event.event === 'Kill', pulse);
          break;
        case 'Killed':
        case 'BotKilled':
          drawDeathMarker(ctx, x, y, event.event === 'Killed', pulse);
          break;
        case 'KilledByStorm':
          drawStormDeathMarker(ctx, x, y, pulse);
          break;
        case 'Loot':
          drawLootMarker(ctx, x, y, pulse);
          break;
      }

      ctx.restore();
    });

    ctx.restore();
  }, [mapImage, canvasSize, transform, events, currentTime, filters, heatmapMode, mapId, getVisibleEvents, animationFrame]);

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

  const handleMouseUp = () => setIsDragging(false);

  const resetView = () => setTransform({ scale: 1, offsetX: 0, offsetY: 0 });

  return (
    <div ref={containerRef} className="relative w-full h-full flex items-center justify-center bg-slate-900">
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="cursor-grab active:cursor-grabbing rounded-lg shadow-2xl"
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
          className="w-10 h-10 bg-slate-700/80 hover:bg-slate-600 rounded-lg flex items-center justify-center text-white font-bold text-xl backdrop-blur"
        >
          +
        </button>
        <button
          onClick={() => setTransform(prev => ({ ...prev, scale: Math.max(0.5, prev.scale * 0.8) }))}
          className="w-10 h-10 bg-slate-700/80 hover:bg-slate-600 rounded-lg flex items-center justify-center text-white font-bold text-xl backdrop-blur"
        >
          −
        </button>
        <button
          onClick={resetView}
          className="w-10 h-10 bg-slate-700/80 hover:bg-slate-600 rounded-lg flex items-center justify-center text-white text-sm backdrop-blur"
        >
          ⟲
        </button>
      </div>

      {/* Legend */}
      <div className="absolute top-4 right-4 bg-black/70 backdrop-blur p-4 rounded-lg text-sm border border-slate-600">
        <div className="font-bold mb-3 text-white">Legend</div>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full bg-cyan-400 shadow-lg shadow-cyan-400/50"></div>
            <span className="text-cyan-400">Human Player</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full bg-orange-500 shadow-lg shadow-orange-500/50"></div>
            <span className="text-orange-400">Bot</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-b-[14px] border-l-transparent border-r-transparent border-b-lime-400"></div>
            <span className="text-lime-400">Kill</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 bg-red-500 rotate-45 shadow-lg shadow-red-500/50"></div>
            <span className="text-red-400">Death</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full bg-fuchsia-500 shadow-lg shadow-fuchsia-500/50"></div>
            <span className="text-fuchsia-400">Storm Death</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 bg-yellow-400 rounded shadow-lg shadow-yellow-400/50"></div>
            <span className="text-yellow-400">Loot</span>
          </div>
        </div>
      </div>

      {/* Event counter with breakdown */}
      <div className="absolute top-4 left-4 bg-black/70 backdrop-blur px-4 py-3 rounded-lg text-sm border border-slate-600">
        <div className="flex gap-4">
          <div>
            <span className="text-slate-400">Events: </span>
            <span className="text-white font-bold">{events.length}</span>
          </div>
        </div>
        <div className="flex gap-4 mt-1 text-xs">
          <div>
            <span className="text-cyan-400">Humans: </span>
            <span className="text-cyan-300 font-bold">
              {new Set(events.filter(e => isHumanPlayer(e.user_id)).map(e => e.user_id)).size}
            </span>
          </div>
          <div>
            <span className="text-orange-400">Bots: </span>
            <span className="text-orange-300 font-bold">
              {new Set(events.filter(e => !isHumanPlayer(e.user_id)).map(e => e.user_id)).size}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Kill marker - bright lime triangle
function drawKillMarker(ctx: CanvasRenderingContext2D, x: number, y: number, isHumanKill: boolean, pulse: number) {
  const size = (isHumanKill ? 12 : 10) * pulse;

  ctx.shadowColor = '#84cc16';
  ctx.shadowBlur = 20;

  ctx.fillStyle = '#84cc16';
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x - size * 0.8, y + size * 0.6);
  ctx.lineTo(x + size * 0.8, y + size * 0.6);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.shadowBlur = 0;
}

// Death marker - red diamond
function drawDeathMarker(ctx: CanvasRenderingContext2D, x: number, y: number, isHumanDeath: boolean, pulse: number) {
  const size = (isHumanDeath ? 10 : 8) * pulse;

  ctx.shadowColor = '#ef4444';
  ctx.shadowBlur = 20;

  ctx.fillStyle = '#ef4444';
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-size / 2, -size / 2, size, size);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.strokeRect(-size / 2, -size / 2, size, size);
  ctx.restore();

  // X mark
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 4, y - 4);
  ctx.lineTo(x + 4, y + 4);
  ctx.moveTo(x + 4, y - 4);
  ctx.lineTo(x - 4, y + 4);
  ctx.stroke();

  ctx.shadowBlur = 0;
}

// Storm death marker - purple circle with lightning
function drawStormDeathMarker(ctx: CanvasRenderingContext2D, x: number, y: number, pulse: number) {
  const size = 12 * pulse;

  ctx.shadowColor = '#d946ef';
  ctx.shadowBlur = 25;

  // Outer ring
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fillStyle = '#d946ef';
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Lightning bolt
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(x - 2, y - 6);
  ctx.lineTo(x + 2, y - 2);
  ctx.lineTo(x, y - 2);
  ctx.lineTo(x + 3, y + 6);
  ctx.lineTo(x - 1, y + 1);
  ctx.lineTo(x + 1, y + 1);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;
}

// Loot marker - golden star
function drawLootMarker(ctx: CanvasRenderingContext2D, x: number, y: number, pulse: number) {
  const size = 8 * pulse;

  ctx.shadowColor = '#facc15';
  ctx.shadowBlur = 15;

  ctx.fillStyle = '#facc15';

  // Draw star shape
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
    const px = x + Math.cos(angle) * size;
    const py = y + Math.sin(angle) * size;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.shadowBlur = 0;
}

// Improved heatmap with radial gradients and better visibility
function drawHeatmap(
  ctx: CanvasRenderingContext2D,
  events: PlayerEvent[],
  mapId: MapId,
  mapScale: number,
  width: number,
  height: number,
  type: 'kills' | 'deaths' | 'traffic'
) {
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

  // Create grid-based heatmap for better performance and visibility
  const gridSize = 20;
  const grid: number[][] = Array(Math.ceil(height / gridSize))
    .fill(null)
    .map(() => Array(Math.ceil(width / gridSize)).fill(0));

  // Accumulate density
  heatmapEvents.forEach(event => {
    const { pixelX, pixelY } = worldToPixel(event.x, event.z, mapId);
    const x = Math.floor((pixelX * mapScale) / gridSize);
    const y = Math.floor((pixelY * mapScale) / gridSize);
    if (x >= 0 && x < grid[0].length && y >= 0 && y < grid.length) {
      grid[y][x]++;
    }
  });

  // Find max density for normalization
  let maxDensity = 0;
  for (const row of grid) {
    for (const cell of row) {
      maxDensity = Math.max(maxDensity, cell);
    }
  }

  if (maxDensity === 0) return;

  // Color configuration
  let baseColor: [number, number, number];
  switch (type) {
    case 'kills':
      baseColor = [34, 197, 94]; // Green
      break;
    case 'deaths':
      baseColor = [239, 68, 68]; // Red
      break;
    case 'traffic':
      baseColor = [59, 130, 246]; // Blue
      break;
  }

  // Draw the heatmap grid
  ctx.save();
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const density = grid[y][x];
      if (density > 0) {
        const intensity = Math.min(1, density / (maxDensity * 0.5)); // Increase sensitivity
        const alpha = 0.2 + intensity * 0.6;

        // Draw with glow effect
        const centerX = (x + 0.5) * gridSize;
        const centerY = (y + 0.5) * gridSize;
        const radius = gridSize * 0.8 * (0.5 + intensity * 0.5);

        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
        gradient.addColorStop(0, `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, ${alpha})`);
        gradient.addColorStop(0.6, `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, ${alpha * 0.5})`);
        gradient.addColorStop(1, `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, 0)`);

        ctx.fillStyle = gradient;
        ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
      }
    }
  }
  ctx.restore();
}
