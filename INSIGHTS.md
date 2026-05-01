# Insights

Three observations from running the visualization over the 5-day production data (796 matches, ~89k events). Numbers below are from a sampled analysis script run against the preprocessed JSON.

---

## 1. PvP is virtually nonexistent — 99.6% of combat is players-vs-bots

**What caught my eye:** Toggling the kill heatmap on AmbroseValley, every single hot zone was tagged with `BotKill`. I couldn't find more than a handful of `Kill` events (human-vs-human) anywhere across the sample.

**Evidence:**
- Across 200 sampled matches:
  - `BotKill` (human or bot killing a bot): **588 events**
  - `Kill` (human killing another human): **2 events**
  - `BotKilled`: 201, `Killed`: 2
- AmbroseValley alone: 455 BotKills vs 1 human Kill.
- Human K/D ratio is **4.45**; bots sit at **0.65** — bots are losing badly to humans, but humans are barely fighting each other.

**Actionable:**
- For an "extraction shooter," this means the core PvP loop isn't engaging. Either matchmaking is funneling humans away from each other, the maps are too large for the current player count per match, or the loot/extraction loop incentivizes avoiding fights. **Affected metrics:** average kills per match, time-to-first-engagement, PvP encounter rate.
- Concrete experiments: shrink the playable area faster, increase player-per-match count, or place high-value loot in choke points to force human-vs-human contact.

**Why a Level Designer should care:** A map that doesn't produce PvP is a map that isn't doing its job. The visualization makes it immediately obvious which routes humans take to *avoid* each other — those routes are the ones to redesign or block off.

---

## 2. GrandRift is being avoided — gets ~10x less traffic than AmbroseValley

**What caught my eye:** When filtering by map, the GrandRift dropdown only had a sparse list of matches compared to AmbroseValley. The traffic heatmap on GrandRift is also almost empty in large sections of the map.

**Evidence:**
- Match counts in sample (200 matches): AmbroseValley **147**, Lockdown **39**, GrandRift **14**.
- GrandRift recorded **zero** storm deaths in the sample, while AmbroseValley had 6 and Lockdown had 4 — players who do play GrandRift aren't even getting caught by the zone.
- Loot per human player is also lowest on GrandRift (12.9 avg) vs AmbroseValley (18.0), suggesting matches there end faster or players engage less.

**Actionable:**
- Investigate whether matchmaking is weighting toward AmbroseValley or whether GrandRift is genuinely unpopular. **Affected metrics:** map play distribution, average match duration per map, retention by map preference.
- If GrandRift is unpopular by player choice, the visualization can pinpoint which areas are being explored vs ignored — those ignored zones are where redesign effort should go first.

**Why a Level Designer should care:** A map that's selected 10x less often than its peers is wasted content. The traffic heatmap on GrandRift will show which zones see any play at all, which directly tells the designer where to prune, redesign, or where to relocate POIs.

---

## 3. Storm rarely closes matches — only 4–7% of deaths come from the zone

**What caught my eye:** I expected the storm-death heatmap to ring the map edges (players caught outside the safe zone). Instead, storm deaths are sparse — single digits per map across hundreds of matches.

**Evidence:**
- Storm-death rate per map (sample):
  - AmbroseValley: 6 / 140 deaths = **4.3%**
  - Lockdown: 4 / 56 deaths = **7.1%**
  - GrandRift: 0 / 17 deaths = **0.0%**
- Average match duration is consistently ~6.5 minutes across all three maps, so the storm closes consistently — but it's not killing anyone.

**Actionable:**
- A storm that kills <5% of players means the zone isn't applying meaningful pressure. Players have plenty of time to rotate. **Affected metrics:** time spent outside safe zone, late-game engagement density, match pacing.
- Tightening storm timing (faster shrink, higher tick damage, or earlier first close) would force players into smaller arenas and likely lift the PvP rate from insight #1 — the two findings are linked.

**Why a Level Designer should care:** The storm is the level designer's only real tool for forcing endgame engagement. If it's not killing anyone, it's not working as intended. The visualization shows exactly where players survive to and where they die — combine "storm death heatmap" with "traffic heatmap" and the unsafe rotations become visible at a glance.
