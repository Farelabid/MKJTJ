import type { Express } from "express";
import { createServer, type Server } from "http";
import axios from "axios";
import * as cheerio from "cheerio";
import express from "express";
import path from "path";
import { radioStatsSchema } from "@shared/schema";
import { storage } from "./storage";

// Background job interval (30 seconds for EMA tracking)
const EMA_INTERVAL = 30 * 1000;

let emaInterval: NodeJS.Timeout | null = null;

// EMA Constants
const ALPHA = 0.25; // EMA smoothing factor
const DEVICE_TO_LISTENER_MULTIPLIER = 11; // K=11: Device-to-listener multiplier

// EMA State tracking per program
interface EMAState {
  Nhat: number | null; // Smoothed listeners
  lastN: number | null; // Previous raw listeners
  spikeWindowCount: number; // 30-second intervals remaining in spike detection window (10 = 5 minutes)
  baselineN: number | null; // Baseline from first 5 minutes
  startedAt: Date; // When program started
  programName: string; // Program name for this state
  date: string; // WIB date for this state (YYYY-MM-DD)
}

const programEMAStates: Map<string, EMAState> = new Map();

// Program schedules (WIB timezone) with correct durations
const PROGRAM_SCHEDULES = [
  { name: "Night Flow", startHour: 0, startMin: 0, endHour: 6, endMin: 0, durationMinutes: 360 },
  { name: "Good Morning Jakarta", startHour: 6, startMin: 0, endHour: 10, endMin: 0, durationMinutes: 240 },
  { name: "Office Hour", startHour: 10, startMin: 0, endHour: 13, endMin: 0, durationMinutes: 180 },
  { name: "Coffee Break", startHour: 13, startMin: 0, endHour: 16, endMin: 0, durationMinutes: 180 },
  { name: "Drive Time", startHour: 16, startMin: 0, endHour: 20, endMin: 0, durationMinutes: 240 },
  { name: "Shift Malam", startHour: 20, startMin: 0, endHour: 24, endMin: 0, durationMinutes: 240 },
];

// Operator shift schedules (WIB timezone)
const OPERATOR_SHIFTS = {
  shift1: { startHour: 5, endHour: 12 }, // 05:00-12:00
  shift2: { startHour: 12, endHour: 19 }, // 12:00-19:00
  shift3: { startHour: 19, endHour: 24 }, // 19:00-24:00
  nightShift: { startHour: 0, endHour: 5 }, // 00:00-05:00 (continuation of shift3)
};

// Operator schedule mapping: [day][shift] = operator_name
const OPERATOR_SCHEDULE: Record<string, Record<string, string>> = {
  monday: { shift1: "audrey", shift2: "jhosua", shift3: "aryo" },
  tuesday: { shift1: "rully", shift2: "jhosua", shift3: "aryo" },
  wednesday: { shift1: "rully", shift2: "ade", shift3: "aryo" },
  thursday: { shift1: "rully", shift2: "jhosua", shift3: "ade" },
  friday: { shift1: "audrey", shift2: "rully", shift3: "jhosua" },
  saturday: { shift1: "audrey", shift2: "rully", shift3: "aryo" },
  sunday: { shift1: "audrey", shift2: "ade", shift3: "internship" },
};

// Producer schedule mapping: [program][day] = producer_name
const PRODUCER_SCHEDULE: Record<string, Record<string, string>> = {
  "Good Morning Jakarta": {
    monday: "audrey", tuesday: "audrey", wednesday: "audrey", thursday: "audrey",
    friday: "audrey", saturday: "audrey", sunday: "audrey"
  },
  "Office Hour": {
    monday: "risan", tuesday: "indira", wednesday: "indira", thursday: "risan",
    friday: "risan", saturday: "risan", sunday: "risan"
  },
  "Coffee Break": {
    monday: "nayla", tuesday: "patricia", wednesday: "nayla", thursday: "patricia",
    friday: "patricia", saturday: "patricia", sunday: "nayla"
  },
  "Drive Time": {
    monday: "luvi", tuesday: "luvi", wednesday: "luvi", thursday: "luvi",
    friday: "luvi", saturday: "indira", sunday: "indira"
  },
  "Shift Malam": {
    monday: "jhosua", tuesday: "jhosua", wednesday: "jhosua", thursday: "jhosua",
    friday: "jhosua", saturday: "jhosua", sunday: "jhosua"
  },
  "Night Flow": {
    monday: "default", tuesday: "default", wednesday: "default", thursday: "default",
    friday: "default", saturday: "default", sunday: "default"
  },
};

