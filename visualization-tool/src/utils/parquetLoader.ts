/**
 * Parquet loader for browser-side parsing of player_data.zip files.
 * Uses DuckDB-WASM to query parquet files extracted from a zip via JSZip.
 *
 * This module is intended to be lazy-loaded via dynamic import() so the
 * ~30MB DuckDB-WASM bundle never lands on the critical path for users
 * who only browse the bundled data.
 */

import * as duckdb from '@duckdb/duckdb-wasm';
import JSZip from 'jszip';
import type { PlayerEvent, MapId, EventType, MatchInfo } from '../types';

export interface CustomDataset {
  matches: MatchInfo[];
  stats: {
    total_events: number;
    total_matches: number;
    dates: string[];
    maps: string[];
    event_types: string[];
  };
  /** Per-match event arrays, keyed by raw match_id (with .nakama-0 suffix). */
  eventsByMatch: Map<string, PlayerEvent[]>;
}

export interface ProgressUpdate {
  stage: 'init' | 'unzip' | 'register' | 'query' | 'transform' | 'done';
  message: string;
  /** 0–1, or null if indeterminate */
  progress: number | null;
}

type ProgressCallback = (update: ProgressUpdate) => void;

let dbInstance: duckdb.AsyncDuckDB | null = null;

/** Initialize DuckDB-WASM lazily and reuse the instance across uploads. */
async function getDb(): Promise<duckdb.AsyncDuckDB> {
  if (dbInstance) return dbInstance;

  const bundles = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(bundles);

  const workerUrl = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker!}");`], { type: 'text/javascript' })
  );

  const worker = new Worker(workerUrl);
  const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
  const db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(workerUrl);

  dbInstance = db;
  return db;
}

/**
 * Decode an `event` column value. Parquet bytes columns surface as
 * Uint8Array in DuckDB-WASM; we decode to UTF-8 string.
 */
function decodeEvent(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  if (raw instanceof Uint8Array) return new TextDecoder().decode(raw);
  if (raw && typeof raw === 'object' && 'toString' in raw) return String(raw);
  return String(raw);
}

function isHumanPlayer(userId: string): boolean {
  return userId.includes('-');
}

/**
 * Process a player_data.zip File and produce data in the same shape the
 * default in-memory pipeline uses. Reports progress via the callback.
 */
