
interface LoadingScreenProps {
  message?: string;
  error?: string | null;
}

export function LoadingScreen({ message = 'Loading...', error }: LoadingScreenProps) {
  if (error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900">
        <div className="text-red-400 text-xl mb-4">Error Loading Data</div>
        <div className="text-slate-400 text-center max-w-md px-4">{error}</div>
        <div className="mt-6 text-slate-500 text-sm">
          Make sure to run the preprocessing script:
          <pre className="mt-2 bg-slate-800 px-4 py-2 rounded">
            cd scripts && python preprocess.py
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900">
      <div className="relative w-16 h-16 mb-6">
        <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-transparent border-t-blue-500 rounded-full animate-spin"></div>
      </div>
      <div className="text-slate-300 text-lg">{message}</div>
      <div className="text-slate-500 text-sm mt-2">LILA BLACK Player Journey Visualization</div>
    </div>
  );
}
