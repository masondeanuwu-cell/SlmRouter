import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { RequestLog } from "@shared/schema";

export default function RequestLogs() {
  const [isPaused, setIsPaused] = useState(false);
  const [methodFilter, setMethodFilter] = useState("All Methods");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['/api/request-logs'],
    refetchInterval: isPaused ? false : 3000, // Update every 3 seconds unless paused
  });

  const clearLogsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('DELETE', '/api/request-logs');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/request-logs'] });
      toast({
        title: "Logs Cleared",
        description: "All request logs have been cleared successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return "bg-emerald-100 text-emerald-800";
    if (status >= 400 && status < 500) return "bg-red-100 text-red-800";
    if (status >= 500) return "bg-red-100 text-red-800";
    return "bg-blue-100 text-blue-800";
  };

  const getMethodColor = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET': return "bg-blue-100 text-blue-800";
      case 'POST': return "bg-emerald-100 text-emerald-800";
      case 'PUT': return "bg-amber-100 text-amber-800";
      case 'DELETE': return "bg-red-100 text-red-800";
      default: return "bg-slate-100 text-slate-800";
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatTime = (timestamp: string | Date) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const filteredLogs = methodFilter === "All Methods" 
    ? logs 
    : logs.filter((log: RequestLog) => log.method === methodFilter);

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center">
            <i className="fas fa-list-alt text-emerald-600 mr-2"></i>
            Request Logs
            <span className="ml-2 px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
              {isPaused ? 'Paused' : 'Live'}
            </span>
          </h2>
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => setIsPaused(!isPaused)}
              className="px-3 py-1 text-xs bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300 transition-colors"
            >
              {isPaused ? 'Resume' : 'Pause'}
            </button>
            <select 
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="text-xs border border-slate-300 rounded-md px-2 py-1"
            >
              <option>All Methods</option>
              <option>GET</option>
              <option>POST</option>
              <option>PUT</option>
              <option>DELETE</option>
            </select>
            <button
              onClick={() => clearLogsMutation.mutate()}
              disabled={clearLogsMutation.isPending}
              className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors disabled:opacity-50"
            >
              Clear
            </button>
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Method</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">URL</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Size</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Duration</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-slate-500">
                  Loading request logs...
                </td>
              </tr>
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-slate-500">
                  No request logs found. Start proxying to see logs here.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log: RequestLog) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 font-mono">
                    {formatTime(log.timestamp!)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getMethodColor(log.method)}`}>
                      {log.method}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-900 font-mono max-w-xs truncate" title={log.url}>
                    {log.url}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(log.status)}`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 font-mono">
                    {formatBytes(log.size)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 font-mono">
                    {log.duration}ms
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 text-center">
        <p className="text-sm text-slate-500">
          Showing {filteredLogs.length} of {logs.length} requests
        </p>
      </div>
    </div>
  );
}
