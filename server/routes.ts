import type { Express } from "express";
import { createServer, type Server } from "http";
import axios from "axios";
import * as cheerio from "cheerio";
import express from "express";
import path from "path";
import { radioStatsSchema } from "@shared/schema";
import { storage } from "./storage";

// Background job interval (30 seconds for EMA tracking and stream health)
const EMA_INTERVAL = 30 * 1000;
const STREAM_HEALTH_INTERVAL = 30 * 1000; // Check stream health every 30 seconds

let emaInterval: NodeJS.Timeout | null = null;
let streamHealthInterval: NodeJS.Timeout | null = null;

// Stream Health Monitoring
interface StreamHealthMetrics {
  lastResponseTime: number; // ms
  lastCheckTime: Date;
  successCount: number;
  failureCount: number;
  status: 'excellent' | 'good' | 'degraded' | 'offline' | 'initializing';
  recentResponseTimes: number[]; // Last 10 response times
  isInitialized: boolean;
}

const streamHealth: StreamHealthMetrics = {
  lastResponseTime: 0,
  lastCheckTime: new Date(),
  successCount: 0,
  failureCount: 0,
  status: 'initializing',
  recentResponseTimes: [],
  isInitialized: false
};

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

// Program schedules (WIB timezone) - Different for weekday vs weekend
const WEEKDAY_SCHEDULES = [
  { name: "Night Flow", startHour: 0, startMin: 0, endHour: 6, endMin: 0, durationMinutes: 360 },
  { name: "Good Morning Jakarta", startHour: 6, startMin: 0, endHour: 10, endMin: 0, durationMinutes: 240 },
  { name: "Office Hour", startHour: 10, startMin: 0, endHour: 13, endMin: 0, durationMinutes: 180 },
  { name: "Coffee Break", startHour: 13, startMin: 0, endHour: 16, endMin: 0, durationMinutes: 180 },
  { name: "Drive Time", startHour: 16, startMin: 0, endHour: 20, endMin: 0, durationMinutes: 240 },
  { name: "Shift Malam", startHour: 20, startMin: 0, endHour: 24, endMin: 0, durationMinutes: 240 },
];

const SATURDAY_SCHEDULES = [
  { name: "Night Flow", startHour: 0, startMin: 0, endHour: 6, endMin: 0, durationMinutes: 360 },
  { name: "Good Morning JKT Weekend", startHour: 6, startMin: 0, endHour: 10, endMin: 0, durationMinutes: 240 },
  { name: "Rute Akhir Pekan", startHour: 10, startMin: 0, endHour: 12, endMin: 0, durationMinutes: 120 },
  { name: "Song on the Week", startHour: 12, startMin: 0, endHour: 13, endMin: 0, durationMinutes: 60 },
  { name: "Afternoon Show", startHour: 13, startMin: 0, endHour: 16, endMin: 0, durationMinutes: 180 },
  { name: "Drive Time Weekend", startHour: 16, startMin: 0, endHour: 20, endMin: 0, durationMinutes: 240 },
  { name: "MALMING (TAPPING)", startHour: 20, startMin: 0, endHour: 22, endMin: 0, durationMinutes: 120 },
  { name: "Shift Malam", startHour: 22, startMin: 0, endHour: 24, endMin: 0, durationMinutes: 120 },
];

const SUNDAY_SCHEDULES = [
  { name: "Night Flow", startHour: 0, startMin: 0, endHour: 6, endMin: 0, durationMinutes: 360 },
  { name: "Good Morning JKT Weekend", startHour: 6, startMin: 0, endHour: 10, endMin: 0, durationMinutes: 240 },
  { name: "Rute Akhir Pekan", startHour: 10, startMin: 0, endHour: 12, endMin: 0, durationMinutes: 120 },
  { name: "Song on the Week", startHour: 12, startMin: 0, endHour: 13, endMin: 0, durationMinutes: 60 },
  { name: "Afternoon Show", startHour: 13, startMin: 0, endHour: 16, endMin: 0, durationMinutes: 180 },
  { name: "Drive Time Weekend", startHour: 16, startMin: 0, endHour: 20, endMin: 0, durationMinutes: 240 },
  { name: "Weekend Seru", startHour: 20, startMin: 0, endHour: 22, endMin: 0, durationMinutes: 120 },
  { name: "Shift Malam", startHour: 22, startMin: 0, endHour: 24, endMin: 0, durationMinutes: 120 },
];

// Helper function to get current day's schedule
function getProgramSchedules(): typeof WEEKDAY_SCHEDULES {
  const dayOfWeek = getDayOfWeekWIB();
  if (dayOfWeek === "saturday") return SATURDAY_SCHEDULES;
  if (dayOfWeek === "sunday") return SUNDAY_SCHEDULES;
  return WEEKDAY_SCHEDULES;
}

// For backward compatibility
const PROGRAM_SCHEDULES = WEEKDAY_SCHEDULES;

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

