#!/usr/bin/env node
/**
 * Preprocess parquet files into JSON for the visualization tool.
 * Run: node scripts/preprocess.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import duckdb from '@duckdb/node-api';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCRIPT_DIR = __dirname;
const PROJECT_ROOT = path.dirname(SCRIPT_DIR);
const DATA_SOURCE = path.join(PROJECT_ROOT, 'public', 'data');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'public', 'data');
const DATES = ['February_10', 'February_11', 'February_12', 'February_13', 'February_14'];

function isHuman(userId) {
  return userId.includes('-');
}

async function main() {
  console.log('Initializing DuckDB...');

  const instance = await duckdb.DuckDBInstance.create(':memory:');
  const connection = await instance.connect();

  const allEvents = [];
  const matches = new Map();

  console.log('Processing parquet files...');

  for (const date of DATES) {
    const dateDir = path.join(DATA_SOURCE, date);
    if (!fs.existsSync(dateDir)) {
      console.log(`  Skipping ${date} - directory not found`);
      continue;
    }

    const files = fs.readdirSync(dateDir).filter(f => f.endsWith('.nakama-0'));
    console.log(`  ${date}: ${files.length} files`);

    let processed = 0;
    for (const file of files) {
      try {
        const filepath = path.join(dateDir, file);

        const result = await connection.run(`
          SELECT
            user_id::VARCHAR as user_id,
            match_id::VARCHAR as match_id,
            map_id::VARCHAR as map_id,
            x::DOUBLE as x,
            y::DOUBLE as y,
            z::DOUBLE as z,
            epoch_ms(ts) as ts,
            event::VARCHAR as event
          FROM read_parquet('${filepath}')
        `);

        // Get columns
        const numRows = result.rowCount;
        const columns = result.getColumns();

        for (let i = 0; i < numRows; i++) {
          const userId = String(columns[0].getItem(i));
          const matchId = String(columns[1].getItem(i));
          const mapId = String(columns[2].getItem(i));
          let event = columns[7].getItem(i);

          const eventRecord = {
            u: userId,
            m: matchId,
            map: mapId,
            x: Math.round(Number(columns[3].getItem(i)) * 100) / 100,
            y: Math.round(Number(columns[4].getItem(i)) * 100) / 100,
            z: Math.round(Number(columns[5].getItem(i)) * 100) / 100,
            t: Number(columns[6].getItem(i)),
            e: String(event)
          };
          allEvents.push(eventRecord);

          // Track match info
          if (!matches.has(matchId)) {
            matches.set(matchId, {
              map_id: mapId,
              date: date,
              players: new Set(),
              bots: new Set(),
              event_count: 0
            });
          }

          const matchInfo = matches.get(matchId);
          matchInfo.event_count++;

          if (isHuman(userId)) {
            matchInfo.players.add(userId);
          } else {
            matchInfo.bots.add(userId);
          }
        }

        processed++;
        if (processed % 100 === 0) {
          console.log(`    Processed ${processed}/${files.length} files...`);
        }
      } catch (e) {
        console.log(`    Error processing ${file}: ${e.message}`);
      }
    }
    console.log(`    Completed ${processed} files`);
  }

  console.log(`\nTotal events: ${allEvents.length}`);
  console.log(`Total matches: ${matches.size}`);

  // Create output directory
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.mkdirSync(path.join(OUTPUT_DIR, 'matches'), { recursive: true });

  // Sort events
  allEvents.sort((a, b) => {
    if (a.m !== b.m) return a.m.localeCompare(b.m);
    return a.t - b.t;
  });

  // Save all events
  console.log('\nWriting events.json...');
  fs.writeFileSync(path.join(OUTPUT_DIR, 'events.json'), JSON.stringify(allEvents));

  // Create match index
  const matchIndex = [];
  for (const [matchId, info] of matches) {
    matchIndex.push({
      id: matchId,
      map: info.map_id,
      date: info.date,
      players: info.players.size,
      bots: info.bots.size,
      events: info.event_count
    });
  }
  matchIndex.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.id.localeCompare(b.id);
  });

  fs.writeFileSync(path.join(OUTPUT_DIR, 'matches.json'), JSON.stringify(matchIndex, null, 2));

  // Create per-match files
  console.log('Creating per-match event files...');
  const eventsByMatch = new Map();
  for (const event of allEvents) {
    if (!eventsByMatch.has(event.m)) {
      eventsByMatch.set(event.m, []);
    }
    eventsByMatch.get(event.m).push(event);
  }

  for (const [matchId, events] of eventsByMatch) {
    const safeId = matchId.replace('.nakama-0', '').replace(/\//g, '_');
    fs.writeFileSync(path.join(OUTPUT_DIR, 'matches', `${safeId}.json`), JSON.stringify(events));
  }

  // Stats
  const stats = {
    total_events: allEvents.length,
    total_matches: matches.size,
    dates: DATES,
    maps: [...new Set([...matches.values()].map(m => m.map_id))],
    event_types: [...new Set(allEvents.map(e => e.e))]
  };
  fs.writeFileSync(path.join(OUTPUT_DIR, 'stats.json'), JSON.stringify(stats, null, 2));

  console.log(`\nDone! Output written to ${OUTPUT_DIR}`);
}

main().catch(console.error);
