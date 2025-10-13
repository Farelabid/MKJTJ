import type { Express } from "express";
import { createServer, type Server } from "http";
import axios from "axios";
import * as cheerio from "cheerio";
import { radioStatsSchema } from "@shared/schema";
import { storage } from "./storage";

// Background job interval (1 minute for snapshot, 4 minutes for delta calculation)
const SNAPSHOT_INTERVAL = 1 * 60 * 1000;
const DELTA_INTERVAL = 4 * 60 * 1000;

let snapshotInterval: NodeJS.Timeout | null = null;
let deltaInterval: NodeJS.Timeout | null = null;

// In-memory tracking: store last snapshot per program
const programLastSnapshots: Map<string, { listeners: number; timestamp: Date }> = new Map();

// Program schedules (WIB timezone) with correct durations
const PROGRAM_SCHEDULES = [
  { name: "Night Flow", startHour: 0, startMin: 0, endHour: 6, endMin: 0, durationMinutes: 360 },
  { name: "Good Morning Jakarta", startHour: 6, startMin: 0, endHour: 10, endMin: 0, durationMinutes: 240 },
  { name: "Office Hour", startHour: 10, startMin: 0, endHour: 13, endMin: 0, durationMinutes: 180 },
  { name: "Coffee Break", startHour: 13, startMin: 0, endHour: 16, endMin: 0, durationMinutes: 180 },
  { name: "Drive Time", startHour: 16, startMin: 0, endHour: 20, endMin: 0, durationMinutes: 240 },
  { name: "Shift Malam", startHour: 20, startMin: 0, endHour: 22, endMin: 0, durationMinutes: 120 },
  { name: "Yesterday Hits", startHour: 22, startMin: 0, endHour: 24, endMin: 0, durationMinutes: 120 },
];

function getCurrentProgramWIB(): string | null {
  const now = new Date();
  const wibOffset = 7 * 60; // WIB is UTC+7
  const localOffset = now.getTimezoneOffset();
  const wibTime = new Date(now.getTime() + (wibOffset + localOffset) * 60 * 1000);
  
  const hour = wibTime.getHours();
  const minute = wibTime.getMinutes();
  const minutesSinceMidnight = hour * 60 + minute;

  for (const program of PROGRAM_SCHEDULES) {
    const startMinutes = program.startHour * 60 + program.startMin;
    const endMinutes = program.endHour * 60 + program.endMin;
    
    if (minutesSinceMidnight >= startMinutes && minutesSinceMidnight <= endMinutes) {
      return program.name;
    }
  }
  
  return null;
}

