# Architecture

## Tech stack & why

| Layer | Choice | Why |
|---|---|---|
| Frontend framework | React 19 + TypeScript | Type safety on event data, fast iteration, familiar to anyone reading the code. |
| Build tool | Vite | Instant HMR, no config needed for TS/React, smaller bundle than CRA. |
| Styling | Tailwind CSS v4 | Utility-first lets us iterate UI without context-switching to CSS files; ships only what we use. |
| Rendering | HTML Canvas 2D API | We're drawing thousands of moving points/paths every frame. DOM/SVG would choke at this density; WebGL is overkill for 2D top-down maps. |
| Data preprocessing (offline) | Python + pyarrow (`uv run`) | Pyarrow is the canonical parquet reader and it's stable. We tried JS-side parquet first (see tradeoffs below). |
| Data preprocessing (in-browser, optional) | DuckDB-WASM + JSZip | Lazy-loaded via dynamic `import()` so it stays out of the main bundle. Lets a reviewer drop a `player_data.zip` straight into the UI and inspect their own data without ever running the Python script. |
| Hosting | Vercel | Static build + free tier + GitHub auto-deploy. The whole app is just static files + JSON. |

### Why not Three.js
Initial instinct was Three.js because "game data". But the telemetry is fundamentally 2D — events have `(x, y, z)` but `y` is just elevation that we don't visualize. Everything renders as `(x, z)` projected onto a top-down minimap image. A 3D engine would add WebGL setup, scene/camera/material boilerplate, and a steeper learning curve for anyone maintaining this — for zero visual benefit. Canvas 2D is the right tool: simple API, fast enough for 89k events, and trivial to add pan/zoom/clustering on top.

## Data flow

```
parquet files (1,243 files, ~89k events)
        │
        │  scripts/preprocess.py  (run once, locally)
        ▼
public/data/
   ├── matches.json          ← list of 796 matches with metadata
   ├── stats.json            ← aggregate counts (events, dates, maps)
   └── matches/{id}.json     ← per-match event arrays (one file per match)
        │
        │  fetch() on demand
        ▼
useData hook  (in-memory cache)
        │
        ▼
MapCanvas  ──>  worldToPixel()  ──>  Canvas 2D draw calls
                                         │
                                         ├─ player paths (lines)
                                         ├─ event markers (kills/deaths/loot/storm)
                                         ├─ event clusters (when overlapping)
                                         └─ heatmap overlay (grid-based density)
```

**Why split into per-match files?** A level designer looks at one match at a time. Loading all 89k events upfront would be wasteful — the match index (`matches.json`, ~50KB) is enough to populate filters. Per-match JSON files (avg 10–25KB) are fetched only when selected, then cached in memory. This keeps the initial page load under 100KB.

### Optional in-browser path (custom data upload)

The app also exposes a "Load Custom Data" button. When a reviewer drops a `player_data.zip` in:

1. **JSZip** unzips the archive and finds files matching `February_XX/*.nakama-0`.
2. Each parquet buffer is registered into **DuckDB-WASM**'s virtual filesystem via `registerFileBuffer`.
3. A single `read_parquet([...], filename = true)` query streams every event out as Arrow rows.
4. The rows are transformed into the same in-memory shape `useData` already uses, so the rest of the app (MapCanvas, Timeline, heatmaps, clustering) doesn't need to know whether data came from the bundle or the upload.

The DuckDB-WASM module (~30MB) is fetched from JsDelivr CDN on demand and the loader code is split into its own chunk via dynamic `import()` — neither lands in the main bundle.

## Coordinate mapping (the tricky part)

Each map has its own world-space scale and origin (from the README):

```
AmbroseValley: scale=900,  origin=(-370, -473)
GrandRift:     scale=581,  origin=(-290, -290)
Lockdown:      scale=1000, origin=(-500, -500)
```

World coords → minimap pixels:

```ts
u = (x - originX) / scale          // normalize to [0, 1]
v = (z - originZ) / scale          // normalize to [0, 1]
pixelX = u * MAP_SIZE              // MAP_SIZE = 1024 (minimap image size)
pixelY = (1 - v) * MAP_SIZE        // flip Y: world Z increases upward, screen Y increases downward
```

The flip on the Y axis is the part that bites you if you're not careful — game world `z` typically grows northward, but canvas `y` grows downward. Forgetting `(1 - v)` gives you a vertically mirrored map, which looks plausibly correct until you compare to the reference minimap.

## Assumptions / data quirks handled

- **Human vs bot detection.** Human `user_id`s are UUIDs (`83c5efb7-cd21-...`), bots are numeric strings (`"1416"`). We split on the presence of `-`. Documented in `isHumanPlayer()`.
- **Match IDs have a `.nakama-0` suffix.** Stripped when used as a filename so we don't have dots breaking file paths.
- **Some matches have no `BotPosition` events** — the bots only show up in `BotKill`/`BotKilled` events for those. We render those bots only as event markers, not paths.
- **Timestamps are Unix seconds, not ms.** Initial code treated them as ms and showed `00:00`. Confirmed by inspecting raw data (`t: 1770760465`).
- **Loot events fire repeatedly at the same coords** (player picking up multiple items). We dedupe visually via clustering (events within ~18px collapse into a count badge).

## Major tradeoffs

| Decision | Considered | Picked | Reason |
|---|---|---|---|
| Parse parquet in browser vs preprocess | DuckDB-WASM, parquet-wasm | Python + pyarrow → static JSON | We tried both JS options. `parquet-wasm` had ESM/build issues; `@duckdb/node-api` had API drift. Pyarrow just works. JSON is also smaller after gzip than the raw parquet for our data size. |
| DuckDB-WASM in browser for analytical queries | — | Skipped | Right tool for millions of rows; for 89k pre-aggregated events split across 796 files, plain JSON + JS filtering is faster and simpler. |
| Canvas 2D vs Three.js vs SVG | Three.js, SVG/D3 | Canvas 2D | 2D data, thousands of markers per frame, no need for shaders. SVG hits DOM limits past ~1k nodes. |
| Heatmap: per-pixel imageData vs grid cells | Per-pixel kernel density | Grid-based (20px cells) with radial gradients | imageData was visually messy and slow. Grid gives clean, readable hot zones at the cost of fine resolution we don't need. |
| Event clustering | Render every marker | Spatial clustering with count badges | At dense fight zones, kills/deaths/loot stack on top of each other and become unreadable. Clusters with mixed-color rings show what's there at a glance; zoom in to expand. |
| Bundle one big JSON vs per-match JSON | Single 12MB matches.json | Per-match files + small index | Lazy-loading per match keeps the first paint fast and respects Vercel's static asset caching. |
