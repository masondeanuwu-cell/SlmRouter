import { type RouterConfig, type InsertRouterConfig, type RequestLog, type InsertRequestLog, type ServerStats, type InsertServerStats } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Router Config methods
  createRouterConfig(config: InsertRouterConfig): Promise<RouterConfig>;
  getLatestRouterConfig(): Promise<RouterConfig | undefined>;
  
  // Request Log methods
  createRequestLog(log: InsertRequestLog): Promise<RequestLog>;
  getRequestLogs(limit?: number): Promise<RequestLog[]>;
  clearRequestLogs(): Promise<void>;
  
  // Server Stats methods
  getServerStats(): Promise<ServerStats>;
  updateServerStats(stats: Partial<InsertServerStats>): Promise<ServerStats>;
  incrementRequestCount(): Promise<void>;
  incrementErrorCount(): Promise<void>;
  setActiveConnections(count: number): Promise<void>;
  addDataTransferred(bytes: number): Promise<void>;
}

export class MemStorage implements IStorage {
  private proxyConfigs: Map<string, RouterConfig>;
  private requestLogs: Map<string, RequestLog>;
  private serverStats: ServerStats;

  constructor() {
    this.proxyConfigs = new Map();
    this.requestLogs = new Map();
    this.serverStats = {
      id: randomUUID(),
      totalRequests: 0,
      activeConnections: 0,
      dataTransferred: 0,
      errors: 0,
      updatedAt: new Date(),
    };
  }

  async createRouterConfig(insertConfig: InsertRouterConfig): Promise<RouterConfig> {
    const id = randomUUID();
    const config: RouterConfig = {
      ...insertConfig,
      id,
      createdAt: new Date(),
    };
    this.proxyConfigs.set(id, config);
    return config;
  }

  async getLatestRouterConfig(): Promise<RouterConfig | undefined> {
    const configs = Array.from(this.proxyConfigs.values()).sort(
      (a, b) => b.createdAt!.getTime() - a.createdAt!.getTime()
    );
    return configs[0];
  }

  async createRequestLog(insertLog: InsertRequestLog): Promise<RequestLog> {
    const id = randomUUID();
    const log: RequestLog = {
      ...insertLog,
      id,
      timestamp: new Date(),
    };
    this.requestLogs.set(id, log);
    return log;
  }

  async getRequestLogs(limit = 50): Promise<RequestLog[]> {
    const logs = Array.from(this.requestLogs.values()).sort(
      (a, b) => b.timestamp!.getTime() - a.timestamp!.getTime()
    );
    return logs.slice(0, limit);
  }

  async clearRequestLogs(): Promise<void> {
    this.requestLogs.clear();
  }

  async getServerStats(): Promise<ServerStats> {
    return { ...this.serverStats };
  }

  async updateServerStats(stats: Partial<InsertServerStats>): Promise<ServerStats> {
    this.serverStats = {
      ...this.serverStats,
      ...stats,
      updatedAt: new Date(),
    };
    return { ...this.serverStats };
  }

  async incrementRequestCount(): Promise<void> {
    this.serverStats.totalRequests = (this.serverStats.totalRequests || 0) + 1;
    this.serverStats.updatedAt = new Date();
  }

  async incrementErrorCount(): Promise<void> {
    this.serverStats.errors = (this.serverStats.errors || 0) + 1;
    this.serverStats.updatedAt = new Date();
  }

  async setActiveConnections(count: number): Promise<void> {
    this.serverStats.activeConnections = count;
    this.serverStats.updatedAt = new Date();
  }

  async addDataTransferred(bytes: number): Promise<void> {
    this.serverStats.dataTransferred = (this.serverStats.dataTransferred || 0) + bytes;
    this.serverStats.updatedAt = new Date();
  }
}

export const storage = new MemStorage();
