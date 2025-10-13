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

// Program Stats Table - stores EMA and listener-minutes per program per day
export const programStats = pgTable("program_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  programName: text("program_name").notNull(),
  date: text("date").notNull(), // Format: YYYY-MM-DD (WIB timezone)
  LM: integer("lm").notNull().default(0), // Listener-Minutes mentah
  LMhat: integer("lm_hat").notNull().default(0), // Listener-Minutes tersmooth (EMA)
  Nhat: integer("n_hat").notNull().default(0), // EMA dari raw listeners
  baseline: integer("baseline"), // Rata-rata Nhat dari 5 menit pertama
  targetLM: integer("target_lm"), // Target LM = durasi × baseline
  progress: integer("progress").notNull().default(0), // Progress 0-100
  elapsedMinutes: integer("elapsed_minutes").notNull().default(0), // Waktu berjalan sejak start
  avgConcurrentListeners: integer("avg_concurrent_listeners").notNull().default(0), // LMhat ÷ elapsedMinutes
  estimatedUniqueListeners: integer("estimated_unique_listeners").notNull().default(0), // LMhat ÷ ALT_session
  startTime: text("start_time").notNull(), // HH:mm format
  endTime: text("end_time").notNull(), // HH:mm format
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
});

// Minute Snapshots Table - stores minute-by-minute data for baseline calculation
export const minuteSnapshots = pgTable("minute_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  rawListeners: integer("raw_listeners").notNull(), // N dari Icecast
  Nhat: integer("n_hat").notNull(), // EMA-smoothed N
  programName: text("program_name").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD (WIB timezone)
});

export const insertProgramStatsSchema = createInsertSchema(programStats).omit({
  id: true,
  lastUpdated: true,
});

export type InsertProgramStats = z.infer<typeof insertProgramStatsSchema>;
export type ProgramStats = typeof programStats.$inferSelect;

export const insertMinuteSnapshotSchema = createInsertSchema(minuteSnapshots).omit({
  id: true,
  timestamp: true,
});

export type InsertMinuteSnapshot = z.infer<typeof insertMinuteSnapshotSchema>;
export type MinuteSnapshot = typeof minuteSnapshots.$inferSelect;

// API Response Schema for Program Listeners
export const programListenersSchema = z.object({
  programName: z.string(),
  displayName: z.string(),
  timeRange: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  cumulativeListeners: z.number(),
  progressPercent: z.number(),
  isActive: z.boolean(),
  color: z.string(),
});

export type ProgramListenersResponse = z.infer<typeof programListenersSchema>;
