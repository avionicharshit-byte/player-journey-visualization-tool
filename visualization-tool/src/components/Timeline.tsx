import React, { useEffect, useRef } from 'react';

interface TimelineProps {
  currentTime: number;
  setCurrentTime: React.Dispatch<React.SetStateAction<number>>;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  playbackSpeed: number;
  setPlaybackSpeed: (speed: number) => void;
  matchDuration: number; // in milliseconds
  disabled: boolean;
}

export function Timeline({
  currentTime,
  setCurrentTime,
  isPlaying,
  setIsPlaying,
  playbackSpeed,
  setPlaybackSpeed,
  matchDuration,
  disabled
}: TimelineProps) {
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!isPlaying || disabled) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    lastTimeRef.current = performance.now();

    function animate(timestamp: number) {
      const deltaTime = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      // Calculate progress increment based on playback speed
      // At 1x speed, we want to complete the match in ~30 seconds for better visualization
      const targetDuration = 30000 / playbackSpeed; // 30 seconds at 1x
      const increment = deltaTime / targetDuration;

      setCurrentTime(prev => {
        const newTime = prev + increment;
        if (newTime >= 1) {
          setIsPlaying(false);
          return 1;
        }
        return newTime;
      });

      animationRef.current = requestAnimationFrame(animate);
    }

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, disabled, setCurrentTime, setIsPlaying]);

  const formatTime = (progress: number) => {
    if (matchDuration === 0) return '--:--';
    // matchDuration is in seconds (Unix timestamp difference)
    const totalSeconds = Math.floor(matchDuration * progress);
    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle play button - auto-reset if at the end
  const handlePlayClick = () => {
    if (currentTime >= 1) {
      // If at the end, reset to beginning and start playing
      setCurrentTime(0.001); // Start from beginning (not 0 to trigger timeline mode)
      setIsPlaying(true);
    } else if (currentTime === 0) {
      // If at full view (0), start from beginning
      setCurrentTime(0.001);
      setIsPlaying(true);
    } else {
      // Toggle play/pause
      setIsPlaying(!isPlaying);
    }
  };

  const isCompleted = currentTime >= 1;

  return (
    <div className={`flex-shrink-0 ${disabled ? 'opacity-50' : ''}`}>
      {/* Player Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
            </svg>
            <span className="text-white font-semibold text-sm">Match Replay</span>
          </div>
          {!disabled && (
            <span className="text-white/80 text-xs">
              {isCompleted ? 'Completed - Press play to restart' : isPlaying ? 'Playing...' : currentTime === 0 ? 'Full match view' : 'Paused'}
            </span>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="bg-slate-800 border-t-2 border-blue-500 p-4">
        {disabled && (
          <div className="text-center text-slate-400 text-sm mb-3 flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            Select a match from the sidebar to watch the replay
          </div>
        )}

        <div className="flex items-center gap-4">
          {/* Play/Pause Button - Large and prominent */}
          <button
            onClick={handlePlayClick}
            disabled={disabled}
            className={`w-14 h-14 flex items-center justify-center rounded-full text-white transition-all transform hover:scale-105 shadow-lg ${
              disabled
                ? 'bg-slate-600 cursor-not-allowed'
                : isPlaying
                  ? 'bg-orange-500 hover:bg-orange-400 ring-4 ring-orange-500/30'
                  : isCompleted
                    ? 'bg-green-500 hover:bg-green-400 ring-4 ring-green-500/30 animate-pulse'
                    : 'bg-blue-500 hover:bg-blue-400 ring-4 ring-blue-500/30'
            }`}
          >
            {isPlaying ? (
              <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            ) : isCompleted ? (
              <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-7 h-7 ml-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
            )}
          </button>

          {/* Reset Button */}
          <button
            onClick={() => {
              setIsPlaying(false);
              setCurrentTime(0);
            }}
            disabled={disabled}
            className="w-10 h-10 flex items-center justify-center bg-slate-700 hover:bg-slate-600 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg text-white text-lg transition border border-slate-600 hover:border-slate-500"
            title="Reset to full view"
          >
            ↺
          </button>

          {/* Time Display */}
          <div className="bg-slate-900 rounded-lg px-4 py-2 border border-slate-600">
            <div className="text-xs text-slate-400 mb-0.5">Time</div>
            <div className="text-sm text-white font-mono font-bold">
              {currentTime === 0 ? 'Full view' : `${formatTime(currentTime)} / ${formatTime(1)}`}
            </div>
          </div>

          {/* Progress Slider */}
          <div className="flex-1 px-2">
            <input
              type="range"
              min="0"
              max="1"
              step="0.001"
              value={currentTime}
              onChange={e => setCurrentTime(parseFloat(e.target.value))}
              disabled={disabled}
              className="w-full h-3 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              style={{
                background: disabled
                  ? '#374151'
                  : `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${currentTime * 100}%, #374151 ${currentTime * 100}%, #374151 100%)`
              }}
            />
          </div>

          {/* Speed Control */}
          <div className="bg-slate-900 rounded-lg px-3 py-2 border border-slate-600">
            <div className="text-xs text-slate-400 mb-0.5">Speed</div>
            <select
              value={playbackSpeed}
              onChange={e => setPlaybackSpeed(parseFloat(e.target.value))}
              disabled={disabled}
              className="bg-transparent text-white text-sm font-bold focus:outline-none cursor-pointer disabled:cursor-not-allowed"
            >
              <option value="0.5" className="bg-slate-800">0.5x</option>
              <option value="1" className="bg-slate-800">1x</option>
              <option value="2" className="bg-slate-800">2x</option>
              <option value="4" className="bg-slate-800">4x</option>
              <option value="8" className="bg-slate-800">8x</option>
            </select>
          </div>

          {/* Progress Percentage */}
          <div className="bg-slate-900 rounded-lg px-4 py-2 border border-slate-600 min-w-[70px] text-center">
            <div className="text-xs text-slate-400 mb-0.5">Progress</div>
            <div className="text-sm text-white font-bold">
              {Math.round(currentTime * 100)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
