import { 
  statsHistory, 
  configuration, 
  alertThresholds,
  alertHistory,
  type StatsHistory, 
  type InsertStatsHistory,
  type Configuration,
  type InsertConfiguration,
  type AlertThreshold,
  type InsertAlertThreshold,
  type AlertHistory,
  type InsertAlertHistory
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, gte, lte, and } from "drizzle-orm";

export interface IStorage {
  // Stats History
  saveStatsSnapshot(stats: InsertStatsHistory): Promise<StatsHistory>;
  getStatsHistory(startDate?: Date, endDate?: Date): Promise<StatsHistory[]>;
  getRecentStats(hours: number): Promise<StatsHistory[]>;
  
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
    startDate.setHours(startDate.getHours() - hours);
    
    const results = await db
      .select()
      .from(statsHistory)
      .where(gte(statsHistory.timestamp, startDate))
      .orderBy(desc(statsHistory.timestamp));
    
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
}

export const storage = new DatabaseStorage();