function getDayOfWeekWIB(): string {
  const now = new Date();
  const wibOffset = 7 * 60;
  const localOffset = now.getTimezoneOffset();
  const wibTime = new Date(now.getTime() + (wibOffset + localOffset) * 60 * 1000);
  
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return days[wibTime.getDay()];
}

function getCurrentOperatorShift(): string | null {
  const now = new Date();
  const wibOffset = 7 * 60;
  const localOffset = now.getTimezoneOffset();
  const wibTime = new Date(now.getTime() + (wibOffset + localOffset) * 60 * 1000);
  
  const hour = wibTime.getHours();
  
  if (hour >= 5 && hour < 12) return "shift1";
  if (hour >= 12 && hour < 19) return "shift2";
  if (hour >= 19 && hour < 24) return "shift3";
  if (hour >= 0 && hour < 5) return "shift3"; // Night continuation
  
  return null;
}

function getCrewPhotoPath(role: "operator" | "produser", name: string): string {
  const normalizedName = name.toLowerCase();
  
  // Check if photo exists, otherwise return fallback
  const availablePhotos: Record<string, string> = {
    // Operators (blue uniform)
    "aryo_operator": "/attached_assets/opr_aryo_1760589447425.png",
    "audrey_operator": "/attached_assets/opr_audrey_1760589447426.png",
    "jhosua_operator": "/attached_assets/opr_jhosua_1760589447426.png",
    "rully_operator": "/attached_assets/opr_rully_1760589447426.png",
    
    // Producers (green military uniform)
    "audrey_produser": "/attached_assets/audrey_1760589432000.png",
    "jhosua_produser": "/attached_assets/jhosua_1760589432001.png",
    "luvi_produser": "/attached_assets/luvi_1760589432001.png",
    "nayla_produser": "/attached_assets/nayla_1760589432001.png",
    "patricia_produser": "/attached_assets/patricia_1760589432001.png",
    "risan_produser": "/attached_assets/raisan_1760589432001.png",
  };
  
  const key = `${normalizedName}_${role}`;
  
  // Return specific photo or fallback to internship photo
  return availablePhotos[key] || "/attached_assets/internship_1760589107237.png";
}

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
    
    // Use < for endMinutes (exclusive end time)
    if (minutesSinceMidnight >= startMinutes && minutesSinceMidnight < endMinutes) {
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
    "Night Flow": "#4CAF50", // Green
    "Good Morning Jakarta": "#FDD835", // Yellow
    "Office Hour": "#F44336", // Red
    "Coffee Break": "#2196F3", // Blue
    "Drive Time": "#00BCD4", // Cyan
    "Shift Malam": "#FF9800", // Orange
  };
  return colors[programName] || "#FDD835";
}

function formatDateIndonesian(dateStr: string): string {
  // Parse YYYY-MM-DD format
  const [year, month, day] = dateStr.split("-");
  const monthNames = [
    "JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI",
    "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"
  ];
  
  const monthName = monthNames[parseInt(month) - 1];
  return `${parseInt(day)} ${monthName}`;
}