function getWIBDate(): string {
  const now = new Date();
  const wibOffset = 7 * 60;
  const localOffset = now.getTimezoneOffset();
  const wibTime = new Date(now.getTime() + (wibOffset + localOffset) * 60 * 1000);
  
  const year = wibTime.getFullYear();
  const month = String(wibTime.getMonth() + 1).padStart(2, '0');
  const day = String(wibTime.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

function getColorForProgram(programName: string): string {
  const colors: Record<string, string> = {
    "Night Flow": "hsl(var(--chart-6))",
    "Good Morning Jakarta": "hsl(var(--chart-1))",
    "Office Hour": "hsl(var(--chart-2))",
    "Coffee Break": "hsl(var(--chart-3))",
    "Drive Time": "hsl(var(--chart-4))",
    "Shift Malam": "hsl(var(--chart-5))",
    "Yesterday Hits": "hsl(var(--chart-1))",
  };
  return colors[programName] || "hsl(var(--chart-1))";
}

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

async function calculateProgramDelta() {
  try {
    const currentProgram = getCurrentProgramWIB();
    if (!currentProgram) {
      console.log(`[Delta] No active program at this time`);
      return;
    }

    const wibDate = getWIBDate();
    
    // Get last 2 snapshots to calculate delta (current vs 1 minute ago)
    // We need at least 2 snapshots: one from now and one from ~1 min ago
    const recentStats = await storage.getRecentStats(2/60); // Last 2 minutes to ensure we get 2 snapshots
    
    if (recentStats.length < 2) {
      // Not enough data yet, store current as baseline for this program
      if (recentStats.length === 1) {
        const currentListenersRaw = recentStats[0].listenersRaw;
        programLastSnapshots.set(currentProgram, {
          listeners: currentListenersRaw,
          timestamp: new Date(),
        });
        console.log(`[Delta] ${currentProgram}: Baseline set to ${currentListenersRaw} (waiting for next snapshot)`);
      } else {
        console.log(`[Delta] No snapshots available yet`);
      }
      return;
    }
    
    // Check if program changed since last run
    const lastProgramData = programLastSnapshots.get(currentProgram);
    const isProgramChange = !lastProgramData;
    
    // snapshots are ordered by timestamp DESC, so [0] is newest, [1] is ~1 min ago
    const currentSnapshot = recentStats[0];
    const oneMinuteAgoSnapshot = recentStats[1];
    
    const currentListenersRaw = currentSnapshot.listenersRaw;
    const oneMinuteAgoListenersRaw = oneMinuteAgoSnapshot.listenersRaw;
    
    if (isProgramChange) {
      // First time seeing this program, set baseline but don't calculate delta
      programLastSnapshots.set(currentProgram, {
        listeners: currentListenersRaw,
        timestamp: new Date(),
      });
      console.log(`[Delta] ${currentProgram}: Baseline set to ${currentListenersRaw} (program changed)`);
      return;
    }
    
    // Calculate delta: (current - 1 minute ago)
    const rawDelta = currentListenersRaw - oneMinuteAgoListenersRaw;
    
    // Get multiplier from config
    const multiplierConfig = await storage.getConfig('listener_multiplier');
    const multiplier = multiplierConfig ? parseInt(multiplierConfig.value) : 4;
    
    // Apply multiplier to delta: delta × 4
    const adjustedDelta = rawDelta * multiplier;
    
    // Get existing cumulative stats
    const existingStats = await storage.getProgramStats(currentProgram, wibDate);
    const newCumulativeDelta = (existingStats?.cumulativeDelta || 0) + adjustedDelta;
    
    // Update program stats
    await storage.updateProgramStats(
      currentProgram,
      wibDate,
      newCumulativeDelta,
      currentListenersRaw
    );
    
    // Update last check for this program
    programLastSnapshots.set(currentProgram, {
      listeners: currentListenersRaw,
      timestamp: new Date(),
    });
    
    console.log(`[Delta] ${currentProgram}: (${currentListenersRaw} - ${oneMinuteAgoListenersRaw}) × ${multiplier} = ${adjustedDelta}, cumulative=${newCumulativeDelta}`);
  } catch (error) {
    console.error(`[Delta] Error calculating delta:`, error);
  }
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

  // Program schedule data based on TJ Radio Jakarta schedule
  interface ProgramSchedule {
    title: string;
    presenter: string;
    startHour: number;
    startMinute: number;
    endHour: number;
    endMinute: number;
    description: string;
    imageUrl: string;
  }

  const programSchedules: ProgramSchedule[] = [
    {
      title: "Night Flow",
      presenter: "dengan Denny CH & Eko Kuntadhi",
      startHour: 0,
      startMinute: 0,
      endHour: 6,
      endMinute: 0,
      description: "Musik untuk menemani malam dan dini hari. Request lagu favorit via WA!",
      imageUrl: "https://www.tjradiojakarta.com/shows/nightflow.jpg"
    },
    {
      title: "Good Morning Jakarta",
      presenter: "dengan Indy & Irwan",
      startHour: 6,
      startMinute: 0,
      endHour: 10,
      endMinute: 0,
      description: "Mulai pagi dengan ceria! Info, musik hits, dan request dari pendengar.",
      imageUrl: "https://www.tjradiojakarta.com/shows/goodmorning-indy-irwan.jpg"
    },
    {
      title: "Office Hour",
      presenter: "dengan Rio",
      startHour: 10,
      startMinute: 0,
      endHour: 13,
      endMinute: 0,
      description: "Teman kerja paling pas. Lagu-lagu terbaru hits Indo & manca, plus request via WA/TikTok.",
      imageUrl: "https://www.tjradiojakarta.com/shows/officehour-rio.jpg"
    },
    {
      title: "Coffee Break",
      presenter: "dengan OT Syech & Nayla",
      startHour: 13,
      startMinute: 0,
      endHour: 16,
      endMinute: 0,
      description: "Istirahat siang yang menyenangkan dengan musik hits dan obrolan seru.",
      imageUrl: "https://www.tjradiojakarta.com/shows/coffeebreak-otsyech-nayla.jpg"
    },
    {
      title: "Drive Time",
      presenter: "dengan Reno & MC Dany",
      startHour: 16,
      startMinute: 0,
      endHour: 20,
      endMinute: 0,
      description: "Teman perjalanan pulang kerja. Info lalu lintas, musik hits, dan request lagu.",
      imageUrl: "https://www.tjradiojakarta.com/shows/drivetime-reno-mcdany.jpg"
    },
    {
      title: "Shift Malam",
      presenter: "dengan Denny CH & Eko Kuntadhi",
      startHour: 20,
      startMinute: 0,
      endHour: 23,
      endMinute: 0,
      description: "Menemani malam dengan musik santai dan request lagu favorit.",
      imageUrl: "https://www.tjradiojakarta.com/shows/shiftmalam-dennych-ekokuntadhi.jpg"
    },
    {
      title: "Yesterday Hits",
      presenter: "dengan Rio",
      startHour: 23,
      startMinute: 0,
      endHour: 24,
      endMinute: 0,
      description: "Nostalgia dengan lagu-lagu hits kemarin yang masih enak didengar hari ini.",
      imageUrl: "https://www.tjradiojakarta.com/shows/yesterdayhits.jpg"
    }
  ];

  function getCurrentProgram(): ProgramSchedule {
    // Get current time in Jakarta timezone (WIB = UTC+7)
    const now = new Date();
    const jakartaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
    const currentHour = jakartaTime.getHours();
    const currentMinute = jakartaTime.getMinutes();
    const currentMinutesSinceMidnight = currentHour * 60 + currentMinute;

    // Find matching program
    for (const program of programSchedules) {
      const startMinutes = program.startHour * 60 + program.startMinute;
      const endMinutes = program.endHour * 60 + program.endMinute;

      // Handle midnight crossing
      if (startMinutes > endMinutes) {
        if (currentMinutesSinceMidnight >= startMinutes || currentMinutesSinceMidnight < endMinutes) {
          return program;
        }
      } else {
        if (currentMinutesSinceMidnight >= startMinutes && currentMinutesSinceMidnight < endMinutes) {
          return program;
        }
      }
    }

    // Default fallback to Night Flow
    return programSchedules[0];
  }

  function formatTimeRange(program: ProgramSchedule): string {
    const formatTime = (hour: number, minute: number) => {
      const h = hour.toString().padStart(2, '0');
      const m = minute.toString().padStart(2, '0');
      return `${h}:${m}`;
    };

    const start = formatTime(program.startHour, program.startMinute);
    const end = formatTime(program.endHour, program.endMinute);
    return `${start}–${end} WIB`;
  }

  // API endpoint to get program listeners with cumulative delta
  app.get("/api/program-listeners", async (req, res) => {
    try {
      const wibDate = getWIBDate();
      const currentProgramName = getCurrentProgramWIB();
      
      const programsData = await Promise.all(
        PROGRAM_SCHEDULES.map(async (program) => {
          const stats = await storage.getProgramStats(program.name, wibDate);
          const cumulativeListeners = stats?.cumulativeDelta || 0;
          
          // Calculate progress based on time (0-100%)
          const now = new Date();
          const wibOffset = 7 * 60;
          const localOffset = now.getTimezoneOffset();
          const wibTime = new Date(now.getTime() + (wibOffset + localOffset) * 60 * 1000);
          const currentMinutes = wibTime.getHours() * 60 + wibTime.getMinutes();
          const programStartMinutes = program.startHour * 60 + program.startMin;
          const programEndMinutes = program.endHour * 60 + program.endMin;
          const programDuration = programEndMinutes - programStartMinutes;
          
          let progressPercent = 0;
          if (program.name === currentProgramName) {
            const elapsed = currentMinutes - programStartMinutes;
            progressPercent = Math.min(100, Math.max(0, (elapsed / programDuration) * 100));
          }
          
          return {
            programName: program.name,
            displayName: program.name,
            timeRange: `${String(program.startHour).padStart(2, '0')}:${String(program.startMin).padStart(2, '0')} - ${String(program.endHour).padStart(2, '0')}:${String(program.endMin).padStart(2, '0')}`,
            startTime: `${String(program.startHour).padStart(2, '0')}:${String(program.startMin).padStart(2, '0')}`,
            endTime: `${String(program.endHour).padStart(2, '0')}:${String(program.endMin).padStart(2, '0')}`,
            cumulativeListeners,
            progressPercent: Math.round(progressPercent),
            isActive: program.name === currentProgramName,
            color: getColorForProgram(program.name),
          };
        })
      );
      
      res.json(programsData);
    } catch (error) {
      console.error("Error fetching program listeners:", error);
      res.status(500).json({ error: "Failed to fetch program listeners" });
    }
  });

  // API endpoint to get on-air program (schedule-based with optional scraping fallback)
  app.get("/api/on-air-program", async (req, res) => {
    try {
      // Get current program based on schedule
      const currentProgram = getCurrentProgram();
      const timeRange = formatTimeRange(currentProgram);

      const onAirProgram = {
        programTitle: currentProgram.title,
        presenter: currentProgram.presenter,
        timeRange: timeRange,
        description: currentProgram.description,
        imageUrl: currentProgram.imageUrl,
        status: "LIVE",
        source: "schedule" // Indicates data source for observability
      };

      res.json(onAirProgram);
    } catch (error) {
      console.error("Error determining on-air program:", error);
      res.status(500).json({ 
        error: "Failed to determine on-air program",
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
  
  // Schedule periodic snapshots every 1 minute
  snapshotInterval = setInterval(saveStatsSnapshot, SNAPSHOT_INTERVAL);
  console.log(`[Snapshot] Background job started - saving every ${SNAPSHOT_INTERVAL / 1000 / 60} minute(s)`);

  // Start background job for delta calculation
  if (deltaInterval) {
    clearInterval(deltaInterval);
  }
  
  // Calculate delta after initial delay (to have data)
  setTimeout(calculateProgramDelta, DELTA_INTERVAL);
  
  // Schedule periodic delta calculation every 4 minutes
  deltaInterval = setInterval(calculateProgramDelta, DELTA_INTERVAL);
  console.log(`[Delta] Background job started - calculating every ${DELTA_INTERVAL / 1000 / 60} minute(s)`);

  return httpServer;
}
