#!/usr/bin/env node
/**
 * Preprocess parquet files into JSON for the visualization tool.
 * Run: node scripts/preprocess.js
 * Requires: npm install parquet-wasm
 */

const fs = require('fs');
const path = require('path');

// Try to use parquet-wasm, otherwise provide instructions
async function main() {
  let parquet;
  try {
    parquet = require('parquet-wasm');
  } catch (e) {
    console.log('parquet-wasm not installed. Installing...');
    const { execSync } = require('child_process');
    execSync('npm install parquet-wasm', { stdio: 'inherit' });
    parquet = require('parquet-wasm');
  }

  await parquet.initAsync();

  const SCRIPT_DIR = __dirname;
  const PROJECT_ROOT = path.dirname(SCRIPT_DIR);
  const DATA_SOURCE = path.join(PROJECT_ROOT, '..', 'doc', 'player_data');
  const OUTPUT_DIR = path.join(PROJECT_ROOT, 'public', 'data');
  const DATES = ['February_10', 'February_11', 'February_12', 'February_13', 'February_14'];

  function isHuman(userId) {
    return userId.includes('-');
  }

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

    for (const file of files) {
      try {
        const filepath = path.join(dateDir, file);
        const buffer = fs.readFileSync(filepath);
        const table = parquet.readParquet(buffer);

        const numRows = table.numRows;
        const columns = {
          user_id: table.getColumnVector('user_id'),
          match_id: table.getColumnVector('match_id'),
          map_id: table.getColumnVector('map_id'),
          x: table.getColumnVector('x'),
          y: table.getColumnVector('y'),
          z: table.getColumnVector('z'),
          ts: table.getColumnVector('ts'),
          event: table.getColumnVector('event')
        };

        for (let i = 0; i < numRows; i++) {
          const userId = String(columns.user_id.get(i));
          const matchId = String(columns.match_id.get(i));
          const mapId = String(columns.map_id.get(i));

          let event = columns.event.get(i);
          if (event instanceof Uint8Array) {
            event = new TextDecoder().decode(event);
          }

          let ts = columns.ts.get(i);
          if (typeof ts === 'bigint') {
            ts = Number(ts);
          }

          const eventRecord = {
            u: userId,
            m: matchId,
            map: mapId,
            x: Math.round(Number(columns.x.get(i)) * 100) / 100,
            y: Math.round(Number(columns.y.get(i)) * 100) / 100,
            z: Math.round(Number(columns.z.get(i)) * 100) / 100,
            t: ts,
            e: event
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
      } catch (e) {
        console.log(`    Error processing ${file}: ${e.message}`);
      }
    }
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
  console.log(`  - events.json`);
  console.log(`  - matches.json`);
  console.log(`  - stats.json`);
  console.log(`  - matches/*.json (${eventsByMatch.size} files)`);
}

main().catch(console.error);