// Producer schedule mapping: [program][day] = producer_name (updated from CSV file)
const PRODUCER_SCHEDULE: Record<string, Record<string, string>> = {
  "Good Morning Jakarta": {
    monday: "audrey", tuesday: "zakiya", wednesday: "zakiya", thursday: "audrey",
    friday: "zakiya", saturday: "zakiya", sunday: "audrey"
  },
  "Good Morning JKT Weekend": {
    monday: "zakiya", tuesday: "zakiya", wednesday: "zakiya", thursday: "zakiya",
    friday: "zakiya", saturday: "zakiya", sunday: "audrey"
  },
  "Office Hour": {
    monday: "risan", tuesday: "indira", wednesday: "indira", thursday: "risan",
    friday: "risan", saturday: "indira", sunday: "indira"
  },
  "Rute Akhir Pekan": {
    monday: "indira", tuesday: "indira", wednesday: "indira", thursday: "indira",
    friday: "indira", saturday: "indira", sunday: "indira"
  },
  "Coffee Break": {
    monday: "nayla", tuesday: "patricia", wednesday: "nayla", thursday: "patricia",
    friday: "patricia", saturday: "patricia", sunday: "patricia"
  },
  "Song on the Week": {
    monday: "default", tuesday: "default", wednesday: "default", thursday: "default",
    friday: "default", saturday: "default", sunday: "default"
  },
  "Afternoon Show": {
    monday: "patricia", tuesday: "patricia", wednesday: "patricia", thursday: "patricia",
    friday: "patricia", saturday: "patricia", sunday: "nayla"
  },
  "Drive Time": {
    monday: "luvi", tuesday: "luvi", wednesday: "luvi", thursday: "luvi",
    friday: "luvi", saturday: "sakinah", sunday: "sakinah"
  },
  "Drive Time Weekend": {
    monday: "sakinah", tuesday: "sakinah", wednesday: "sakinah", thursday: "sakinah",
    friday: "sakinah", saturday: "sakinah", sunday: "sakinah"
  },
  "Shift Malam": {
    monday: "jhosua", tuesday: "jhosua", wednesday: "jhosua", thursday: "jhosua",
    friday: "jhosua", saturday: "jhosua", sunday: "jhosua"
  },
  "MALMING (TAPPING)": {
    monday: "jhosua", tuesday: "jhosua", wednesday: "jhosua", thursday: "jhosua",
    friday: "jhosua", saturday: "jhosua", sunday: "jhosua"
  },
  "Weekend Seru": {
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
  
  // Check if photo exists, otherwise return fallback (updated with new operator and producer photos)
  const availablePhotos: Record<string, string> = {
    // Operators (professional photos)
    "aryo_operator": "/attached_assets/opr_aryo_1762105125710.png",
    "audrey_operator": "/attached_assets/opr_audrey_1760589447426.png",
    "jhosua_operator": "/attached_assets/opr_jhosua_1760589447426.png",
    "rully_operator": "/attached_assets/opr_rully_1760589447426.png",
    "ade_operator": "/attached_assets/opr_ade_1762099159402.png",
    
    // Operators - Magang/Interns
    "internship_operator": "/attached_assets/magang_farhan_1762097040086.png",
    
    // Producers (new professional photos)
    "audrey_produser": "/attached_assets/produser_audrey_1762125589588.png",
    "jhosua_produser": "/attached_assets/produser_jhosua_1762098258506.png",
    "luvi_produser": "/attached_assets/produser_luvi_1762098258507.png",
    "nayla_produser": "/attached_assets/produser_nayla_1762098258507.png",
    "patricia_produser": "/attached_assets/produser_patricia_1762098258507.png",
    "risan_produser": "/attached_assets/produser_risan_1762098258507.png",
    "odah_produser": "/attached_assets/host_odah_1762096257881.png",
    
    // Producers - Magang/Interns
    "zakiya_produser": "/attached_assets/magang_zakiya_1762097040087.png",
    "indira_produser": "/attached_assets/magang_indira_1762097040087.png",
    "sakinah_produser": "/attached_assets/magang_sakinanh_1762097040087.png",
    "opet_produser": "/attached_assets/magang_elsa_1762097040086.png",
  };
  
  const key = `${normalizedName}_${role}`;
  
  // Return specific photo or fallback to sementara.png
  return availablePhotos[key] || "/attached_assets/sementara_1762090833934.png";
}

function getHostPhotoPath(hostName: string): string {
  const normalizedName = hostName.toLowerCase().trim();
  
  // Host photo mapping - 22 unique hosts with photos (including PUTRI, SALSA, SAKINAH)
  const hostPhotos: Record<string, string> = {
    // Main hosts from schedule
    "abi": "/attached_assets/host_abisaan_1762096185716.png",
    "akbar": "/attached_assets/host_akbar_1762096185716.png",
    "cak lontong": "/attached_assets/host_caklontong_1762096185716.png",
    "caklontong": "/attached_assets/host_caklontong_1762096185716.png",
    "denny": "/attached_assets/host_dennychandra_1762096202310.png",
    "denny ch": "/attached_assets/host_dennychandra_1762096202310.png",
    "dany": "/attached_assets/host_mcdanny_1762096221521.png",
    "eko": "/attached_assets/host_ekokuntadhi_1762096202311.png",
    "eko kuntadhi": "/attached_assets/host_ekokuntadhi_1762096202311.png",
    "hatma": "/attached_assets/host_hatma_1762096202311.png",
    "indy": "/attached_assets/host_indyrahmawati_1762096202311.png",
    "irwan": "/attached_assets/host_irwanardian_1762096221521.png",
    "luvi": "/attached_assets/host_luvi_1762096221521.png",
    "mazdjo": "/attached_assets/host_mazdjopray_1762096221521.png",
    "mazjo": "/attached_assets/host_mazdjopray_1762096221521.png",
    "mo": "/attached_assets/host_mosidik_1762096221522.png",
    "mosidik": "/attached_assets/host_mosidik_1762096221522.png",
    "nayla": "/attached_assets/host_nayla_1762096257881.png",
    "odah": "/attached_assets/host_odah_1762096257881.png",
    "ot": "/attached_assets/host_otsyech_1762096257882.png",
    "putri": "/attached_assets/magang_putri_1762097040087.png",
    "reno": "/attached_assets/host_reno_1762096257882.png",
    "rio": "/attached_assets/host_rio_1762096257882.png",
    "risan": "/attached_assets/host_risan_1762096272039.png",
    "sakinah": "/attached_assets/magang_sakinanh_1762097040087.png",
    "salsa": "/attached_assets/magang_salsabilla_1762097040087.png",
    "salsabilla": "/attached_assets/magang_salsabilla_1762097040087.png",
    "yasser": "/attached_assets/host_yasser_1762096272039.png",
  };
  
  return hostPhotos[normalizedName] || "/attached_assets/sementara_1762090833934.png";
}

function getCurrentProgramWIB(): string | null {
  const now = new Date();
  const wibOffset = 7 * 60; // WIB is UTC+7
  const localOffset = now.getTimezoneOffset();
  const wibTime = new Date(now.getTime() + (wibOffset + localOffset) * 60 * 1000);
  
  const hour = wibTime.getHours();
  const minute = wibTime.getMinutes();
  const minutesSinceMidnight = hour * 60 + minute;

  // Get the correct schedule for current day
  const schedules = getProgramSchedules();

  for (const program of schedules) {
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
    "Good Morning JKT Weekend": "#FDD835", // Yellow
    "Office Hour": "#F44336", // Red
    "Rute Akhir Pekan": "#9C27B0", // Purple
    "Coffee Break": "#2196F3", // Blue
    "Song on the Week": "#E91E63", // Pink
    "Afternoon Show": "#E91E63", // Pink (NEW)
    "Drive Time": "#00BCD4", // Cyan
    "Drive Time Weekend": "#00BCD4", // Cyan (NEW)
    "MALMING (TAPPING)": "#FF5722", // Deep Orange
    "Weekend Seru": "#8BC34A", // Light Green
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
    "Good Morning JKT Weekend": "good MORNING JKT weekend",
    "Office Hour": "office HOUR",
    "Rute Akhir Pekan": "rute AKHIR PEKAN",
    "Coffee Break": "coffee BREAK",
    "Song on the Week": "song ON THE week",
    "Afternoon Show": "afternoon SHOW",
    "Drive Time": "drive TIME",
    "Drive Time Weekend": "drive TIME weekend",
    "MALMING (TAPPING)": "MALMING (tapping)",
    "Weekend Seru": "weekend SERU",
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
    
    // Calculate new metrics based on user requirements (Oct 17, 2025):
    // 1. "PENDENGAR SAAT INI" for display = raw listeners (N) × 11
    const avgConcurrentListeners = Math.round(N * DEVICE_TO_LISTENER_MULTIPLIER);
    
    // 2. "TOTAL PENDENGAR" (estimated unique) = PENDENGAR SAAT INI × 6 × percentage progress
    // Formula: (N × 11) × 6 × progress% = N × 66 × progress%
    const estimatedUniqueListeners = Math.round(avgConcurrentListeners * 6 * (progress / 100));
    
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
    
    console.log(`[EMA] ${currentProgram}: N=${N}, Nhat=${state.Nhat.toFixed(1)}, Current=${avgConcurrentListeners} (N×11), Total=${estimatedUniqueListeners} (Current×6×${progress.toFixed(1)}%)`);
    
  } catch (error) {
    console.error(`[EMA] Error calculating EMA:`, error);
  }
}

// Server-side stream health checker (runs independently of client traffic)
// This performs a lightweight check to verify the Icecast server is accessible and responding
async function checkStreamHealthIndependently() {
  const startTime = Date.now();
  try {
    // Perform simple HTTP request to verify server accessibility
    // Note: This checks server availability, not individual mount points
    // A successful response indicates the streaming infrastructure is operational
    const response = await axios.get("https://stream-eu-nc.arenastreaming.com:5450/", {
      timeout: 5000,
      maxRedirects: 0, // Don't follow redirects for faster response
      validateStatus: (status) => status === 200, // Only accept HTTP 200
    });
    
    // Verify response actually contains content (not just 200 with empty body)
    const hasContent = response.data && response.data.length > 0;
    
    if (!hasContent) {
      throw new Error("Server returned 200 but no content");
    }
    
    // Track successful response
    const responseTime = Date.now() - startTime;
    streamHealth.lastResponseTime = responseTime;
    streamHealth.lastCheckTime = new Date();
    streamHealth.successCount++;
    streamHealth.isInitialized = true;
    
    // Reset failure count on successful request (recovery)
    if (streamHealth.failureCount > 0) {
      streamHealth.failureCount = 0;
    }
    
    // Add to recent response times (keep last 10)
    streamHealth.recentResponseTimes.push(responseTime);
    if (streamHealth.recentResponseTimes.length > 10) {
      streamHealth.recentResponseTimes.shift();
    }
    
    // Calculate average response time (guard against empty array)
    const avgResponseTime = streamHealth.recentResponseTimes.length > 0
      ? streamHealth.recentResponseTimes.reduce((a, b) => a + b, 0) / streamHealth.recentResponseTimes.length
      : responseTime;
    
    // Determine health status based on response time
    if (avgResponseTime < 300) {
      streamHealth.status = 'excellent';
    } else if (avgResponseTime < 1000) {
      streamHealth.status = 'good';
    } else if (avgResponseTime < 3000) {
      streamHealth.status = 'degraded';
    } else {
      streamHealth.status = 'offline';
    }
    
    console.log(`[StreamHealth] Check successful: ${responseTime}ms (avg: ${Math.round(avgResponseTime)}ms, status: ${streamHealth.status})`);
  } catch (error) {
    // Track failed response
    const responseTime = Date.now() - startTime;
    streamHealth.lastResponseTime = responseTime;
    streamHealth.lastCheckTime = new Date();
    streamHealth.failureCount++;
    streamHealth.status = 'offline';
    streamHealth.isInitialized = true;
    
    // On failure, keep last successful average or use current failed time
    // Don't clear recentResponseTimes immediately to prevent NaN
    if (streamHealth.failureCount > 3 && streamHealth.recentResponseTimes.length > 0) {
      // Gradually phase out old good times by removing oldest
      streamHealth.recentResponseTimes.shift();
    }
    
    console.error(`[StreamHealth] Check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve static files from attached_assets directory
  // This must be registered BEFORE Vite's catch-all route to prevent HTML being served for image requests
  const attachedAssetsPath = path.resolve(import.meta.dirname, "..", "attached_assets");
  app.use("/attached_assets", express.static(attachedAssetsPath));

  // API endpoint to fetch current radio statistics
  app.get("/api/radio-stats", async (req, res) => {
    const startTime = Date.now();
    try {
      const response = await axios.get("https://stream-eu-nc.arenastreaming.com:5450/", {
        timeout: 10000,
      });
      
      // Track successful response
      const responseTime = Date.now() - startTime;
      streamHealth.lastResponseTime = responseTime;
      streamHealth.lastCheckTime = new Date();
      streamHealth.successCount++;
      
      // Reset failure count on successful request (recovery)
      if (streamHealth.failureCount > 0) {
        streamHealth.failureCount = 0;
      }
      
      // Add to recent response times (keep last 10)
      streamHealth.recentResponseTimes.push(responseTime);
      if (streamHealth.recentResponseTimes.length > 10) {
        streamHealth.recentResponseTimes.shift();
      }
      
      // Calculate average response time
      const avgResponseTime = streamHealth.recentResponseTimes.reduce((a, b) => a + b, 0) / streamHealth.recentResponseTimes.length;
      
      // Determine health status based on response time and success rate
      // Excellent: < 300ms, Good: < 1000ms, Degraded: < 3000ms, Offline: > 3000ms or error
      if (avgResponseTime < 300) {
        streamHealth.status = 'excellent';
      } else if (avgResponseTime < 1000) {
        streamHealth.status = 'good';
      } else if (avgResponseTime < 3000) {
        streamHealth.status = 'degraded';
      } else {
        streamHealth.status = 'offline';
      }

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
      // Track failed response
      const responseTime = Date.now() - startTime;
      streamHealth.lastResponseTime = responseTime;
      streamHealth.lastCheckTime = new Date();
      streamHealth.failureCount++;
      streamHealth.status = 'offline';
      
      // Clear recent response times on consecutive failures to reflect actual health
      if (streamHealth.failureCount > 2) {
        streamHealth.recentResponseTimes = [];
      }
      
      console.error("Error fetching radio stats:", error);
      res.status(500).json({ 
        error: "Failed to fetch radio statistics",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // API endpoint to get stream health status
  app.get("/api/stream-health", async (req, res) => {
    try {
      // Return current status (independently tracked by server-side job)
      const totalRequests = streamHealth.successCount + streamHealth.failureCount;
      const successRate = totalRequests > 0 ? (streamHealth.successCount / totalRequests) * 100 : 100;
      
      const avgResponseTime = streamHealth.recentResponseTimes.length > 0 
        ? Math.round(streamHealth.recentResponseTimes.reduce((a, b) => a + b, 0) / streamHealth.recentResponseTimes.length)
        : 0;
      
      res.json({
        status: streamHealth.status,
        lastResponseTime: streamHealth.lastResponseTime,
        avgResponseTime,
        successRate: Math.round(successRate),
        lastCheckTime: streamHealth.lastCheckTime.toISOString(),
        isInitialized: streamHealth.isInitialized,
        totalRequests,
        successCount: streamHealth.successCount,
        failureCount: streamHealth.failureCount,
      });
    } catch (error) {
      console.error("Error getting stream health:", error);
      res.status(500).json({ 
        error: "Failed to get stream health",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // API endpoint to fetch Jakarta weather from Open-Meteo
  app.get("/api/jakarta-weather", async (req, res) => {
    try {
      // Jakarta coordinates
      const latitude = -6.2088;
      const longitude = 106.8456;
      
      const response = await axios.get("https://api.open-meteo.com/v1/forecast", {
        params: {
          latitude,
          longitude,
          current_weather: true,
          timezone: "Asia/Jakarta",
        },
        timeout: 10000,
      });

      // Guard against malformed responses
      if (!response.data || !response.data.current_weather) {
        throw new Error("Invalid weather data structure from Open-Meteo");
      }

      const weatherData = response.data.current_weather;
      
      // Validate required fields
      if (typeof weatherData.temperature !== 'number' || typeof weatherData.weathercode !== 'number') {
        throw new Error("Missing required weather fields");
      }
      
      res.json({
        temperature: weatherData.temperature,
        windSpeed: weatherData.windspeed || 0,
        windDirection: weatherData.winddirection || 0,
        weatherCode: weatherData.weathercode,
        time: weatherData.time || new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error fetching Jakarta weather:", error);
      res.status(500).json({ 
        error: "Failed to fetch weather data",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // API endpoint to get historical stats with flexible duration
  app.get("/api/stats-history", async (req, res) => {
    try {
      const duration = req.query.duration as string || '24h';
      
      // Parse duration parameter (1h, 6h, 12h, 24h, 7d, 30d)
      let hours: number;
      if (duration.endsWith('h')) {
        hours = parseInt(duration);
      } else if (duration.endsWith('d')) {
        hours = parseInt(duration) * 24;
      } else {
        hours = 24; // default
      }
      
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

  // Host mapping per program per day (updated from CSV file jadwal_tjradio_1762098305741.csv)
  const HOST_MAPPING: Record<string, Record<string, string>> = {
    "Good Morning Jakarta": {
      monday: "INDY & IRWAN", tuesday: "INDY & IRWAN", wednesday: "INDY & IRWAN",
      thursday: "INDY & IRWAN", friday: "INDY & IRWAN", saturday: "INDY & IRWAN", sunday: "INDY & IRWAN"
    },
    "Good Morning JKT Weekend": {
      monday: "OTESYECH & ODAH", tuesday: "OTESYECH & ODAH", wednesday: "OTESYECH & ODAH",
      thursday: "OTESYECH & ODAH", friday: "OTESYECH & ODAH", saturday: "OTESYECH & ODAH", sunday: "OTESYECH & ODAH"
    },
    "Office Hour": {
      monday: "RIO", tuesday: "ODAH", wednesday: "ODAH",
      thursday: "LUVI", friday: "LUVI", saturday: "RIO", sunday: "RIO"
    },
    "Rute Akhir Pekan": {
      monday: "RIO", tuesday: "RIO", wednesday: "RIO",
      thursday: "RIO", friday: "RIO", saturday: "RIO", sunday: "RIO"
    },
    "Coffee Break": {
      monday: "OTESYECH & RISAN", tuesday: "ABI & HATMA", wednesday: "ABI & HATMA",
      thursday: "ABI & HATMA", friday: "OTESYECH & RISAN", saturday: "OTESYECH & RISAN", sunday: "OTESYECH & RISAN"
    },
    "Song on the Week": {
      monday: "-", tuesday: "-", wednesday: "-",
      thursday: "-", friday: "-", saturday: "-", sunday: "-"
    },
    "Afternoon Show": {
      monday: "PUTRI & HATMA", tuesday: "PUTRI & HATMA", wednesday: "PUTRI & HATMA",
      thursday: "PUTRI & HATMA", friday: "PUTRI & HATMA", saturday: "PUTRI & HATMA", sunday: "PUTRI & ABI"
    },
    "Drive Time": {
      monday: "RENO & DANY", tuesday: "RENO & DANY", wednesday: "RENO & DANY",
      thursday: "RENO & DANY", friday: "RENO & DANY", saturday: "RENO & DANY", sunday: "RENO & DANY"
    },
    "Drive Time Weekend": {
      monday: "RISAN & NAYLA", tuesday: "RISAN & NAYLA", wednesday: "RISAN & NAYLA",
      thursday: "RISAN & NAYLA", friday: "RISAN & NAYLA", saturday: "RISAN & NAYLA", sunday: "RISAN & NAYLA"
    },
    "MALMING (TAPPING)": {
      monday: "-", tuesday: "-", wednesday: "-",
      thursday: "-", friday: "-", saturday: "-", sunday: "-"
    },
    "Weekend Seru": {
      monday: "-", tuesday: "-", wednesday: "-",
      thursday: "-", friday: "-", saturday: "-", sunday: "-"
    },
    "Shift Malam": {
      monday: "DENNY & EKO", tuesday: "MAZDJO & EKO", wednesday: "MOSIDIK & DENNY",
      thursday: "MAZDJO & EKO", friday: "MOSIDIK", saturday: "MAZJO & EKO", sunday: "MAZDJO & EKO"
    },
    "Night Flow": {
      monday: "Denny CH & Eko Kuntadhi", tuesday: "Denny CH & Eko Kuntadhi", wednesday: "Denny CH & Eko Kuntadhi",
      thursday: "Denny CH & Eko Kuntadhi", friday: "Denny CH & Eko Kuntadhi", saturday: "Denny CH & Eko Kuntadhi", sunday: "Denny CH & Eko Kuntadhi"
    },
  };

  function getProgramSchedulesDetailed(): ProgramSchedule[] {
    const dayOfWeek = getDayOfWeekWIB();
    const schedules = getProgramSchedules();
    
    return schedules.map(program => {
      const hosts = HOST_MAPPING[program.name]?.[dayOfWeek] || "-";
      const presenter = hosts === "-" ? "" : `dengan ${hosts}`;
      
      return {
        title: program.name,
        presenter,
        startHour: program.startHour,
        startMinute: program.startMin,
        endHour: program.endHour,
        endMinute: program.endMin,
        description: `${program.name} - Program TJ Radio Jakarta`,
        imageUrl: `https://www.tjradiojakarta.com/shows/${program.name.toLowerCase().replace(/\s/g, '-')}.jpg`
      };
    });
  }

  function getCurrentProgram(): ProgramSchedule {
    // Get current program schedules based on day of week
    const programSchedules = getProgramSchedulesDetailed();
    
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
    // Get current program schedules based on day of week
    const programSchedules = getProgramSchedulesDetailed();
    
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
      
      // Get current day's schedule
      const schedules = getProgramSchedules();
      
      const programsData = await Promise.all(
        schedules.map(async (program) => {
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

      // Get program stats to fetch estimatedUniqueListeners (TOTAL PENDENGAR)
      const wibDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
      const programStats = await storage.getProgramStats(currentProgram.title, wibDate);
      
      const totalListeners = programStats?.estimatedUniqueListeners || 0;

      console.log(`[OnAir] Using schedule: ${currentProgram.title} (${formattedTimeRange}), Total Listeners: ${totalListeners}`);
      
      res.json({
        programTitle: currentProgram.title,
        presenter: currentProgram.presenter,
        timeRange: formattedTimeRange,
        description: currentProgram.description,
        imageUrl: currentProgram.imageUrl,
        status: "LIVE",
        source: "schedule", // Always use schedule (reliable)
        totalListeners, // TOTAL PENDENGAR (estimated unique listeners)
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

  // API endpoint for 6-day statistics
  app.get("/api/three-day-stats", async (req, res) => {
    try {
      // Disable caching to always return fresh data
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      const today = getWIBDate();
      const [year, month, day] = today.split('-').map(Number);
      
      // Helper function to get Indonesian day name
      const getDayName = (dateStr: string): string => {
        const [y, m, d] = dateStr.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        const dayNames = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
        return dayNames[date.getDay()];
      };
      
      // Calculate dates for last 6 days (yesterday, 2 days ago, ..., 6 days ago)
      const dates = [];
      for (let i = 1; i <= 6; i++) {
        // Create date in local timezone to avoid UTC conversion issues
        const date = new Date(year, month - 1, day);
        date.setDate(date.getDate() - i);
        const dateYear = date.getFullYear();
        const dateMonth = String(date.getMonth() + 1).padStart(2, '0');
        const dateDay = String(date.getDate()).padStart(2, '0');
        dates.push(`${dateYear}-${dateMonth}-${dateDay}`);
      }
      
      // Get program stats for the last 6 days
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
            dayName: getDayName(date),
            programs: stats,
          };
        })
      );
      
      // Find program with highest listeners across WEEKLY (7 days) for champion
      // Calculate dates for last 7 days
      const weeklyDates = [];
      for (let i = 1; i <= 7; i++) {
        const date = new Date(year, month - 1, day);
        date.setDate(date.getDate() - i);
        const dateYear = date.getFullYear();
        const dateMonth = String(date.getMonth() + 1).padStart(2, '0');
        const dateDay = String(date.getDate()).padStart(2, '0');
        weeklyDates.push(`${dateYear}-${dateMonth}-${dateDay}`);
      }
      
      // Get all program stats for the last 7 days
      const weeklyStats = await Promise.all(
        weeklyDates.map(async (date) => {
          return await storage.getAllProgramStatsForDate(date);
        })
      );
      
      // Find program with highest listeners across all 7 days
      let recordProgram = {
        name: "",
        listeners: 0,
      };
      
      weeklyStats.forEach((dayStats) => {
        dayStats.forEach((stat) => {
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
        dailyStats: dailyStats.map(({ date, totalListeners, dayName }) => ({
          date,
          totalListeners,
          dayName,
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
      console.error("Error fetching 6-day stats:", error);
      res.status(500).json({ error: "Failed to fetch 6-day statistics" });
    }
  });

  // API endpoint for weekly statistics (7 days for bar chart)
  app.get("/api/weekly-stats", async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      const today = getWIBDate();
      const [year, month, day] = today.split('-').map(Number);
      
      // Helper function to get short day name (3 letters)
      const getShortDayName = (dateStr: string): string => {
        const [y, m, d] = dateStr.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        const dayNames = ['MIN', 'SEN', 'SEL', 'RAB', 'KAM', 'JUM', 'SAB'];
        return dayNames[date.getDay()];
      };
      
      // Helper function to format date as "DD MMM"
      const formatShortDate = (dateStr: string): string => {
        const [y, m, d] = dateStr.split('-').map(Number);
        const months = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES'];
        return `${d} ${months[m - 1]}`;
      };
      
      // Calculate dates for last 7 days (today, yesterday, ..., 6 days ago)
      const dates = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(year, month - 1, day);
        date.setDate(date.getDate() - i);
        const dateYear = date.getFullYear();
        const dateMonth = String(date.getMonth() + 1).padStart(2, '0');
        const dateDay = String(date.getDate()).padStart(2, '0');
        dates.push(`${dateYear}-${dateMonth}-${dateDay}`);
      }
      
      // Reverse to show oldest to newest
      dates.reverse();
      
      // Get program stats for the last 7 days
      const weeklyStats = await Promise.all(
        dates.map(async (date) => {
          const stats = await storage.getAllProgramStatsForDate(date);
          
          // Sum up estimated unique listeners from all programs for this day
          const totalListeners = stats.reduce(
            (sum: number, stat) => sum + (stat.estimatedUniqueListeners || 0),
            0
          );
          
          return {
            date,
            totalListeners,
            dayName: getShortDayName(date),
            formattedDate: formatShortDate(date),
          };
        })
      );
      
      res.json({ weeklyStats });
    } catch (error) {
      console.error("Error fetching weekly stats:", error);
      res.status(500).json({ error: "Failed to fetch weekly statistics" });
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
      
      // Get current program details to extract hosts
      const program = getCurrentProgram();
      const presenterText = program.presenter || "";
      const hosts = presenterText.replace(/^presenters?:\s*/i, '').split(/\s*&\s*/).filter(h => h);
      
      // Format names for display - fallback to "CREW" for staff without photos or Night Flow default
      const formatName = (name: string) => {
        if (name === "unknown" || name === "default" || name === "internship" || name === "ade" || name === "indira") {
          return "CREW";
        }
        return name.toUpperCase();
      };
      
      // Get host photos
      const hostsWithPhotos = hosts.map((hostName) => ({
        name: hostName.trim().toUpperCase(),
        photoUrl: getHostPhotoPath(hostName.trim()),
      }));
      
      res.json({
        operator: {
          name: formatName(operatorName),
          photoUrl: operatorPhoto,
        },
        producer: {
          name: formatName(producerName),
          photoUrl: producerPhoto,
        },
        hosts: hostsWithPhotos,
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

  // API endpoint to recalculate program stats for a specific date
  app.post("/api/recalculate-date", async (req, res) => {
    try {
      const { date } = req.body;
      
      if (!date) {
        return res.status(400).json({ error: "Date is required (format: YYYY-MM-DD)" });
      }
      
      console.log(`[Recalculate] Starting recalculation for date: ${date}`);
      
      // Get all snapshots for this date
      const snapshots = await storage.getSnapshotsForDate(date);
      
      if (snapshots.length === 0) {
        return res.status(404).json({ error: `No snapshots found for date: ${date}` });
      }
      
      console.log(`[Recalculate] Found ${snapshots.length} snapshots for ${date}`);
      
      // Group snapshots by program based on timestamp
      const programSnapshots: Map<string, Array<{ timestamp: Date, listenersRaw: number }>> = new Map();
      
      for (const snapshot of snapshots) {
        const snapshotTime = new Date(snapshot.timestamp);
        const hour = snapshotTime.getUTCHours() + 7; // Convert to WIB
        const minute = snapshotTime.getUTCMinutes();
        const minutesSinceMidnight = (hour % 24) * 60 + minute;
        
        // Find which program this snapshot belongs to
        let programName: string | null = null;
        for (const program of PROGRAM_SCHEDULES) {
          const programStartMinutes = program.startHour * 60 + program.startMin;
          const programEndMinutes = program.endHour * 60 + program.endMin;
          
          if (programEndMinutes === 0 || programEndMinutes === 1440) {
            // Special case for midnight crossing (Shift Malam ends at 00:00)
            if (minutesSinceMidnight >= programStartMinutes || minutesSinceMidnight < 60) {
              programName = program.name;
              break;
            }
          } else if (minutesSinceMidnight >= programStartMinutes && minutesSinceMidnight < programEndMinutes) {
            programName = program.name;
            break;
          }
        }
        
        if (programName) {
          if (!programSnapshots.has(programName)) {
            programSnapshots.set(programName, []);
          }
          programSnapshots.get(programName)!.push({
            timestamp: snapshotTime,
            listenersRaw: snapshot.listenersRaw,
          });
        }
      }
      
      console.log(`[Recalculate] Grouped into ${programSnapshots.size} programs`);
      
      // Calculate stats for each program
      const results = [];
      for (const [programName, programData] of Array.from(programSnapshots)) {
        if (programData.length === 0) continue;
        
        // Calculate average raw listeners (N) for this program
        const totalRaw = programData.reduce((sum: number, s: { timestamp: Date; listenersRaw: number }) => sum + s.listenersRaw, 0);
        const avgN = Math.round(totalRaw / programData.length);
        
        // Get program schedule
        const programSchedule = PROGRAM_SCHEDULES.find(p => p.name === programName);
        if (!programSchedule) continue;
        
        // For historical data recalculation, assume program completed (100% progress)
        const progress = 100;
        
        // Calculate using NEW formula (Oct 17, 2025):
        // PENDENGAR SAAT INI = N × 11
        const avgConcurrentListeners = avgN * DEVICE_TO_LISTENER_MULTIPLIER;
        
        // TOTAL PENDENGAR = PENDENGAR SAAT INI × 6 × progress%
        const estimatedUniqueListeners = Math.round(avgConcurrentListeners * 6 * (progress / 100));
        
        // Save to database
        await storage.updateProgramStats(programName, date, {
          LM: 0, // Not calculated for historical recalculation
          LMhat: 0, // Not calculated for historical recalculation
          Nhat: avgN, // Use average raw listeners as Nhat
          baseline: avgN,
          avgConcurrentListeners,
          estimatedUniqueListeners,
          progress,
          elapsedMinutes: programSchedule.durationMinutes,
          startTime: `${String(programSchedule.startHour).padStart(2, '0')}:${String(programSchedule.startMin).padStart(2, '0')}`,
          endTime: `${String(programSchedule.endHour).padStart(2, '0')}:${String(programSchedule.endMin).padStart(2, '0')}`,
        });
        
        results.push({
          program: programName,
          snapshots: programData.length,
          avgRawListeners: avgN,
          displayListeners: avgConcurrentListeners,
          estimatedUnique: estimatedUniqueListeners,
        });
        
        console.log(`[Recalculate] ${programName}: N=${avgN}, Display=${avgConcurrentListeners}, Unique=${estimatedUniqueListeners}`);
      }
      
      res.json({
        success: true,
        date,
        programsProcessed: results.length,
        results,
      });
      
    } catch (error) {
      console.error("[Recalculate] Error:", error);
      res.status(500).json({ error: "Failed to recalculate date statistics" });
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

  // Start background job for stream health monitoring (every 30 seconds)
  if (streamHealthInterval) {
    clearInterval(streamHealthInterval);
  }
  
  // Perform initial health check immediately
  checkStreamHealthIndependently();
  
  // Schedule periodic health checks every 30 seconds
  streamHealthInterval = setInterval(checkStreamHealthIndependently, STREAM_HEALTH_INTERVAL);
  console.log(`[StreamHealth] Background job started - checking every ${STREAM_HEALTH_INTERVAL / 1000} second(s)`);

  return httpServer;
}
