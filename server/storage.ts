import { 
  statsHistory, 
  configuration, 
  alertThresholds,
  alertHistory,
  programStats,
  minuteSnapshots,
  type StatsHistory, 
  type InsertStatsHistory,
  type Configuration,
  type InsertConfiguration,
  type AlertThreshold,
  type InsertAlertThreshold,
  type AlertHistory,
  type InsertAlertHistory,
  type ProgramStats,
  type InsertProgramStats,
  type MinuteSnapshot,
  type InsertMinuteSnapshot
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, gte, lte, and } from "drizzle-orm";

export interface IStorage {
  // Stats History
  saveStatsSnapshot(stats: InsertStatsHistory): Promise<StatsHistory>;
  getStatsHistory(startDate?: Date, endDate?: Date): Promise<StatsHistory[]>;
  getRecentStats(hours: number): Promise<StatsHistory[]>;
  getSnapshotsForDate(date: string): Promise<StatsHistory[]>;
  
  // Configuration
  getConfig(key: string): Promise<Configuration | undefined>;
  setConfig(config: InsertConfiguration): Promise<Configuration>;
  getAllConfigs(): Promise<Configuration[]>;
  
  // Alert Thresholds
  getAlertThresholds(): Promise<AlertThreshold[]>;
  createAlertThreshold(threshold: InsertAlertThreshold): Promise<AlertThreshold>;
  updateAlertThreshold(id: string, enabled: boolean): Promise<AlertThreshold>;
  deleteAlertThreshold(id: string): Promise<void>;
  
  // Alert History
  saveAlertHistory(alert: InsertAlertHistory): Promise<AlertHistory>;
  getAlertHistory(limit?: number): Promise<AlertHistory[]>;
  
  // Configuration Helper
  getConfigValue(key: string): Promise<string | undefined>;
  
  // Program Stats (EMA-based)
  getProgramStats(programName: string, date: string): Promise<ProgramStats | undefined>;
  updateProgramStats(programName: string, date: string, data: {
    LM: number;
    LMhat: number;
    Nhat: number;
    baseline?: number;
    targetLM?: number;
    progress: number;
    elapsedMinutes: number;
    avgConcurrentListeners: number;
    estimatedUniqueListeners: number;
    startTime: string;
    endTime: string;
  }): Promise<ProgramStats>;
  getAllProgramStatsForDate(date: string): Promise<ProgramStats[]>;
  
  // Minute Snapshots
  saveMinuteSnapshot(snapshot: InsertMinuteSnapshot): Promise<MinuteSnapshot>;
  getRecentSnapshots(programName: string, date: string, minutes: number): Promise<MinuteSnapshot[]>;
  cleanupOldSnapshots(cutoffDate: Date): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Stats History
  async saveStatsSnapshot(stats: InsertStatsHistory): Promise<StatsHistory> {
    const [snapshot] = await db
      .insert(statsHistory)
      .values(stats)
      .returning();
    return snapshot;
  }

  async getStatsHistory(startDate?: Date, endDate?: Date): Promise<StatsHistory[]> {
    let query = db.select().from(statsHistory);
    
    if (startDate && endDate) {
      query = query.where(
        and(
          gte(statsHistory.timestamp, startDate),
          lte(statsHistory.timestamp, endDate)
        )
      ) as any;
    } else if (startDate) {
      query = query.where(gte(statsHistory.timestamp, startDate)) as any;
    }
    
    const results = await query.orderBy(desc(statsHistory.timestamp));
    return results;
  }

  async getRecentStats(hours: number): Promise<StatsHistory[]> {
    const startDate = new Date();
    // Use setTime() instead of setHours() to properly handle decimal hours
    startDate.setTime(startDate.getTime() - hours * 60 * 60 * 1000);
    
    console.log(`[Storage] getRecentStats: Querying with cutoff ${startDate.toISOString()}`);
    
    const results = await db
      .select()
      .from(statsHistory)
      .where(gte(statsHistory.timestamp, startDate))
      .orderBy(desc(statsHistory.timestamp));
    
    console.log(`[Storage] getRecentStats: Found ${results.length} results`);
    
    return results;
  }

  async getSnapshotsForDate(date: string): Promise<StatsHistory[]> {
    // Parse date string (YYYY-MM-DD) and create start/end of day in UTC
    const [year, month, day] = date.split('-').map(Number);
    const startDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
    
    const results = await db
      .select()
      .from(statsHistory)
      .where(
        and(
          gte(statsHistory.timestamp, startDate),
          lte(statsHistory.timestamp, endDate)
        )
      )
      .orderBy(statsHistory.timestamp);
    
    return results;
  }

  // Configuration
  async getConfig(key: string): Promise<Configuration | undefined> {
    const [config] = await db
      .select()
      .from(configuration)
      .where(eq(configuration.key, key));
    return config || undefined;
  }

  async setConfig(config: InsertConfiguration): Promise<Configuration> {
    const existing = await this.getConfig(config.key);
    
    if (existing) {
      const [updated] = await db
        .update(configuration)
        .set({ value: config.value, updatedAt: new Date() })
        .where(eq(configuration.key, config.key))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(configuration)
        .values(config)
        .returning();
      return created;
    }
  }

  async getAllConfigs(): Promise<Configuration[]> {
    const configs = await db.select().from(configuration);
    return configs;
  }

  async getConfigValue(key: string): Promise<string | undefined> {
    const config = await this.getConfig(key);
    return config?.value;
  }

