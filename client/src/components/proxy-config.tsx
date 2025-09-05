import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { RouterConfig, InsertRouterConfig } from "@shared/schema";

export default function RouterConfig() {
  const [targetUrl, setTargetUrl] = useState("");
  const [enableLogging, setEnableLogging] = useState(true);
  const [corsHeaders, setCorsHeaders] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: currentConfig } = useQuery({
    queryKey: ['/api/router-config'],
    refetchInterval: 5000,
  });

  const createConfigMutation = useMutation({
    mutationFn: async (config: InsertRouterConfig) => {
      const response = await apiRequest('POST', '/api/router-config', config);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/router-config'] });
      queryClient.invalidateQueries({ queryKey: ['/api/server-stats'] });
      toast({
        title: "Router Configuration Updated",
        description: "The proxy server configuration has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Configuration Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!targetUrl) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid target URL.",
        variant: "destructive",
      });
      return;
    }

    try {
      new URL(targetUrl);
    } catch {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid URL format (including http:// or https://).",
        variant: "destructive",
      });
      return;
    }

    createConfigMutation.mutate({
      targetUrl,
      enableLogging,
      corsHeaders,
    });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
        <i className="fas fa-link text-blue-600 mr-2"></i>
        Router Configuration
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="target-url" className="block text-sm font-medium text-slate-700 mb-2">
            Target URL
          </label>
          <input 
            type="url" 
            id="target-url"
            placeholder="https://example.com"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="flex items-center space-x-2">
              <input 
                type="checkbox" 
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                checked={enableLogging}
                onChange={(e) => setEnableLogging(e.target.checked)}
              />
              <span className="text-sm text-slate-700">Enable Logging</span>
            </label>
          </div>
          <div>
            <label className="flex items-center space-x-2">
              <input 
                type="checkbox" 
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                checked={corsHeaders}
                onChange={(e) => setCorsHeaders(e.target.checked)}
              />
              <span className="text-sm text-slate-700">CORS Headers</span>
            </label>
          </div>
        </div>
        
        <button 
          type="submit" 
          disabled={createConfigMutation.isPending}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium flex items-center justify-center space-x-2 disabled:opacity-50"
        >
          <i className="fas fa-play"></i>
          <span>{createConfigMutation.isPending ? "Updating..." : "Start Router"}</span>
        </button>
      </form>

      {currentConfig && (
        <div className="mt-4 p-3 bg-slate-50 rounded-md">
          <p className="text-xs text-slate-600">
            Current: <a href={currentConfig.targetUrl} target="_blank" rel="noopener noreferrer" className="font-mono">{currentConfig.targetUrl}</a>
          </p>
          <br></br>
          <hr></hr>
          <br></br>
            <p className="text-xs text-slate-600">
              Current Base64 Extension: <span className="font-mono">{btoa(currentConfig.targetUrl)}</span>
            </p>
          <br></br>
          <hr></hr>
          <br></br>
          <p className="text-xs text-slate-600">
            Current: <a href = {window.location + "api/proxy?url=" + btoa(currentConfig.targetUrl)} target="_blank" rel="noopener noreferrer" className="font-mono">{window.location + "api/proxy?url=" + btoa(currentConfig.targetUrl)}</a>
          </p>
        </div>
      )}
    </div>
  );
}
