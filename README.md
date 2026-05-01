# Player Journey Visualization Tool

A web-based tool for LILA Games' Level Design team to visualize player behavior in LILA BLACK — paths, kills, deaths, loot, and storm events on top of in-game minimaps, with timeline replay and heatmap overlays.

**Live demo:** _https://player-journey-visualization-t-git-579539-harshit-devs-projects.vercel.app?_vercel_share=L61c5IVQcLplqIuxsJ5ulYo49zlV0rSr_

## How a Level Designer would use this in 2 minutes

1. **Open the deployed URL.** The app auto-loads a sample match so you see player paths immediately — no setup, no "Select a Match" empty state.
2. **Glance at the Hotspots panel (bottom-left).** It auto-detects the top 3 kill clusters in the loaded match and labels them by region (Center, NE, SW…). This is your "where did people die the most" answer in one look.
3. **Toggle a heatmap.** In the sidebar, flip "Kills" / "Deaths" / "Traffic" on to see density layers across the whole map. Compare these against the map's intended chokepoints.
4. **Press play on the timeline.** Watch the match unfold — path lines draw themselves and events pop in chronologically. Drag the scrubber to skip to a specific moment, or set 4x speed for a fast read.
5. **Switch maps/dates/matches** in the left sidebar to compare. Selecting a new match auto-snaps the map filter to that match's map. Try filtering to only humans or only bots to see how the two populations behave differently.
6. **Want your own data?** Click "Load Custom Data" in the sidebar and drop any `player_data.zip`. Files are parsed locally with DuckDB-WASM — nothing leaves the browser.

## What it does

- Loads telemetry from 5 days of production gameplay (~89k events, 796 matches, 3 maps)
- Renders player journeys on the correct minimap with proper world→pixel coordinate mapping
- Distinguishes **humans** (cyan) from **bots** (orange) at a glance
- Marks **kills**, **deaths**, **loot pickups**, and **storm deaths** with distinct shapes/colors
- **Timeline replay** with play/pause, 0.5x–8x speed, and a draggable scrubber
- **Heatmap overlays** for kills, deaths, or traffic density
- **Filtering** by map, date, match, player type, and event type
- **Event clustering** — overlapping events at the same spot collapse into a count badge so dense fight zones stay readable
- **Hotspots auto-summary** — top 3 densest kill clusters surfaced automatically with a region label (no need to scrub the timeline to find the action)
- **Pan/zoom** on the map (scroll to zoom, drag to pan)
- **Load custom data in the browser** — drop any `player_data.zip` into the UI and it's parsed entirely client-side via DuckDB-WASM. No server, no upload — your data never leaves the browser. Works for any month/date folders, not just `February_XX`.

## Tech stack

| Layer | Tool |
|---|---|
| Frontend | React 19 + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS v4 |
| Rendering | HTML Canvas 2D API |
| Data prep (offline) | Python 3 + pyarrow (run via `uv`) |
| Data prep (in-browser, optional) | DuckDB-WASM + JSZip (lazy-loaded) |
| Hosting | Vercel (static) |

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full breakdown of decisions and tradeoffs.

## Repo layout

```
lila-games/
├── ARCHITECTURE.md              # one-page architecture doc
├── INSIGHTS.md                  # 3 game insights from the data
├── README.md                    # this file
├── docs/
│   └── player-journey-visualization-tool.pdf
└── visualization-tool/
    ├── public/
    │   ├── minimaps/            # the 3 map images
    │   └── data/                # preprocessed JSON (committed)
    ├── scripts/
    │   └── preprocess.py        # parquet → JSON (offline path)
    └── src/
        ├── components/          # MapCanvas, Controls, Timeline,
        │                        # LoadingScreen, CustomDataLoader
        ├── hooks/               # useData
        ├── utils/               # mapConfig, parquetLoader (DuckDB-WASM)
        └── types/
```

## Setup

### Prerequisites
- Node.js 18+
- (For preprocessing only) [`uv`](https://github.com/astral-sh/uv) — used because system pip was broken on the dev machine; `pip install pyarrow pandas` also works if you prefer.

### Run locally

```bash
cd visualization-tool
npm install
npm run dev
```

Open http://localhost:5173.

### Re-run the data preprocessing (only needed if raw parquet changes)

The preprocessed JSON is checked into `visualization-tool/public/data/`, so the app works out of the box. To regenerate from raw parquet:

```bash
# Place raw data under visualization-tool/public/data/{February_10..14}/...
cd visualization-tool
uv run --with pyarrow --with pandas scripts/preprocess.py
```

This produces:
- `public/data/matches.json` — match index
- `public/data/stats.json` — aggregate counts
- `public/data/matches/{id}.json` — one file per match (lazy-loaded)

### Use your own data (no preprocessing needed)

The app has a **"Load Custom Data"** button in the sidebar. Click it and drop a `player_data.zip` — the file is unzipped, every parquet is parsed in the browser via DuckDB-WASM (loaded lazily from CDN on first click), and the result is fed into the same renderer.

- **Any month works.** The loader uses each file's parent folder as the date label, so `February_10/`, `January_05/`, `2026-04-12/`, etc. all populate the Date dropdown automatically.
- **macOS-zipped files are fine.** AppleDouble metadata (`__MACOSX/`, `._<name>`) is filtered out before parsing.
- **Map constraint.** The minimap images shipped in this repo cover the three known maps in LILA BLACK (AmbroseValley, GrandRift, Lockdown). A custom dataset that references a different `map_id` will load correctly but won't render on a matching minimap until you add the image to `public/minimaps/` and the config to `src/utils/mapConfig.ts`.
- **Nothing leaves your browser.** No server upload, no telemetry — pure client-side processing.

### Build for production

```bash
npm run build       # outputs to dist/
npm run preview     # serve the build locally
```

### Environment variables

None. The app is entirely client-side and reads static JSON.

## Deployment

The app is deployed to Vercel. Any push to `master` auto-deploys. Configuration:
- Root directory: `visualization-tool`
- Build command: `npm run build`
- Output directory: `dist`

## Notes for the reviewer

- **Coordinate mapping** is documented in `ARCHITECTURE.md`. The Y-axis flip (`pixelY = (1 - v) * MAP_SIZE`) is the easy-to-miss part.
- **Bot detection** is by user_id format: UUIDs = humans, numeric strings = bots.
- **Some matches contain no `BotPosition` events** — bots in those matches only appear via kill/death events, so their paths aren't drawn.
- The repo includes preprocessed JSON, so you can `npm install && npm run dev` without needing the raw parquet zip.
- If you want to point the tool at a different dataset without rebuilding, use the **Load Custom Data** button instead of re-running the Python script. It accepts any `player_data.zip` regardless of month, parses it in the browser, and swaps the in-memory dataset. Hit "Reset to bundled data" in the sidebar to switch back.
