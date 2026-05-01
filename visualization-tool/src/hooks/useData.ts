import { useState, useEffect, useCallback } from 'react';
import type { PlayerEvent, MapId, MatchInfo } from '../types';
import type { CustomDataset } from '../utils/parquetLoader';

interface RawEvent {
  u: string;   // user_id
  m: string;   // match_id
  map: string; // map_id
  x: number;
  y: number;
  z: number;
  t: number;   // timestamp
  e: string;   // event type
}

interface RawMatch {
  id: string;
  map: string;
  date: string;
  players: number;
  bots: number;
  events: number;
}

interface Stats {
  total_events: number;
  total_matches: number;
  dates: string[];
  maps: string[];
  event_types: string[];
}

/**
 * @param customDataset Optional in-memory dataset (from a user-uploaded zip).
 *                      When provided, all data is served from memory and no
 *                      network fetches are made.
 */
export function useData(customDataset: CustomDataset | null = null) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchInfo[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [matchEventsCache, setMatchEventsCache] = useState<Map<string, PlayerEvent[]>>(new Map());

  useEffect(() => {
    if (customDataset) {
      // Custom dataset path: use what the user uploaded, no network calls.
      setMatches(customDataset.matches);
      setStats(customDataset.stats);
      setMatchEventsCache(new Map(customDataset.eventsByMatch));
      setError(null);
      setIsLoading(false);
    } else {
      loadInitialData();
    }
  }, [customDataset]);

  async function loadInitialData() {
    try {
      setIsLoading(true);

      // Load matches index and stats
      const [matchesRes, statsRes] = await Promise.all([
        fetch('/data/matches.json'),
        fetch('/data/stats.json')
      ]);

      if (!matchesRes.ok || !statsRes.ok) {
        throw new Error('Failed to load data files. Make sure to run the preprocess script first.');
      }

      const matchesData: RawMatch[] = await matchesRes.json();
      const statsData: Stats = await statsRes.json();

      const formattedMatches: MatchInfo[] = matchesData.map(m => ({
        matchId: m.id,
        mapId: m.map as MapId,
        date: m.date,
        playerCount: m.players,
        botCount: m.bots
      }));

      setMatches(formattedMatches);
      setStats(statsData);
      // Reset the cache when switching back to the bundled dataset
      setMatchEventsCache(new Map());
      setIsLoading(false);
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setIsLoading(false);
    }
  }

  const loadMatchEvents = useCallback(async (matchId: string): Promise<PlayerEvent[]> => {
    // Check cache first (also serves the custom-dataset case, which seeds the cache up front)
    if (matchEventsCache.has(matchId)) {
      return matchEventsCache.get(matchId)!;
    }

    // Custom dataset is fully in-memory — anything missing means "no events for this match"
    if (customDataset) {
      return customDataset.eventsByMatch.get(matchId) ?? [];
    }

    try {
      // Create safe filename
      const safeId = matchId.replace('.nakama-0', '').replace(/\//g, '_');
      const response = await fetch(`/data/matches/${safeId}.json`);

      if (!response.ok) {
        console.error(`Failed to load match ${matchId}`);
        return [];
      }

      const rawEvents: RawEvent[] = await response.json();

      const events: PlayerEvent[] = rawEvents.map(e => ({
        user_id: e.u,
        match_id: e.m,
        map_id: e.map as MapId,
        x: e.x,
        y: e.y,
        z: e.z,
        ts: e.t,
        event: e.e as PlayerEvent['event']
      }));

      // Cache the result
      setMatchEventsCache(prev => new Map(prev).set(matchId, events));

      return events;
    } catch (err) {
      console.error('Error loading match events:', err);
      return [];
    }
  }, [matchEventsCache, customDataset]);

  const getMatchesByMap = useCallback((mapId: MapId | 'all'): MatchInfo[] => {
    if (mapId === 'all') return matches;
    return matches.filter(m => m.mapId === mapId);
  }, [matches]);

  const getMatchesByDate = useCallback((date: string | 'all'): MatchInfo[] => {
    if (date === 'all') return matches;
    return matches.filter(m => m.date === date);
  }, [matches]);

  const getFilteredMatches = useCallback((mapId: MapId | 'all', date: string | 'all'): MatchInfo[] => {
    return matches.filter(m => {
      if (mapId !== 'all' && m.mapId !== mapId) return false;
      if (date !== 'all' && m.date !== date) return false;
      return true;
    });
  }, [matches]);

  return {
    isLoading,
    error,
    matches,
    stats,
    loadMatchEvents,
    getMatchesByMap,
    getMatchesByDate,
    getFilteredMatches
  };
}
