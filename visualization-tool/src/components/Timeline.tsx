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
    if (matchDuration === 0) return '00:00';
    const ms = matchDuration * progress;
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`bg-slate-800 border-t border-slate-700 p-4 ${disabled ? 'opacity-60' : ''}`}>
      {disabled && (
        <div className="text-center text-slate-500 text-sm mb-2">
          Select a match to enable playback controls
        </div>
      )}
      <div className="flex items-center gap-4">
        {/* Play/Pause Button */}
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          disabled={disabled}
          className="w-10 h-10 flex items-center justify-center bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 rounded-full text-white transition"
        >
          {isPlaying ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
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
          className="w-8 h-8 flex items-center justify-center bg-slate-700 hover:bg-slate-600 disabled:bg-slate-700 rounded text-white text-sm transition"
        >
          ↺
        </button>

        {/* Time Display */}
        <div className="text-sm text-slate-300 w-28 text-center font-mono">
          {currentTime === 0 ? 'Full view' : `${formatTime(currentTime)} / ${formatTime(1)}`}
        </div>

        {/* Progress Slider */}
        <div className="flex-1">
          <input
            type="range"
            min="0"
            max="1"
            step="0.001"
            value={currentTime}
            onChange={e => setCurrentTime(parseFloat(e.target.value))}
            disabled={disabled}
            className="w-full"
          />
        </div>

        {/* Speed Control */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">Speed:</span>
          <select
            value={playbackSpeed}
            onChange={e => setPlaybackSpeed(parseFloat(e.target.value))}
            disabled={disabled}
            className="bg-slate-700 text-white text-sm rounded px-2 py-1"
          >
            <option value="0.5">0.5x</option>
            <option value="1">1x</option>
            <option value="2">2x</option>
            <option value="4">4x</option>
            <option value="8">8x</option>
          </select>
        </div>

        {/* Progress Percentage */}
        <div className="text-sm text-slate-400 w-12 text-right">
          {Math.round(currentTime * 100)}%
        </div>
      </div>
    </div>
  );
}
