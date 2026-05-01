import React, { useMemo } from 'react';
import type { MapId, Filters, HeatmapMode, MatchInfo } from '../types';
import { DATES } from '../utils/mapConfig';

interface ControlsProps {
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  heatmapMode: HeatmapMode;
  setHeatmapMode: React.Dispatch<React.SetStateAction<HeatmapMode>>;
  matches: MatchInfo[];
  selectedMatch: MatchInfo | null;
  onMatchSelect: (match: MatchInfo | null) => void;
  stats: { total_events: number; total_matches: number; dates?: string[] } | null;
  isCustomData: boolean;
  onOpenLoader: () => void;
  onResetData: () => void;
}

export function Controls({
  filters,
  setFilters,
  heatmapMode,
  setHeatmapMode,
  matches,
  selectedMatch,
  onMatchSelect,
  stats,
  isCustomData,
  onOpenLoader,
  onResetData
}: ControlsProps) {
  const filteredMatches = matches.filter(m => {
    if (filters.map !== 'all' && m.mapId !== filters.map) return false;
    if (filters.date !== 'all' && m.date !== filters.date) return false;
    return true;
  });

  // Use the dataset's actual dates when available (for custom uploads),
  // otherwise fall back to the bundled DATES constant.
  const availableDates = useMemo(() => {
    if (stats?.dates && stats.dates.length > 0) return stats.dates;
    return DATES;
  }, [stats]);

  return (
    <div className="w-80 bg-slate-800 p-4 overflow-y-auto flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-white mb-1">LILA BLACK</h1>
        <p className="text-slate-400 text-sm">Player Journey Visualization</p>
        {stats && (
          <p className="text-slate-500 text-xs mt-1">
            {stats.total_matches.toLocaleString()} matches · {stats.total_events.toLocaleString()} events
          </p>
        )}
      </div>

      {/* Data source */}
      <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Data source</div>
          {isCustomData ? (
            <span className="text-[10px] px-1.5 py-0.5 bg-cyan-400/20 text-cyan-300 rounded font-bold">CUSTOM</span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 bg-slate-700 text-slate-300 rounded font-bold">BUNDLED</span>
          )}
        </div>
        <button
          onClick={onOpenLoader}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-sm font-medium rounded px-3 py-2 transition shadow"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9 4.5-4.5m0 0 4.5 4.5m-4.5-4.5v12" />
          </svg>
          Load Custom Data
        </button>
        {isCustomData && (
          <button
            onClick={onResetData}
            className="w-full mt-2 text-xs text-slate-400 hover:text-white py-1 transition"
          >
            ↺ Reset to bundled data
          </button>
        )}
      </div>

      {/* Map Selection */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Map</label>
        <select
          value={filters.map}
          onChange={e => setFilters(prev => ({ ...prev, map: e.target.value as MapId | 'all' }))}
          className="w-full bg-slate-700 text-white rounded px-3 py-2 text-sm"
        >
          <option value="all">All Maps</option>
          <option value="AmbroseValley">Ambrose Valley</option>
          <option value="GrandRift">Grand Rift</option>
          <option value="Lockdown">Lockdown</option>
        </select>
      </div>

      {/* Date Selection */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Date</label>
        <select
          value={filters.date}
          onChange={e => setFilters(prev => ({ ...prev, date: e.target.value }))}
          className="w-full bg-slate-700 text-white rounded px-3 py-2 text-sm"
        >
          <option value="all">All Dates</option>
          {availableDates.map(date => (
            <option key={date} value={date}>{date.replace('_', ' ')}</option>
          ))}
        </select>
      </div>

      {/* Match Selection */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Match ({filteredMatches.length} available)
        </label>
        <select
          value={selectedMatch?.matchId || ''}
          onChange={e => {
            const match = filteredMatches.find(m => m.matchId === e.target.value);
            onMatchSelect(match || null);
          }}
          className="w-full bg-slate-700 text-white rounded px-3 py-2 text-sm"
        >
          <option value="">Select a match...</option>
          {filteredMatches.slice(0, 100).map(match => (
            <option key={match.matchId} value={match.matchId}>
              {match.mapId} - {match.playerCount} human{match.playerCount !== 1 ? 's' : ''}, {match.botCount} bot{match.botCount !== 1 ? 's' : ''}
            </option>
          ))}
        </select>
        {selectedMatch && (
          <div className="mt-2 text-xs text-slate-400">
            <div>Map: {selectedMatch.mapId}</div>
            <div>Players: {selectedMatch.playerCount} humans, {selectedMatch.botCount} bots</div>
          </div>
        )}
      </div>

      {/* Player Type Filters */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Show Players</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={filters.showHumans}
              onChange={e => setFilters(prev => ({ ...prev, showHumans: e.target.checked }))}
              className="rounded bg-slate-700 border-slate-600"
            />
            <span className="text-cyan-400">Humans</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={filters.showBots}
              onChange={e => setFilters(prev => ({ ...prev, showBots: e.target.checked }))}
              className="rounded bg-slate-700 border-slate-600"
            />
            <span className="text-orange-400">Bots</span>
          </label>
        </div>
      </div>

      {/* Event Type Filters */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Show Events</label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={filters.showKills}
              onChange={e => setFilters(prev => ({ ...prev, showKills: e.target.checked }))}
              className="rounded bg-slate-700 border-slate-600"
            />
            <span className="text-green-400">Kills</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={filters.showDeaths}
              onChange={e => setFilters(prev => ({ ...prev, showDeaths: e.target.checked }))}
              className="rounded bg-slate-700 border-slate-600"
            />
            <span className="text-red-400">Deaths</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={filters.showLoot}
              onChange={e => setFilters(prev => ({ ...prev, showLoot: e.target.checked }))}
              className="rounded bg-slate-700 border-slate-600"
            />
            <span className="text-yellow-400">Loot</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={filters.showStormDeaths}
              onChange={e => setFilters(prev => ({ ...prev, showStormDeaths: e.target.checked }))}
              className="rounded bg-slate-700 border-slate-600"
            />
            <span className="text-purple-400">Storm</span>
          </label>
        </div>
      </div>

      {/* Heatmap Toggle */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Heatmap Overlay</label>
        <div className="grid grid-cols-2 gap-2">
          {(['none', 'kills', 'deaths', 'traffic'] as const).map(type => (
            <button
              key={type}
              onClick={() => setHeatmapMode({ type })}
              className={`px-3 py-2 rounded text-sm capitalize transition ${
                heatmapMode.type === type
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {type === 'none' ? 'Off' : type}
            </button>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-auto pt-4 border-t border-slate-700">
        <p className="text-xs text-slate-500">
          <strong>Controls:</strong><br />
          • Scroll to zoom<br />
          • Drag to pan<br />
          • Use timeline to replay match
        </p>
      </div>
    </div>
  );
}
