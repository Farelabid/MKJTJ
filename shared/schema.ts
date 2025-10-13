import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Radio Statistics Schema (for API response)
export const radioStatsSchema = z.object({
  streamName: z.string(),
  streamDescription: z.string(),
  contentType: z.string(),
  streamStarted: z.string(),
  bitrate: z.number(),
  listenersRaw: z.number(),
  listenersPeakRaw: z.number(),
  listenersCurrent: z.number(),
  listenersPeak: z.number(),
  genre: z.string(),
  streamUrl: z.string(),
  currentlyPlaying: z.string().optional(),
});

export type RadioStats = z.infer<typeof radioStatsSchema>;

// Database Tables

// Stats History Table - stores snapshots of radio statistics
export const statsHistory = pgTable("stats_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  streamName: text("stream_name").notNull(),
  listenersRaw: integer("listeners_raw").notNull(),
  listenersPeakRaw: integer("listeners_peak_raw").notNull(),
  listenersCurrent: integer("listeners_current").notNull(),
  listenersPeak: integer("listeners_peak").notNull(),
  bitrate: integer("bitrate").notNull(),
  currentlyPlaying: text("currently_playing"),
});

export const insertStatsHistorySchema = createInsertSchema(statsHistory).omit({
  id: true,
  timestamp: true,
});

export type InsertStatsHistory = z.infer<typeof insertStatsHistorySchema>;
export type StatsHistory = typeof statsHistory.$inferSelect;

// Configuration Table - stores app settings
export const configuration = pgTable("configuration", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertConfigurationSchema = createInsertSchema(configuration).omit({
  id: true,
  updatedAt: true,
});

export type InsertConfiguration = z.infer<typeof insertConfigurationSchema>;
export type Configuration = typeof configuration.$inferSelect;

// Alert Thresholds Table
export const alertThresholds = pgTable("alert_thresholds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  thresholdType: text("threshold_type").notNull(), // 'min_listeners' or 'max_listeners'
  value: integer("value").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAlertThresholdSchema = createInsertSchema(alertThresholds).omit({
  id: true,
  createdAt: true,
});

export type InsertAlertThreshold = z.infer<typeof insertAlertThresholdSchema>;
export type AlertThreshold = typeof alertThresholds.$inferSelect;

// Alert History Table
export const alertHistory = pgTable("alert_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  thresholdId: varchar("threshold_id").notNull(),
  listenersCount: integer("listeners_count").notNull(),
  message: text("message").notNull(),
  triggeredAt: timestamp("triggered_at").notNull().defaultNow(),
});

export const insertAlertHistorySchema = createInsertSchema(alertHistory).omit({
  id: true,
  triggeredAt: true,
});

export type InsertAlertHistory = z.infer<typeof insertAlertHistorySchema>;
export type AlertHistory = typeof alertHistory.$inferSelect;