function getDisplayProgramName(programName: string): string {
  const displayNames: Record<string, string> = {
    "Night Flow": "nightFLOW",
    "Good Morning Jakarta": "good MORNING JAKARTA",
    "Office Hour": "office HOUR",
    "Coffee Break": "coffee BREAK",
    "Drive Time": "drive TIME",
    "Shift Malam": "shift MALAM",
  };
  return displayNames[programName] || programName.toUpperCase();
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

      // Get multiplier from config (default 11 to match program analytics)
      const multiplierConfig = await storage.getConfig('listener_multiplier');
      const multiplier = multiplierConfig ? parseInt(multiplierConfig.value) : DEVICE_TO_LISTENER_MULTIPLIER;

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

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function ema(prev: number | null, value: number, alpha: number): number {
  if (prev === null) return value;
  return alpha * value + (1 - alpha) * prev;
}

function isSpike(curr: number, baseline: number | null, fallbackPrev: number | null): boolean {
  // Use baseline if available, otherwise fallback to previous value
  const reference = baseline !== null ? baseline : fallbackPrev;
  if (reference === null || reference === 0) return false;
  
  // Spike = deviation > 50% from baseline/reference
  const diff = Math.abs(curr - reference);
  return diff > 0.5 * reference;
}

async function calculateEMAListenerMinutes() {
  try {
    const currentProgram = getCurrentProgramWIB();
    if (!currentProgram) {
      console.log(`[EMA] No active program at this time`);
      return;
    }

    const wibDate = getWIBDate();
    
    // Get latest snapshot to get raw listeners (N)
    const recentStats = await storage.getRecentStats(0.05); // Last ~3 minutes
    if (recentStats.length === 0) {
      console.log(`[EMA] No snapshots available yet`);
      return;
    }
    
    const N = recentStats[0].listenersRaw; // Raw listeners from Icecast
    
    // Get or initialize EMA state for this program
    let state = programEMAStates.get(currentProgram);
    
    // Check if state is stale (different program or different date)
    const isStaleState = state && (state.programName !== currentProgram || state.date !== wibDate);
    
    if (!state || isStaleState) {
      if (isStaleState) {
        console.log(`[EMA] ${currentProgram}: Stale state detected (was ${state!.programName} on ${state!.date}), resetting...`);
      }
      
      state = {
        Nhat: null,
        lastN: null, // Critical: null ensures first 30-second interval has zero delta
        spikeWindowCount: 0,
        baselineN: null,
        startedAt: new Date(),
        programName: currentProgram,
        date: wibDate,
      };
      programEMAStates.set(currentProgram, state);
      console.log(`[EMA] ${currentProgram}: New program started for ${wibDate}, initializing state`);
    }
    
    // Spike handling: cap N during spike window
    let Nc = N;
    if (isSpike(N, state.baselineN, state.lastN)) {
      state.spikeWindowCount = 10; // Activate 5-minute spike window (10 × 30s intervals)
      const reference = state.baselineN !== null ? `baseline=${state.baselineN}` : `lastN=${state.lastN}`;
      console.log(`[EMA] ${currentProgram}: Spike detected! N=${N}, ${reference}`);
    }
    
    if (state.spikeWindowCount > 0 && state.lastN !== null) {
      const capUp = Math.round(state.lastN * 1.25); // Max 25% increase
      const capDown = Math.round(state.lastN * 0.75); // Max 25% decrease
      Nc = clamp(N, capDown, capUp);
      state.spikeWindowCount -= 1;
      if (Nc !== N) {
        const remainingSeconds = state.spikeWindowCount * 30;
        console.log(`[EMA] ${currentProgram}: Spike capped N=${N} → Nc=${Nc} (spike window: ${remainingSeconds}s left)`);
      }
    }
    
    // Calculate smoothed listeners (Nhat)
    state.Nhat = ema(state.Nhat, Nc, ALPHA);
    
    // Save 30-second snapshot to database
    await storage.saveMinuteSnapshot({
      programName: currentProgram,
      date: wibDate,
      rawListeners: N,
      Nhat: Math.round(state.Nhat), // Round to integer for database
    });
    
    // Get existing program stats
    const existingStats = await storage.getProgramStats(currentProgram, wibDate);
    // Scale by actual interval in minutes (30s = 0.5 minutes)
    const INTERVAL_MINUTES = EMA_INTERVAL / (60 * 1000);
    const LM = (existingStats?.LM || 0) + (N * INTERVAL_MINUTES); // Accumulate raw listener-minutes
    const LMhat = Math.round((existingStats?.LMhat || 0) + (state.Nhat * INTERVAL_MINUTES)); // Accumulate smoothed listener-minutes (rounded to integer)
    
    // Calculate baseline from first 5 minutes if not set (10 snapshots × 30s = 5 minutes)
    if (state.baselineN === null) {
      const snapshots = await storage.getRecentSnapshots(currentProgram, wibDate, 10);
      if (snapshots.length > 0) {
        const avgNhat = snapshots.reduce((sum, s) => sum + (s.Nhat || 0), 0) / snapshots.length;
        state.baselineN = Math.round(Math.max(0, avgNhat)); // Round to integer
        console.log(`[EMA] ${currentProgram}: Baseline calculated from ${snapshots.length} snapshots: ${state.baselineN}`);
      } else {
        state.baselineN = Math.round(state.Nhat || 0); // Round to integer
      }
    }
    
    // Get program schedule
    const programSchedule = PROGRAM_SCHEDULES.find(p => p.name === currentProgram);
    if (!programSchedule) {
      console.error(`[EMA] Program schedule not found for: ${currentProgram}`);
      return;
    }
    
    // Calculate elapsed minutes from program start time (based on schedule)
    // Use same WIB conversion logic as getCurrentProgramWIB() to avoid double-offset
    const now = new Date();
    const wibOffset = 7 * 60; // WIB = UTC+7
    const localOffset = now.getTimezoneOffset();
    const wibTime = new Date(now.getTime() + (wibOffset + localOffset) * 60 * 1000);
    const currentHour = wibTime.getHours();
    const currentMinute = wibTime.getMinutes();
    const currentMinutesSinceMidnight = currentHour * 60 + currentMinute;
    const programStartMinutes = programSchedule.startHour * 60 + programSchedule.startMin;
    
    let elapsedMinutes: number;
    if (currentMinutesSinceMidnight >= programStartMinutes) {
      elapsedMinutes = Math.max(1, currentMinutesSinceMidnight - programStartMinutes);
    } else {
      // Handle midnight crossing
      elapsedMinutes = Math.max(1, (24 * 60) - programStartMinutes + currentMinutesSinceMidnight);
    }
    
    // Calculate progress based on TIME (not listener-minutes!)
    // Progress should be 0% at start and 100% at end, regardless of listener count
    const progressRatio = Math.min(elapsedMinutes / programSchedule.durationMinutes, 1.0); // Cap at 1.0 (100%)
    const progress = progressRatio * 100; // Keep decimal precision
    
    // Calculate targetLM for reference (not used for progress anymore)
    const targetLM = programSchedule.durationMinutes * (state.baselineN || 0);
    
    // Get ALT_session from config (default 45 minutes) - kept for potential future use
    const altSessionConfig = await storage.getConfigValue('alt_session');
    const ALT_session = altSessionConfig ? parseInt(altSessionConfig) : 45;
    
    // Calculate new metrics based on user requirements (Oct 2025):
    // 1. avgConcurrentListeners for display = raw listeners (N) × 11 (multiplier is for display only!)
    const avgConcurrentListeners = Math.round(N * DEVICE_TO_LISTENER_MULTIPLIER);
    
    // 2. "TOTAL PENDENGAR" (estimated unique) = raw listeners (N) × 8 × percentage progress
    // NOTE: We use RAW listeners (N) here, NOT the multiplied value!
    // Multiplier 11x is only for display purposes, not for unique listener calculation
    const estimatedUniqueListeners = Math.round(N * 8 * (progress / 100));
    
    // Update program stats in database (all values rounded to integers)
    await storage.updateProgramStats(currentProgram, wibDate, {
      LM: Math.round(LM),
      LMhat: Math.round(LMhat),
      Nhat: Math.round(state.Nhat),
      baseline: state.baselineN,
      targetLM: Math.round(targetLM),
      progress,
      elapsedMinutes,
      avgConcurrentListeners,
      estimatedUniqueListeners,
      startTime: `${String(programSchedule.startHour).padStart(2, '0')}:${String(programSchedule.startMin).padStart(2, '0')}`,
      endTime: `${String(programSchedule.endHour).padStart(2, '0')}:${String(programSchedule.endMin).padStart(2, '0')}`,
    });
    
    state.lastN = N;
    
    console.log(`[EMA] ${currentProgram}: N=${N}, Nhat=${state.Nhat.toFixed(1)}, Current=${avgConcurrentListeners} (N×11), Total=${estimatedUniqueListeners} (N×8×${progress.toFixed(1)}%)`);
    
  } catch (error) {
    console.error(`[EMA] Error calculating EMA:`, error);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve static files from attached_assets directory
  // This must be registered BEFORE Vite's catch-all route to prevent HTML being served for image requests
  const attachedAssetsPath = path.resolve(import.meta.dirname, "..", "attached_assets");
  app.use("/attached_assets", express.static(attachedAssetsPath));

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

      // Get multiplier from config (default 11 to match program analytics)
      const multiplierConfig = await storage.getConfig('listener_multiplier');
      const multiplier = multiplierConfig ? parseInt(multiplierConfig.value) : DEVICE_TO_LISTENER_MULTIPLIER;

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
      endHour: 24,
      endMinute: 0,
      description: "Menemani malam dengan musik santai dan request lagu favorit.",
      imageUrl: "https://www.tjradiojakarta.com/shows/shiftmalam-dennych-ekokuntadhi.jpg"
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

  function getNextProgram(): ProgramSchedule {
    // Get current time in Jakarta timezone (WIB = UTC+7)
    const now = new Date();
    const jakartaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
    const currentHour = jakartaTime.getHours();
    const currentMinute = jakartaTime.getMinutes();
    const currentMinutesSinceMidnight = currentHour * 60 + currentMinute;

    // Find current program first
    let currentIndex = -1;
    for (let i = 0; i < programSchedules.length; i++) {
      const program = programSchedules[i];
      const startMinutes = program.startHour * 60 + program.startMinute;
      const endMinutes = program.endHour * 60 + program.endMinute;

      // Handle midnight crossing
      if (startMinutes > endMinutes) {
        if (currentMinutesSinceMidnight >= startMinutes || currentMinutesSinceMidnight < endMinutes) {
          currentIndex = i;
          break;
        }
      } else {
        if (currentMinutesSinceMidnight >= startMinutes && currentMinutesSinceMidnight < endMinutes) {
          currentIndex = i;
          break;
        }
      }
    }

    // Return next program (wrap around to first if at end)
    const nextIndex = (currentIndex + 1) % programSchedules.length;
    return programSchedules[nextIndex];
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

  // Calculate real-time progress based on current WIB time
  function calculateRealTimeProgress(program: { startHour: number; startMin: number; endHour: number; endMin: number; durationMinutes: number }): number {
    // Get current time in Jakarta timezone (WIB = UTC+7)
    const now = new Date();
    const jakartaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
    const currentHour = jakartaTime.getHours();
    const currentMinute = jakartaTime.getMinutes();
    const currentMinutesSinceMidnight = currentHour * 60 + currentMinute;

    const startMinutes = program.startHour * 60 + program.startMin;
    const endMinutes = program.endHour * 60 + program.endMin;

    // Handle midnight crossing
    let elapsedMinutes = 0;
    if (startMinutes > endMinutes) {
      // Midnight crossing (e.g., Night Flow 00:00-06:00)
      if (currentMinutesSinceMidnight >= startMinutes) {
        // Still same day (e.g., 23:30)
        elapsedMinutes = currentMinutesSinceMidnight - startMinutes;
      } else if (currentMinutesSinceMidnight < endMinutes) {
        // Next day (e.g., 02:30)
        elapsedMinutes = (1440 - startMinutes) + currentMinutesSinceMidnight;
      } else {
        // Program already finished
        return 100;
      }
    } else {
      // Normal case (no midnight crossing)
      if (currentMinutesSinceMidnight < startMinutes) {
        // Program not started yet
        return 0;
      } else if (currentMinutesSinceMidnight >= endMinutes) {
        // Program already finished
        return 100;
      } else {
        // Program in progress
        elapsedMinutes = currentMinutesSinceMidnight - startMinutes;
      }
    }

    // Calculate progress: (elapsed / duration) × 100, capped at 100%
    const progressRatio = Math.min(elapsedMinutes / program.durationMinutes, 1.0);
    return progressRatio * 100;
  }

  // API endpoint to get program listeners with EMA-based calculation
  app.get("/api/program-listeners", async (req, res) => {
    try {
      const wibDate = getWIBDate();
      const currentProgramName = getCurrentProgramWIB();
      
      const programsData = await Promise.all(
        PROGRAM_SCHEDULES.map(async (program) => {
          const stats = await storage.getProgramStats(program.name, wibDate);
          
          // Use new metrics: avgConcurrentListeners and estimatedUniqueListeners
          const cumulativeListeners = stats?.estimatedUniqueListeners || 0;
          const avgConcurrent = stats?.avgConcurrentListeners || 0;
          
          // Calculate real-time progress based on current WIB time
          const progressPercent = calculateRealTimeProgress(program);
          
          return {
            programName: program.name,
            displayName: program.name,
            timeRange: `${String(program.startHour).padStart(2, '0')}:${String(program.startMin).padStart(2, '0')} - ${String(program.endHour).padStart(2, '0')}:${String(program.endMin).padStart(2, '0')}`,
            startTime: `${String(program.startHour).padStart(2, '0')}:${String(program.startMin).padStart(2, '0')}`,
            endTime: `${String(program.endHour).padStart(2, '0')}:${String(program.endMin).padStart(2, '0')}`,
            cumulativeListeners,
            avgConcurrent,
            progressPercent,
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

  // API endpoint to get on-air program (use hardcoded schedule - web scraping unreliable)
  app.get("/api/on-air-program", async (req, res) => {
    try {
      // Use hardcoded schedule directly (web scraping is unreliable due to JS rendering)
      const currentProgram = getCurrentProgram();
      const formattedTimeRange = formatTimeRange(currentProgram);

      console.log(`[OnAir] Using schedule: ${currentProgram.title} (${formattedTimeRange})`);
      
      res.json({
        programTitle: currentProgram.title,
        presenter: currentProgram.presenter,
        timeRange: formattedTimeRange,
        description: currentProgram.description,
        imageUrl: currentProgram.imageUrl,
        status: "LIVE",
        source: "schedule" // Always use schedule (reliable)
      });
    } catch (error) {
      console.error("Error determining on-air program:", error);
      res.status(500).json({ 
        error: "Failed to determine on-air program",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // API endpoint to get coming up next program
  app.get("/api/coming-up-next", async (req, res) => {
    try {
      const nextProgram = getNextProgram();
      const formattedTimeRange = formatTimeRange(nextProgram);

      console.log(`[ComingUpNext] Next program: ${nextProgram.title} (${formattedTimeRange})`);
      
      res.json({
        programTitle: nextProgram.title,
        presenter: nextProgram.presenter,
        timeRange: formattedTimeRange,
        description: nextProgram.description,
        imageUrl: nextProgram.imageUrl,
        status: "UPCOMING",
        source: "schedule"
      });
    } catch (error) {
      console.error("Error determining coming up next program:", error);
      res.status(500).json({ 
        error: "Failed to determine coming up next program",
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

  // API endpoint for 3-day statistics
  app.get("/api/three-day-stats", async (req, res) => {
    try {
      // Disable caching to always return fresh data
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      const today = getWIBDate();
      const [year, month, day] = today.split('-').map(Number);
      
      // Calculate dates for last 3 days (yesterday, 2 days ago, 3 days ago)
      const dates = [];
      for (let i = 1; i <= 3; i++) {
        // Create date in local timezone to avoid UTC conversion issues
        const date = new Date(year, month - 1, day);
        date.setDate(date.getDate() - i);
        const dateYear = date.getFullYear();
        const dateMonth = String(date.getMonth() + 1).padStart(2, '0');
        const dateDay = String(date.getDate()).padStart(2, '0');
        dates.push(`${dateYear}-${dateMonth}-${dateDay}`);
      }
      
      // Get program stats for the last 3 days
      const dailyStats = await Promise.all(
        dates.map(async (date) => {
          const stats = await storage.getAllProgramStatsForDate(date);
          
          // Sum up estimated unique listeners from all 6 programs for this day
          const totalListeners = stats.reduce(
            (sum: number, stat) => sum + (stat.estimatedUniqueListeners || 0),
            0
          );
          
          return {
            date,
            totalListeners,
            programs: stats,
          };
        })
      );
      
      // Find program with highest listeners across all 3 days
      let recordProgram = {
        name: "",
        listeners: 0,
      };
      
      dailyStats.forEach(({ programs }) => {
        programs.forEach((stat) => {
          if (stat.estimatedUniqueListeners > recordProgram.listeners) {
            recordProgram = {
              name: stat.programName,
              listeners: stat.estimatedUniqueListeners,
            };
          }
        });
      });
      
      // Format response
      const response = {
        dailyStats: dailyStats.map(({ date, totalListeners }) => ({
          date,
          totalListeners,
          formattedDate: formatDateIndonesian(date),
        })),
        recordProgram: {
          name: recordProgram.name,
          listeners: recordProgram.listeners,
          displayName: getDisplayProgramName(recordProgram.name),
        },
      };
      
      res.json(response);
    } catch (error) {
      console.error("Error fetching 3-day stats:", error);
      res.status(500).json({ error: "Failed to fetch 3-day statistics" });
    }
  });

  // API endpoint for crew on duty (Operator + Producer)
  app.get("/api/crew-on-duty", async (req, res) => {
    try {
      const currentProgram = getCurrentProgramWIB();
      const currentShift = getCurrentOperatorShift();
      
      if (!currentProgram || !currentShift) {
        return res.status(500).json({ 
          error: "Unable to determine current program or shift" 
        });
      }
      
      // Get WIB time for day calculation
      const now = new Date();
      const wibOffset = 7 * 60;
      const localOffset = now.getTimezoneOffset();
      const wibTime = new Date(now.getTime() + (wibOffset + localOffset) * 60 * 1000);
      const hour = wibTime.getHours();
      
      // Determine which day to use for operator lookup
      // If hour is 00:00-04:59 (midnight continuation of shift3), use PREVIOUS day
      let operatorDay: string;
      if (hour >= 0 && hour < 5) {
        // Use previous day's shift3 operator
        const prevDayDate = new Date(wibTime);
        prevDayDate.setDate(prevDayDate.getDate() - 1);
        const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
        operatorDay = days[prevDayDate.getDay()];
      } else {
        // Use current day
        const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
        operatorDay = days[wibTime.getDay()];
      }
      
      // For producer, always use current WIB day
      const producerDay = getDayOfWeekWIB();
      
      // Get operator name from schedule
      const operatorName = OPERATOR_SCHEDULE[operatorDay]?.[currentShift] || "unknown";
      
      // Get producer name from schedule
      const producerName = PRODUCER_SCHEDULE[currentProgram]?.[producerDay] || "default";
      
      // Get photo paths
      const operatorPhoto = getCrewPhotoPath("operator", operatorName);
      const producerPhoto = getCrewPhotoPath("produser", producerName);
      
      // Format names for display - fallback to "CREW" for staff without photos or Night Flow default
      const formatName = (name: string) => {
        if (name === "unknown" || name === "default" || name === "internship" || name === "ade" || name === "indira") {
          return "CREW";
        }
        return name.toUpperCase();
      };
      
      res.json({
        operator: {
          name: formatName(operatorName),
          photoUrl: operatorPhoto,
        },
        producer: {
          name: formatName(producerName),
          photoUrl: producerPhoto,
        },
        currentProgram,
        operatorDay,
        producerDay,
        currentShift,
      });
    } catch (error) {
      console.error("Error fetching crew on duty:", error);
      res.status(500).json({ error: "Failed to fetch crew on duty" });
    }
  });

  const httpServer = createServer(app);

  // Start background job for saving stats snapshots (every 5 minutes)
  // Note: We keep snapshot job separate for historical data tracking
  const SNAPSHOT_INTERVAL = 5 * 60 * 1000; // 5 minutes
  let snapshotInterval: NodeJS.Timeout | null = null;
  
  if (snapshotInterval) {
    clearInterval(snapshotInterval);
  }
  
  // Save initial snapshot
  saveStatsSnapshot();
  
  // Schedule periodic snapshots every 5 minutes
  snapshotInterval = setInterval(saveStatsSnapshot, SNAPSHOT_INTERVAL);
  console.log(`[Snapshot] Background job started - saving every ${SNAPSHOT_INTERVAL / 1000 / 60} minute(s)`);

  // Start background job for EMA calculation (every 1 minute)
  if (emaInterval) {
    clearInterval(emaInterval);
  }
  
  // Calculate EMA after initial delay (to have data)
  setTimeout(calculateEMAListenerMinutes, EMA_INTERVAL);
  
  // Schedule periodic EMA calculation every 30 seconds
  emaInterval = setInterval(calculateEMAListenerMinutes, EMA_INTERVAL);
  console.log(`[EMA] Background job started - calculating every ${EMA_INTERVAL / 1000} second(s)`);

  return httpServer;
}
