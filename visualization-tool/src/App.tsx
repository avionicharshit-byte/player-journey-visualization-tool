import { useState, useEffect, useMemo } from 'react';
import { MapCanvas } from './components/MapCanvas';
import { Controls } from './components/Controls';
import { Timeline } from './components/Timeline';
import { LoadingScreen } from './components/LoadingScreen';
import { CustomDataLoader } from './components/CustomDataLoader';
import { HotspotsPanel } from './components/HotspotsPanel';
import { useData } from './hooks/useData';
import type { CustomDataset } from './utils/parquetLoader';
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
  const [customDataset, setCustomDataset] = useState<CustomDataset | null>(null);
  const [showLoader, setShowLoader] = useState(false);
  const { isLoading, error, matches, stats, loadMatchEvents } = useData(customDataset);

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>({ type: 'none' });
  const [selectedMatch, setSelectedMatch] = useState<MatchInfo | null>(null);
  const [matchEvents, setMatchEvents] = useState<PlayerEvent[]>([]);
  const [isLoadingMatch, setIsLoadingMatch] = useState(false);

  const handleCustomDataLoaded = (dataset: CustomDataset) => {
    setCustomDataset(dataset);
    setSelectedMatch(null);
    setMatchEvents([]);
    setFilters(DEFAULT_FILTERS);
  };

  const handleResetToBundled = () => {
    setCustomDataset(null);
    setSelectedMatch(null);
    setMatchEvents([]);
    setFilters(DEFAULT_FILTERS);
  };

  // Auto-select the first available match once data is ready, so a level
  // designer lands on something visual instead of an empty "Select a Match"
  // screen. Picks an AmbroseValley match preferentially since the bundled
  // sample has the most data on that map; otherwise falls back to matches[0].
  useEffect(() => {
    if (isLoading) return;
    if (selectedMatch) return;
    if (matches.length === 0) return;
    const preferred = matches.find(m => m.mapId === 'AmbroseValley') ?? matches[0];
    setSelectedMatch(preferred);
    setFilters(prev => ({ ...prev, map: preferred.mapId }));
  }, [isLoading, matches, selectedMatch]);

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
        isCustomData={customDataset !== null}
        onOpenLoader={() => setShowLoader(true)}
        onResetData={handleResetToBundled}
      />

      <CustomDataLoader
        isOpen={showLoader}
        onClose={() => setShowLoader(false)}
        onLoaded={handleCustomDataLoaded}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Map Canvas */}
        <div className="flex-1 relative min-h-0 overflow-hidden">
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

          {/* Hotspots auto-summary — same column as the events counter (top-left),
              positioned just above the playback control. */}
          {selectedMatch && matchEvents.length > 0 && (
            <HotspotsPanel events={matchEvents} mapId={currentMapId} />
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
          events={matchEvents}
        />
      </div>
    </div>
  );
}

export default App;
