import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { RouterConfig, InsertRouterConfig, RequestLog, ServerStats } from "@shared/schema";

export function useRouter() {
  const queryClient = useQueryClient();

  // Router configuration
  const { data: proxyConfig, isLoading: configLoading } = useQuery({
    queryKey: ['/api/router-config'],
  });

  const updateConfigMutation = useMutation({
    mutationFn: async (config: InsertRouterConfig) => {
      const response = await apiRequest('POST', '/api/router-config', config);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/router-config'] });
    },
  });

  // Request logs
  const { data: requestLogs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['/api/request-logs'],
    refetchInterval: 3000,
  });

  const clearLogsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('DELETE', '/api/request-logs');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/request-logs'] });
    },
  });

  // Server stats
  const { data: serverStats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/server-stats'],
    refetchInterval: 2000,
  });

  return {
    proxyConfig,
    configLoading,
    updateConfig: updateConfigMutation,
    requestLogs,
    logsLoading,
    clearLogs: clearLogsMutation,
    serverStats,
    statsLoading,
  };
}
