import type { Express } from "express";
import { createServer, type Server } from "http";
import axios from "axios";
import * as cheerio from "cheerio";
import { radioStatsSchema } from "@shared/schema";
import { storage } from "./storage";

// Background job interval (5 minutes)
const SNAPSHOT_INTERVAL = 5 * 60 * 1000;

let snapshotInterval: NodeJS.Timeout | null = null;

async function saveStatsSnapshot() {
  const maxRetries = 3;
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.get("https://stream-eu-nc.arenastreaming.com:5450/", {
        timeout: 10000,
      });

      const html = response.data;
      const $ = cheerio.load(html);

      let streamName = "";
      let listenersRaw = 0;
      let listenersPeakRaw = 0;
      let bitrate = 0;
      let currentlyPlaying = "";

      $('table tr').each((_, row) => {
        const cells = $(row).find('td');
        if (cells.length >= 2) {
          const label = $(cells[0]).text().trim();
          const value = $(cells[1]).text().trim();

          switch (label) {
            case 'Stream Name:':
              streamName = value;
              break;
            case 'Bitrate:':
              bitrate = parseInt(value) || 0;
              break;
            case 'Listeners (current):':
              listenersRaw = parseInt(value) || 0;
              break;
            case 'Listeners (peak):':
              listenersPeakRaw = parseInt(value) || 0;
              break;
            case 'Currently playing:':
              currentlyPlaying = value;
              break;
          }
        }
      });

      // Get multiplier from config
      const multiplierConfig = await storage.getConfig('listener_multiplier');
      const multiplier = multiplierConfig ? parseInt(multiplierConfig.value) : 4;

      const listenersCurrent = listenersRaw * multiplier;
      const listenersPeak = listenersPeakRaw * multiplier;

      await storage.saveStatsSnapshot({
        streamName,
        listenersRaw,
        listenersPeakRaw,
        listenersCurrent,
        listenersPeak,
        bitrate,
        currentlyPlaying: currentlyPlaying || undefined,
      });

      // Check alert thresholds
      const thresholds = await storage.getAlertThresholds();
      for (const threshold of thresholds) {
        if (!threshold.enabled) continue;

        let shouldAlert = false;
        if (threshold.thresholdType === 'min_listeners' && listenersCurrent < threshold.value) {
          shouldAlert = true;
        } else if (threshold.thresholdType === 'max_listeners' && listenersCurrent > threshold.value) {
          shouldAlert = true;
        }

        if (shouldAlert) {
          await storage.saveAlertHistory({
            thresholdId: threshold.id,
            listenersCount: listenersCurrent,
            message: `Threshold ${threshold.thresholdType} (${threshold.value}) triggered: Current listeners ${listenersCurrent}`,
          });
          console.log(`[Alert] Threshold triggered: ${threshold.thresholdType} = ${threshold.value}, current = ${listenersCurrent}`);
        }
      }

      console.log(`[Snapshot] Saved stats: ${listenersCurrent} listeners at ${new Date().toISOString()}`);
      return; // Success, exit function
    } catch (error) {
      lastError = error;
      console.error(`[Snapshot] Attempt ${attempt}/${maxRetries} failed:`, error instanceof Error ? error.message : error);
      
      if (attempt < maxRetries) {
        const delay = attempt * 2000; // Exponential backoff: 2s, 4s
        console.log(`[Snapshot] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.error(`[Snapshot] Failed after ${maxRetries} attempts. Last error:`, lastError);
}

export async function registerRoutes(app: Express): Promise<Server> {
  // API endpoint to fetch current radio statistics
  app.get("/api/radio-stats", async (req, res) => {
    try {
      const response = await axios.get("https://stream-eu-nc.arenastreaming.com:5450/", {
        timeout: 10000,
      });

      const html = response.data;
      const $ = cheerio.load(html);

      let streamName = "";
      let streamDescription = "";
      let contentType = "";
      let streamStarted = "";
      let bitrate = 0;
      let listenersRaw = 0;
      let listenersPeakRaw = 0;
      let genre = "";
      let streamUrl = "";
      let currentlyPlaying = "";

      $('table tr').each((_, row) => {
        const cells = $(row).find('td');
        if (cells.length >= 2) {
          const label = $(cells[0]).text().trim();
          const value = $(cells[1]).text().trim();

          switch (label) {
            case 'Stream Name:':
              streamName = value;
              break;
            case 'Stream Description:':
              streamDescription = value;
              break;
            case 'Content Type:':
              contentType = value;
              break;
            case 'Stream started:':
              streamStarted = value;
              break;
            case 'Bitrate:':
              bitrate = parseInt(value) || 0;
              break;
            case 'Listeners (current):':
              listenersRaw = parseInt(value) || 0;
              break;
            case 'Listeners (peak):':
              listenersPeakRaw = parseInt(value) || 0;
              break;
            case 'Genre:':
              genre = value;
              break;
            case 'Stream URL:':
              const link = $(cells[1]).find('a');
              streamUrl = link.attr('href') || value;
              break;
            case 'Currently playing:':
              currentlyPlaying = value;
              break;
          }
        }
      });

      // Get multiplier from config (default 4)
      const multiplierConfig = await storage.getConfig('listener_multiplier');
      const multiplier = multiplierConfig ? parseInt(multiplierConfig.value) : 4;

      const listenersCurrent = listenersRaw * multiplier;
      const listenersPeak = listenersPeakRaw * multiplier;

      const stats = {
        streamName,
        streamDescription,
        contentType,
        streamStarted,
        bitrate,
        listenersRaw,
        listenersPeakRaw,
        listenersCurrent,
        listenersPeak,
        genre,
        streamUrl,
        currentlyPlaying,
      };

      const validatedStats = radioStatsSchema.parse(stats);
      res.json(validatedStats);
    } catch (error) {
      console.error("Error fetching radio stats:", error);
      res.status(500).json({ 
        error: "Failed to fetch radio statistics",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // API endpoint to get historical stats
  app.get("/api/stats-history", async (req, res) => {
    try {
      const hours = req.query.hours ? parseInt(req.query.hours as string) : 24;
      const history = await storage.getRecentStats(hours);
      res.json(history);
    } catch (error) {
      console.error("Error fetching stats history:", error);
      res.status(500).json({ 
        error: "Failed to fetch stats history",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // API endpoint to get configuration
  app.get("/api/config", async (req, res) => {
    try {
      const configs = await storage.getAllConfigs();
      const configMap: Record<string, string> = {};
      configs.forEach(config => {
        configMap[config.key] = config.value;
      });
      res.json(configMap);
    } catch (error) {
      console.error("Error fetching config:", error);
      res.status(500).json({ error: "Failed to fetch configuration" });
    }
  });

  // API endpoint to update configuration
  app.post("/api/config", async (req, res) => {
    try {
      const { key, value } = req.body;
      if (!key || !value) {
        return res.status(400).json({ error: "Key and value are required" });
      }
      const config = await storage.setConfig({ key, value });
      res.json(config);
    } catch (error) {
      console.error("Error updating config:", error);
      res.status(500).json({ error: "Failed to update configuration" });
    }
  });

  // API endpoint to get alert thresholds
  app.get("/api/alert-thresholds", async (req, res) => {
    try {
      const thresholds = await storage.getAlertThresholds();
      res.json(thresholds);
    } catch (error) {
      console.error("Error fetching alert thresholds:", error);
      res.status(500).json({ error: "Failed to fetch alert thresholds" });
    }
  });

  // API endpoint to create alert threshold
  app.post("/api/alert-thresholds", async (req, res) => {
    try {
      const { thresholdType, value, enabled } = req.body;
      const threshold = await storage.createAlertThreshold({
        thresholdType,
        value,
        enabled: enabled !== undefined ? enabled : true,
      });
      res.json(threshold);
    } catch (error) {
      console.error("Error creating alert threshold:", error);
      res.status(500).json({ error: "Failed to create alert threshold" });
    }
  });

  // API endpoint to update alert threshold
  app.patch("/api/alert-thresholds/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { enabled } = req.body;
      const threshold = await storage.updateAlertThreshold(id, enabled);
      res.json(threshold);
    } catch (error) {
      console.error("Error updating alert threshold:", error);
      res.status(500).json({ error: "Failed to update alert threshold" });
    }
  });

  // API endpoint to delete alert threshold
  app.delete("/api/alert-thresholds/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteAlertThreshold(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting alert threshold:", error);
      res.status(500).json({ error: "Failed to delete alert threshold" });
    }
  });

  // API endpoint to get alert history
  app.get("/api/alert-history", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const history = await storage.getAlertHistory(limit);
      res.json(history);
    } catch (error) {
      console.error("Error fetching alert history:", error);
      res.status(500).json({ error: "Failed to fetch alert history" });
    }
  });

  // API endpoint to export stats as CSV
  app.get("/api/export/csv", async (req, res) => {
    try {
      const hours = req.query.hours ? parseInt(req.query.hours as string) : 24;
      const history = await storage.getRecentStats(hours);

      const csv = [
        "Timestamp,Stream Name,Listeners (Raw),Peak (Raw),Listeners (Current),Peak (Current),Bitrate,Currently Playing",
        ...history.map(stat => 
          `${new Date(stat.timestamp).toISOString()},${stat.streamName},${stat.listenersRaw},${stat.listenersPeakRaw},${stat.listenersCurrent},${stat.listenersPeak},${stat.bitrate},"${stat.currentlyPlaying || ''}"`
        )
      ].join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=tj-radio-stats-${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csv);
    } catch (error) {
      console.error("Error exporting CSV:", error);
      res.status(500).json({ error: "Failed to export CSV" });
    }
  });

  const httpServer = createServer(app);

  // Start background job for saving snapshots
  if (snapshotInterval) {
    clearInterval(snapshotInterval);
  }
  
  // Save initial snapshot
  saveStatsSnapshot();
  
  // Schedule periodic snapshots every 5 minutes
  snapshotInterval = setInterval(saveStatsSnapshot, SNAPSHOT_INTERVAL);
  console.log(`[Snapshot] Background job started - saving every ${SNAPSHOT_INTERVAL / 1000 / 60} minutes`);

  return httpServer;
}