export async function loadCustomDataset(
  file: File,
  onProgress: ProgressCallback
): Promise<CustomDataset> {
  // ---- 1. Boot DuckDB-WASM (slow first time, instant after) ----
  onProgress({ stage: 'init', message: 'Initializing DuckDB-WASM…', progress: null });
  const db = await getDb();
  const conn = await db.connect();

  try {
    // ---- 2. Unzip ----
    onProgress({ stage: 'unzip', message: 'Unzipping archive…', progress: null });
    const zip = await JSZip.loadAsync(file);

    const parquetEntries: { name: string; date: string; bytes: Uint8Array }[] = [];
    const allEntries = Object.values(zip.files).filter(e => !e.dir);

    let unzipped = 0;
    for (const entry of allEntries) {
      // Match files look like:  February_10/<match-id>.nakama-0
      // The README also notes parquet files even though the extension is `.nakama-0`.
      const pathMatch = entry.name.match(/(February_\d+)\/([^/]+)\.nakama-0$/);
      if (!pathMatch) continue;

      const date = pathMatch[1];
      const buf = await entry.async('uint8array');
      parquetEntries.push({
        name: `${date}__${pathMatch[2]}.parquet`,
        date,
        bytes: buf
      });

      unzipped++;
      if (unzipped % 50 === 0) {
        onProgress({
          stage: 'unzip',
          message: `Unzipping… ${unzipped} files`,
          progress: unzipped / allEntries.length
        });
      }
    }

    if (parquetEntries.length === 0) {
      throw new Error(
        'No parquet files found in zip. Expected files at February_XX/*.nakama-0.'
      );
    }

    // ---- 3. Register every parquet buffer in DuckDB's virtual FS ----
    onProgress({
      stage: 'register',
      message: `Registering ${parquetEntries.length} parquet files…`,
      progress: 0
    });

    const fileNames: string[] = [];
    for (let i = 0; i < parquetEntries.length; i++) {
      const entry = parquetEntries[i];
      await db.registerFileBuffer(entry.name, entry.bytes);
      fileNames.push(entry.name);

      if (i % 100 === 0 || i === parquetEntries.length - 1) {
        onProgress({
          stage: 'register',
          message: `Registering… ${i + 1}/${parquetEntries.length}`,
          progress: (i + 1) / parquetEntries.length
        });
      }
    }

    // Build a map filename -> date so we can attach date to each event row
    const fileToDate = new Map<string, string>();
    for (const e of parquetEntries) fileToDate.set(e.name, e.date);

    // ---- 4. Query: union all parquet files into one stream of rows ----
    // We use parquet_scan with an array literal so DuckDB streams everything.
    onProgress({
      stage: 'query',
      message: 'Querying parquet data with DuckDB…',
      progress: null
    });

    const fileList = fileNames.map(f => `'${f}'`).join(', ');
    const sql = `
      SELECT
        user_id,
        match_id,
        map_id,
        event,
        ts,
        x, y, z,
        filename
      FROM read_parquet([${fileList}], filename = true)
    `;

    const result = await conn.query(sql);

    // ---- 5. Transform Arrow result -> our event/match shape ----
    onProgress({
      stage: 'transform',
      message: 'Building match index…',
      progress: null
    });

    const eventsByMatch = new Map<string, PlayerEvent[]>();
    const matchMeta = new Map<
      string,
      { mapId: MapId; date: string; humans: Set<string>; bots: Set<string>; eventCount: number }
    >();
    const eventTypeSet = new Set<string>();
    const mapSet = new Set<string>();
    const dateSet = new Set<string>();
    let totalEvents = 0;

    for (const row of result.toArray()) {
      const userId = String(row.user_id);
      const matchId = String(row.match_id);
      const mapId = String(row.map_id) as MapId;
      const eventType = decodeEvent(row.event) as EventType;

      // ts in the source is Unix seconds. Some readers surface it as BigInt.
      let ts: number;
      const rawTs = row.ts;
      if (typeof rawTs === 'bigint') ts = Number(rawTs);
      else if (rawTs instanceof Date) ts = Math.floor(rawTs.getTime() / 1000);
      else ts = Number(rawTs);

      const filename = String(row.filename);
      const date = fileToDate.get(filename.replace(/^.*\//, '')) ?? 'Unknown';

      const event: PlayerEvent = {
        user_id: userId,
        match_id: matchId,
        map_id: mapId,
        x: Number(row.x),
        y: Number(row.y),
        z: Number(row.z),
        ts,
        event: eventType
      };

      // Group by match
      let bucket = eventsByMatch.get(matchId);
      if (!bucket) {
        bucket = [];
        eventsByMatch.set(matchId, bucket);
      }
      bucket.push(event);

      // Match metadata
      let meta = matchMeta.get(matchId);
      if (!meta) {
        meta = {
          mapId,
          date,
          humans: new Set<string>(),
          bots: new Set<string>(),
          eventCount: 0
        };
        matchMeta.set(matchId, meta);
      }
      meta.eventCount++;
      if (isHumanPlayer(userId)) meta.humans.add(userId);
      else meta.bots.add(userId);

      // Aggregate sets
      eventTypeSet.add(eventType);
      mapSet.add(mapId);
      dateSet.add(date);
      totalEvents++;
    }

    // Sort each match's events by ts so paths render correctly
    for (const evs of eventsByMatch.values()) {
      evs.sort((a, b) => a.ts - b.ts);
    }

    const matches: MatchInfo[] = Array.from(matchMeta.entries()).map(([matchId, m]) => ({
      matchId,
      mapId: m.mapId,
      date: m.date,
      playerCount: m.humans.size,
      botCount: m.bots.size
    }));
    matches.sort((a, b) => a.date.localeCompare(b.date) || a.matchId.localeCompare(b.matchId));

    onProgress({
      stage: 'done',
      message: `Loaded ${matches.length} matches, ${totalEvents.toLocaleString()} events`,
      progress: 1
    });

    return {
      matches,
      stats: {
        total_events: totalEvents,
        total_matches: matches.length,
        dates: Array.from(dateSet).sort(),
        maps: Array.from(mapSet).sort(),
        event_types: Array.from(eventTypeSet).sort()
      },
      eventsByMatch
    };
  } finally {
    await conn.close();
  }
}
