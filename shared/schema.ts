import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const proxyConfigs = pgTable("proxy_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  targetUrl: text("target_url").notNull(),
  enableLogging: boolean("enable_logging").default(true),
  corsHeaders: boolean("cors_headers").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const requestLogs = pgTable("request_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  method: text("method").notNull(),
  url: text("url").notNull(),
  status: integer("status").notNull(),
  size: integer("size").notNull(),
  duration: integer("duration").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  configId: varchar("config_id").references(() => proxyConfigs.id),
});

export const serverStats = pgTable("server_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  totalRequests: integer("total_requests").default(0),
  activeConnections: integer("active_connections").default(0),
  dataTransferred: integer("data_transferred").default(0), // in bytes
  errors: integer("errors").default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertProxyConfigSchema = createInsertSchema(proxyConfigs).omit({
  id: true,
  createdAt: true,
});

export const insertRequestLogSchema = createInsertSchema(requestLogs).omit({
  id: true,
  timestamp: true,
});

export const insertServerStatsSchema = createInsertSchema(serverStats).omit({
  id: true,
  updatedAt: true,
});

export type InsertProxyConfig = z.infer<typeof insertProxyConfigSchema>;
export type ProxyConfig = typeof proxyConfigs.$inferSelect;

export type InsertRequestLog = z.infer<typeof insertRequestLogSchema>;
export type RequestLog = typeof requestLogs.$inferSelect;

export type InsertServerStats = z.infer<typeof insertServerStatsSchema>;
export type ServerStats = typeof serverStats.$inferSelect;
