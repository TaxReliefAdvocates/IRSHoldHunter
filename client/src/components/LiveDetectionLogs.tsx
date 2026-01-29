import { useEffect, useState, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';

interface LogEntry {
  timestamp: string;
  callSid: string;
  legId: string;
  type: 'detection' | 'dtmf' | 'status' | 'transfer';
  message: string;
  data?: any;
}

interface LiveDetectionLogsProps {
  jobId: string;
}

export function LiveDetectionLogs({ jobId }: LiveDetectionLogsProps) {
  const { socket } = useSocket();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isVisible, setIsVisible] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!socket) return;

    const handleDetectionLog = (log: LogEntry) => {
      setLogs(prev => [...prev.slice(-50), log]); // Keep last 50 logs
    };

    socket.on('detection-log', handleDetectionLog);

    return () => {
      socket.off('detection-log', handleDetectionLog);
    };
  }, [socket, jobId]);

  useEffect(() => {
    // Auto-scroll to bottom when new logs arrive
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const getLogColor = (type: string) => {
    switch (type) {
      case 'detection':
        return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'dtmf':
        return 'text-purple-700 bg-purple-50 border-purple-200';
      case 'status':
        return 'text-gray-700 bg-gray-50 border-gray-200';
      case 'transfer':
        return 'text-green-700 bg-green-50 border-green-200';
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'detection':
        return '🔍';
      case 'dtmf':
        return '📱';
      case 'status':
        return '📊';
      case 'transfer':
        return '🚀';
      default:
        return '📝';
    }
  };

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium"
      >
        📊 Show AI Detection Logs
      </button>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          🤖 AI Detection Logs
          {logs.length > 0 && (
            <span className="text-sm text-gray-500 font-normal">
              ({logs.length} events)
            </span>
          )}
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => setLogs([])}
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md"
          >
            Clear
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md"
          >
            Hide
          </button>
        </div>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {logs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>Waiting for AI detection events...</p>
            <p className="text-sm mt-1">Logs will appear here as calls are analyzed</p>
          </div>
        ) : (
          logs.map((log, i) => (
            <div
              key={i}
              className={`p-3 rounded-lg border ${getLogColor(log.type)}`}
            >
              <div className="flex items-start gap-2">
                <span className="text-lg">{getLogIcon(log.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-gray-500">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="text-xs font-mono text-gray-400">
                      {log.callSid.slice(-6)}
                    </span>
                  </div>
                  <p className="text-sm font-medium break-words">{log.message}</p>
                  {log.data && (
                    <pre className="text-xs mt-2 p-2 bg-black/5 rounded overflow-x-auto">
                      {JSON.stringify(log.data, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}
