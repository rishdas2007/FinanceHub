// Global error boundary with API debugging
export function ApiDebugger({ error, queryKey }: { error: any; queryKey: any }) {
  if (process.env.NODE_ENV !== 'development') return null;

  return (
    <div className="bg-red-900/20 border border-red-500 p-4 rounded mt-4">
      <h4 className="text-red-400 font-bold">API Debug Info</h4>
      <p><strong>Query:</strong> {Array.isArray(queryKey) ? queryKey.join(' ') : queryKey}</p>
      <p><strong>Error:</strong> {error?.message}</p>
      <details className="mt-2">
        <summary className="cursor-pointer">Full Error</summary>
        <pre className="text-xs bg-gray-800 p-2 rounded mt-2 overflow-auto">
          {JSON.stringify(error, null, 2)}
        </pre>
      </details>
    </div>
  );
}