import { useQuery } from "@tanstack/react-query";
import type { ServerStats } from "@shared/schema";

export default function Statistics() {
  const { data: stats } = useQuery({
    queryKey: ['/api/server-stats'],
    refetchInterval: 2000, // Update every 2 seconds
  });

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
        <i className="fas fa-chart-bar text-emerald-600 mr-2"></i>
        Statistics
      </h3>
      
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-600">Total Requests</span>
          <span className="font-semibold text-slate-900">
            {stats?.totalRequests?.toLocaleString() || 0}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-600">Active Connections</span>
          <span className="font-semibold text-emerald-600">
            {stats?.activeConnections || 0}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-600">Data Transferred</span>
          <span className="font-semibold text-slate-900">
            {formatBytes(stats?.dataTransferred || 0)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-600">Errors</span>
          <span className="font-semibold text-red-600">
            {stats?.errors || 0}
          </span>
        </div>
      </div>
    </div>
  );
}
