import type { Hotspot } from '../utils/hotspots';

interface HotspotsPanelProps {
  /** Pre-computed hotspots from the parent — kept in sync with the map's pins. */
  hotspots: Hotspot[];
  /** Hide the panel entirely when there are no events loaded. */
  hasEvents: boolean;
}

/**
 * Auto-summary that surfaces the top kill hotspots in the current match,
 * so a level designer can see the most contested zones without having to
 * scrub the timeline or eyeball the heatmap.
 *
 * Coordinates next to the region label disambiguate the case where multiple
 * hotspots fall in the same coarse region (e.g. two distinct fight zones
 * both inside the central third of the map).
 */
export function HotspotsPanel({ hotspots, hasEvents }: HotspotsPanelProps) {
  if (!hasEvents) return null;

  return (
    <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur p-3 rounded-lg border border-slate-600 shadow-xl text-sm w-56 z-10">
      <div className="flex items-center gap-2 mb-2">
        <svg className="w-4 h-4 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A3 3 0 0112.12 15.12z"
            clipRule="evenodd"
          />
        </svg>
        <span className="font-semibold text-white text-xs uppercase tracking-wider">
          Top Kill Hotspots
        </span>
      </div>

      {hotspots.length === 0 ? (
        <div className="text-slate-400 text-xs">
          No kill clusters in this match.
        </div>
      ) : (
        <ol className="space-y-1.5">
          {hotspots.map((h, i) => (
            <li key={i} className="flex items-center gap-2 text-xs">
              <span
                className={`flex items-center justify-center w-5 h-5 rounded-full font-bold text-[10px] ${
                  i === 0
                    ? 'bg-orange-500/30 text-orange-300 ring-1 ring-orange-400'
                    : i === 1
                      ? 'bg-slate-500/30 text-slate-200 ring-1 ring-slate-400'
                      : 'bg-amber-700/30 text-amber-300 ring-1 ring-amber-600'
                }`}
              >
                {i + 1}
              </span>
              <span className="flex-1 min-w-0 leading-tight">
                <span className="text-slate-200">{h.region}</span>
                <span className="text-slate-500 text-[10px] ml-1 tabular-nums">
                  ({h.worldX}, {h.worldZ})
                </span>
              </span>
              <span className="text-orange-300 font-bold tabular-nums">
                {h.count}
              </span>
              <span className="text-slate-500 text-[10px]">
                {h.count === 1 ? 'kill' : 'kills'}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