  // Alert Thresholds
  async getAlertThresholds(): Promise<AlertThreshold[]> {
    const thresholds = await db
      .select()
      .from(alertThresholds)
      .orderBy(desc(alertThresholds.createdAt));
    return thresholds;
  }

  async createAlertThreshold(threshold: InsertAlertThreshold): Promise<AlertThreshold> {
    const [created] = await db
      .insert(alertThresholds)
      .values(threshold)
      .returning();
    return created;
  }

  async updateAlertThreshold(id: string, enabled: boolean): Promise<AlertThreshold> {
    const [updated] = await db
      .update(alertThresholds)
      .set({ enabled })
      .where(eq(alertThresholds.id, id))
      .returning();
    return updated;
  }

  async deleteAlertThreshold(id: string): Promise<void> {
    await db
      .delete(alertThresholds)
      .where(eq(alertThresholds.id, id));
  }

  // Alert History
  async saveAlertHistory(alert: InsertAlertHistory): Promise<AlertHistory> {
    const [saved] = await db
      .insert(alertHistory)
      .values(alert)
      .returning();
    return saved;
  }

  async getAlertHistory(limit: number = 50): Promise<AlertHistory[]> {
    const history = await db
      .select()
      .from(alertHistory)
      .orderBy(desc(alertHistory.triggeredAt))
      .limit(limit);
    return history;
  }

  // Program Stats
  async getProgramStats(programName: string, date: string): Promise<ProgramStats | undefined> {
    const [stats] = await db
      .select()
      .from(programStats)
      .where(
        and(
          eq(programStats.programName, programName),
          eq(programStats.date, date)
        )
      );
    return stats || undefined;
  }

  async updateProgramStats(
    programName: string, 
    date: string, 
    data: {
      LM: number;
      LMhat: number;
      Nhat: number;
      baseline?: number;
      targetLM?: number;
      progress: number;
      elapsedMinutes: number;
      avgConcurrentListeners: number;
      estimatedUniqueListeners: number;
      startTime: string;
      endTime: string;
    }
  ): Promise<ProgramStats> {
    const existing = await this.getProgramStats(programName, date);
    
    if (existing) {
      const [updated] = await db
        .update(programStats)
        .set({ 
          LM: data.LM,
          LMhat: data.LMhat,
          Nhat: data.Nhat,
          baseline: data.baseline,
          targetLM: data.targetLM,
          progress: data.progress,
          elapsedMinutes: data.elapsedMinutes,
          avgConcurrentListeners: data.avgConcurrentListeners,
          estimatedUniqueListeners: data.estimatedUniqueListeners,
          lastUpdated: new Date() 
        })
        .where(eq(programStats.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(programStats)
        .values({
          programName,
          date,
          LM: data.LM,
          LMhat: data.LMhat,
          Nhat: data.Nhat,
          baseline: data.baseline,
          targetLM: data.targetLM,
          progress: data.progress,
          elapsedMinutes: data.elapsedMinutes,
          avgConcurrentListeners: data.avgConcurrentListeners,
          estimatedUniqueListeners: data.estimatedUniqueListeners,
          startTime: data.startTime,
          endTime: data.endTime,
        })
        .returning();
      return created;
    }
  }

  async getAllProgramStatsForDate(date: string): Promise<ProgramStats[]> {
    const stats = await db
      .select()
      .from(programStats)
      .where(eq(programStats.date, date));
    return stats;
  }

  // Minute Snapshots
  async saveMinuteSnapshot(snapshot: InsertMinuteSnapshot): Promise<MinuteSnapshot> {
    const [saved] = await db
      .insert(minuteSnapshots)
      .values(snapshot)
      .returning();
    return saved;
  }

  async getRecentSnapshots(programName: string, date: string, minutes: number): Promise<MinuteSnapshot[]> {
    // Calculate cutoff in WIB timezone to match stored timestamps
    const now = new Date();
    const wibOffset = 7 * 60; // WIB = UTC+7
    const localOffset = now.getTimezoneOffset();
    const wibNow = new Date(now.getTime() + (wibOffset + localOffset) * 60 * 1000);
    const cutoff = new Date(wibNow.getTime() - minutes * 60 * 1000);
    
    const snapshots = await db
      .select()
      .from(minuteSnapshots)
      .where(
        and(
          eq(minuteSnapshots.programName, programName),
          eq(minuteSnapshots.date, date),
          gte(minuteSnapshots.timestamp, cutoff)
        )
      )
      .orderBy(desc(minuteSnapshots.timestamp));
    
    return snapshots;
  }

  async cleanupOldSnapshots(cutoffDate: Date): Promise<void> {
    await db
      .delete(minuteSnapshots)
      .where(lte(minuteSnapshots.timestamp, cutoffDate));
  }

  // Helper method to get program schedule
  private getProgramSchedule(programName: string): { startTime: string; endTime: string } {
    const schedules: Record<string, { startTime: string; endTime: string }> = {
      "Night Flow": { startTime: "00:00", endTime: "06:00" },
      "Good Morning Jakarta": { startTime: "06:00", endTime: "10:00" },
      "Office Hour": { startTime: "10:00", endTime: "13:00" },
      "Coffee Break": { startTime: "13:00", endTime: "16:00" },
      "Drive Time": { startTime: "16:00", endTime: "20:00" },
      "Shift Malam": { startTime: "20:00", endTime: "22:00" },
      "Yesterday Hits": { startTime: "22:00", endTime: "24:00" },
    };
    return schedules[programName] || { startTime: "00:00", endTime: "23:59" };
  }
}

export const storage = new DatabaseStorage();
