interface StatusBadgeProps {
  status: string;
  isWinner?: boolean;
}

const statusColors: Record<string, string> = {
  DIALING: 'bg-blue-100 text-blue-800',
  RINGING: 'bg-purple-100 text-purple-800',
  ANSWERED: 'bg-green-100 text-green-800',
  IVR: 'bg-yellow-100 text-yellow-800',
  HOLDING: 'bg-orange-100 text-orange-800',
  LIVE: 'bg-red-100 text-red-800',
  TRANSFERRED: 'bg-emerald-100 text-emerald-800',
  ENDED: 'bg-gray-100 text-gray-800',
  FAILED: 'bg-red-100 text-red-800',
  CREATED: 'bg-gray-100 text-gray-800',
  RUNNING: 'bg-blue-100 text-blue-800',
  STOPPED: 'bg-gray-100 text-gray-800',
};

export function StatusBadge({ status, isWinner }: StatusBadgeProps) {
  const colorClass = statusColors[status] || 'bg-gray-100 text-gray-800';
  
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}
    >
      {isWinner && <span className="text-yellow-500">🏆</span>}
      {status}
    </span>
  );
}
