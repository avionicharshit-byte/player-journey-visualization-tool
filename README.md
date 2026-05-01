# Player Journey Visualization Tool

A web-based tool for LILA Games' Level Design team to visualize player behavior in LILA BLACK — paths, kills, deaths, loot, and storm events on top of in-game minimaps, with timeline replay and heatmap overlays.

**Live demo:** _(deployed URL goes here once Vercel is set up)_

## What it does

- Loads telemetry from 5 days of production gameplay (~89k events, 796 matches, 3 maps)
- Renders player journeys on the correct minimap with proper world→pixel coordinate mapping
- Distinguishes **humans** (cyan) from **bots** (orange) at a glance
- Marks **kills**, **deaths**, **loot pickups**, and **storm deaths** with distinct shapes/colors
- **Timeline replay** with play/pause, 0.5x–8x speed, and a draggable scrubber
- **Heatmap overlays** for kills, deaths, or traffic density
- **Filtering** by map, date, match, player type, and event type
- **Event clustering** — overlapping events at the same spot collapse into a count badge so dense fight zones stay readable
- **Pan/zoom** on the map (scroll to zoom, drag to pan)
- **Load custom data in the browser** — drop a `player_data.zip` directly into the UI and it gets parsed entirely client-side via DuckDB-WASM. No server, no upload — your data never leaves the browser.

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
    │   └── preprocess.py        # parquet → JSON
    └── src/
        ├── components/          # MapCanvas, Controls, Timeline, LoadingScreen
        ├── hooks/               # useData
        ├── utils/               # mapConfig (coordinate mapping)
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
