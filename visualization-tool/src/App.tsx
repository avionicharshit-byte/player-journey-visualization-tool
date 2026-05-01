import React, { useState, useEffect, useMemo } from 'react';
import { MapCanvas } from './components/MapCanvas';
import { Controls } from './components/Controls';
import { Timeline } from './components/Timeline';
import { LoadingScreen } from './components/LoadingScreen';
import { useData } from './hooks/useData';
import type { Filters, HeatmapMode, MatchInfo, PlayerEvent, MapId } from './types';
import './index.css';

const DEFAULT_FILTERS: Filters = {
  map: 'all',
  date: 'all',
  matchId: 'all',
  showHumans: true,
  showBots: true,
  showKills: true,
  showDeaths: true,
  showLoot: true,
  showStormDeaths: true
};

function App() {
  console.log('App rendering...');
  const { isLoading, error, matches, stats, loadMatchEvents } = useData();
  console.log('Data state:', { isLoading, error, matchCount: matches.length });

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>({ type: 'none' });
  const [selectedMatch, setSelectedMatch] = useState<MatchInfo | null>(null);
  const [matchEvents, setMatchEvents] = useState<PlayerEvent[]>([]);
  const [isLoadingMatch, setIsLoadingMatch] = useState(false);

  // Timeline state
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Load match events when selection changes
  useEffect(() => {
    if (!selectedMatch) {
      setMatchEvents([]);
      return;
    }

    setIsLoadingMatch(true);
    setCurrentTime(0);
    setIsPlaying(false);

    loadMatchEvents(selectedMatch.matchId).then(events => {
      setMatchEvents(events);
      setIsLoadingMatch(false);
    });
  }, [selectedMatch, loadMatchEvents]);

  // Calculate match duration
  const matchDuration = useMemo(() => {
    if (matchEvents.length === 0) return 0;
    const timestamps = matchEvents.map(e => e.ts);
    return Math.max(...timestamps) - Math.min(...timestamps);
  }, [matchEvents]);

  // Determine current map
  const currentMapId: MapId = selectedMatch?.mapId || 'AmbroseValley';

  // Handle match selection
  const handleMatchSelect = (match: MatchInfo | null) => {
    setSelectedMatch(match);
    if (match) {
      setFilters(prev => ({ ...prev, map: match.mapId }));
    }
  };

  if (isLoading) {
    return <LoadingScreen message="Loading player data..." />;
  }

  if (error) {
    return <LoadingScreen error={error} />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Left Sidebar - Controls */}
      <Controls
        filters={filters}
        setFilters={setFilters}
        heatmapMode={heatmapMode}
        setHeatmapMode={setHeatmapMode}
        matches={matches}
        selectedMatch={selectedMatch}
        onMatchSelect={handleMatchSelect}
        stats={stats}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Map Canvas */}
        <div className="flex-1 relative">
          {isLoadingMatch && (
            <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center z-10">
              <div className="text-white">Loading match data...</div>
            </div>
          )}

          {!selectedMatch ? (
            <div className="w-full h-full flex items-center justify-center bg-slate-900">
              <div className="text-center">
                <div className="text-slate-400 text-xl mb-2">Select a Match</div>
                <div className="text-slate-500 text-sm">
                  Choose a map, date, and match from the sidebar to begin
                </div>
              </div>
            </div>
          ) : (
            <MapCanvas
              events={matchEvents}
              mapId={currentMapId}
              filters={filters}
              heatmapMode={heatmapMode}
              currentTime={currentTime}
            />
          )}
        </div>

        {/* Timeline */}
        <Timeline
          currentTime={currentTime}
          setCurrentTime={setCurrentTime}
          isPlaying={isPlaying}
          setIsPlaying={setIsPlaying}
          playbackSpeed={playbackSpeed}
          setPlaybackSpeed={setPlaybackSpeed}
          matchDuration={matchDuration}
          disabled={!selectedMatch || matchEvents.length === 0}
        />
      </div>
    </div>
  );
}

export default App;
