#!/usr/bin/env python3
"""
Preprocess parquet files into JSON for the visualization tool.
Run this script before building the React app.
"""

import os
import json
import pyarrow.parquet as pq
from pathlib import Path
from collections import defaultdict

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
DATA_SOURCE = PROJECT_ROOT / "public" / "data"
OUTPUT_DIR = PROJECT_ROOT / "public" / "data"

DATES = ["February_10", "February_11", "February_12", "February_13", "February_14"]

def is_human(user_id: str) -> bool:
    """Check if user_id is a human (UUID) or bot (numeric)."""
    return "-" in user_id

def process_all_data():
    """Process all parquet files and create JSON outputs."""

    all_events = []
    matches = defaultdict(lambda: {
        "players": set(),
        "bots": set(),
        "map_id": None,
        "date": None,
        "event_count": 0
    })

    print("Processing parquet files...")

    for date in DATES:
        date_dir = DATA_SOURCE / date
        if not date_dir.exists():
            print(f"  Skipping {date} - directory not found")
            continue

        files = list(date_dir.glob("*.nakama-0"))
        print(f"  {date}: {len(files)} files")

        for filepath in files:
            try:
                table = pq.read_table(filepath)
                df = table.to_pandas()

                for _, row in df.iterrows():
                    user_id = str(row["user_id"])
                    match_id = str(row["match_id"])
                    map_id = str(row["map_id"])

                    # Decode event if bytes
                    event = row["event"]
                    if isinstance(event, bytes):
                        event = event.decode("utf-8")

                    # Convert timestamp
                    ts = row["ts"]
                    if hasattr(ts, "timestamp"):
                        ts_ms = int(ts.timestamp() * 1000)
                    else:
                        ts_ms = int(ts)

                    event_record = {
                        "u": user_id,
                        "m": match_id,
                        "map": map_id,
                        "x": round(float(row["x"]), 2),
                        "y": round(float(row["y"]), 2),
                        "z": round(float(row["z"]), 2),
                        "t": ts_ms,
                        "e": event
                    }
                    all_events.append(event_record)

                    # Track match info
                    matches[match_id]["map_id"] = map_id
                    matches[match_id]["date"] = date
                    matches[match_id]["event_count"] += 1

                    if is_human(user_id):
                        matches[match_id]["players"].add(user_id)
                    else:
                        matches[match_id]["bots"].add(user_id)

            except Exception as e:
                print(f"    Error processing {filepath.name}: {e}")
                continue

    print(f"\nTotal events: {len(all_events)}")
    print(f"Total matches: {len(matches)}")

    # Create output directory
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Sort events by match_id and timestamp
    all_events.sort(key=lambda x: (x["m"], x["t"]))

    # Save all events
    events_file = OUTPUT_DIR / "events.json"
    print(f"\nWriting {events_file}...")
    with open(events_file, "w") as f:
        json.dump(all_events, f)

    # Create match index
    match_index = []
    for match_id, info in matches.items():
        match_index.append({
            "id": match_id,
            "map": info["map_id"],
            "date": info["date"],
            "players": len(info["players"]),
            "bots": len(info["bots"]),
            "events": info["event_count"]
        })

    # Sort by date and match_id
    match_index.sort(key=lambda x: (x["date"], x["id"]))

    matches_file = OUTPUT_DIR / "matches.json"
    print(f"Writing {matches_file}...")
    with open(matches_file, "w") as f:
        json.dump(match_index, f, indent=2)

    # Create per-match files for efficient loading
    print("\nCreating per-match event files...")
    matches_dir = OUTPUT_DIR / "matches"
    matches_dir.mkdir(exist_ok=True)

    # Group events by match
    events_by_match = defaultdict(list)
    for event in all_events:
        events_by_match[event["m"]].append(event)

    for match_id, events in events_by_match.items():
        # Use a safe filename
        safe_id = match_id.replace(".nakama-0", "").replace("/", "_")
        match_file = matches_dir / f"{safe_id}.json"
        with open(match_file, "w") as f:
            json.dump(events, f)

    print(f"Created {len(events_by_match)} match files")

    # Summary stats
    stats = {
        "total_events": len(all_events),
        "total_matches": len(matches),
        "dates": DATES,
        "maps": list(set(m["map_id"] for m in matches.values() if m["map_id"])),
        "event_types": list(set(e["e"] for e in all_events))
    }

    stats_file = OUTPUT_DIR / "stats.json"
    with open(stats_file, "w") as f:
        json.dump(stats, f, indent=2)

    print(f"\nDone! Output written to {OUTPUT_DIR}")
    print(f"  - events.json ({events_file.stat().st_size / 1024 / 1024:.2f} MB)")
    print(f"  - matches.json")
    print(f"  - stats.json")
    print(f"  - matches/*.json ({len(events_by_match)} files)")

if __name__ == "__main__":
    process_all_data()
