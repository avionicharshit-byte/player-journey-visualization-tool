import { useCallback, useRef, useState } from 'react';
import type { CustomDataset, ProgressUpdate } from '../utils/parquetLoader';

interface CustomDataLoaderProps {
  isOpen: boolean;
  onClose: () => void;
  onLoaded: (dataset: CustomDataset) => void;
}

export function CustomDataLoader({ isOpen, onClose, onLoaded }: CustomDataLoaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith('.zip')) {
        setError('Please upload a .zip file containing the parquet data.');
        return;
      }

      setError(null);
      setIsLoading(true);
      setProgress({ stage: 'init', message: 'Starting…', progress: null });

      try {
        // Lazy-load: DuckDB-WASM (~30MB) only enters the bundle here.
        const { loadCustomDataset } = await import('../utils/parquetLoader');
        const dataset = await loadCustomDataset(file, update => setProgress(update));
        onLoaded(dataset);
        // Brief pause so user sees the "done" message
        setTimeout(() => {
          setIsLoading(false);
          setProgress(null);
          onClose();
        }, 600);
      } catch (err) {
        console.error('Custom data load failed:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data.');
        setIsLoading(false);
      }
    },
    [onLoaded, onClose]
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-2xl w-full max-w-md p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white">Load Custom Data</h2>
            <p className="text-xs text-slate-400 mt-1">
              Drop a <code className="text-cyan-400">player_data.zip</code> to visualize your own match data.
            </p>
          </div>
          {!isLoading && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white text-xl leading-none"
              aria-label="Close"
            >
              ×
            </button>
          )}
        </div>

        {!isLoading && (
          <>
            <div
              onDragOver={e => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition ${
                isDragging
                  ? 'border-cyan-400 bg-cyan-400/10'
                  : 'border-slate-600 hover:border-slate-500 bg-slate-900/50'
              }`}
            >
              <svg
                className="w-12 h-12 mx-auto mb-3 text-slate-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9 4.5-4.5m0 0 4.5 4.5m-4.5-4.5v12"
                />
              </svg>
              <div className="text-slate-300 font-medium">Drag & drop the zip here</div>
              <div className="text-slate-500 text-xs mt-1">or click to browse</div>
              <input
                ref={inputRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>

            <div className="mt-4 text-xs text-slate-500 space-y-1">
              <div>• Expects parquet files at <code className="text-slate-300">February_XX/*.nakama-0</code></div>
              <div>• Processed entirely in your browser — nothing is uploaded</div>
              <div>• First load takes ~10s while DuckDB-WASM initializes</div>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded text-red-200 text-sm">
                {error}
              </div>
            )}
          </>
        )}

        {isLoading && progress && (
          <div className="py-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              <div className="text-white font-medium">{progress.message}</div>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all ${
                  progress.progress === null
                    ? 'bg-cyan-400 w-1/3 animate-pulse'
                    : 'bg-cyan-400'
                }`}
                style={
                  progress.progress !== null
                    ? { width: `${Math.round(progress.progress * 100)}%` }
                    : undefined
                }
              />
            </div>
            <div className="text-xs text-slate-500 mt-2 capitalize">Stage: {progress.stage}</div>
          </div>
        )}
      </div>
    </div>
  );
}
