# TJ Radio Jakarta - Dashboard Statistik Real-Time

## Overview
This project is a real-time dashboard for TJ Radio Jakarta, displaying live streaming statistics from an Icecast server. Its primary purpose is to provide an internal, professional, and easily readable visualization of listener data. Key capabilities include displaying current listeners with a special 4x multiplier, station information, historical data visualization, and a comprehensive configuration management system. The dashboard also features an alert system for threshold notifications and supports both dark/light modes and responsive design. The overarching business vision is to provide TJ Radio Jakarta with robust tools for monitoring listenership, understanding trends, and managing broadcast configurations effectively.

## User Preferences
I prefer clear, concise explanations and a professional tone. For development, I favor an iterative approach, with a focus on maintainability and scalable solutions. Please ensure that all new features are thoroughly tested and documented. I expect the agent to ask for confirmation before making significant architectural changes or adding new external dependencies.

## System Architecture

### UI/UX Decisions
The dashboard's design is inspired by Spotify Analytics and SoundCloud Stats, featuring a dark mode default.
- **Color Scheme**: Primary "Radio red" (350 85% 55%), accent Teal (187 85% 45%) for data highlights, and Green (142 76% 45%) for success indicators.
- **Typography**: Inter for UI elements, and JetBrains Mono for numeric data.
- **Animations**: Minimal and purposeful, including counter animations, pulse indicators, and animated "LIVE" badges.
- **Branding**: Official TJ Radio logo, modern neon "ON AIR" graphic, and program-specific presenter photos.
- **Layout**: Responsive design for both desktop and mobile.
- **Information Display**: Real-time WIB clock and Indonesian date display. Program statistics include "Pendengar Saat Ini" (raw listeners × 11) and "TOTAL PENDENGAR" (estimated unique listeners based on program progress), with EMA smoothing for spike detection.
- **Program Images**: Large aspect-video presenter photos for "Program Sedang On Air" and "Coming Up Next". Small 80×80px colorful rounded icons for all 6 programs in statistics lists.
- **Badge Styling**: "LIVE Badge" for on-air programs (red background, dual animation) and "UPCOMING Badge" for next programs (teal background, static).

### Technical Implementations
- **Frontend**: React with TypeScript, Wouter for routing, TanStack Query for state management, Tailwind CSS and Shadcn/ui for styling, Recharts for historical data visualization.
- **Backend**: Express.js, PostgreSQL (Neon) with Drizzle ORM, Cheerio for HTML parsing (Icecast stats + tjradiojakarta.com/live program info), Axios for HTTP requests, Zod for schema validation.
- **Data Sources**: Icecast server (listener statistics) and tjradiojakarta.com/live (current program information via web scraping).
- **Background Jobs**: Interval-based snapshots (every 5 minutes) for historical data and alert threshold checks.
- **Metrics Calculation**:
    - **"PENDENGAR SAAT INI"** (display) = Raw listeners (N) × **11**.
    - **"TOTAL PENDENGAR"** (estimated unique) = **PENDENGAR SAAT INI × 6 × percentage progress**.
    - Formula expanded: TOTAL PENDENGAR = (N × 11) × 6 × progress% = N × 66 × progress%.
    - Progress calculated in real-time based on current WIB time vs program schedule, handling midnight crossings.
    - EMA smoothing (α=0.25) for spike detection, resetting at midnight or program change. Calculation interval: 30 seconds.

### Feature Specifications
- **Real-time Statistics**: Current listeners, peak listeners, and currently playing song with auto-refresh every 30 seconds.
- **Speedometer Gauge**: Uses background image template (SPEEDOBACK_1762085711848.png) with pre-rendered yellow-to-red gradient arc and scale marks (1.000-10K). Overlays include: animated purple/magenta gradient needle with glow effect positioned based on current listener count, and center statistics showing "OVER" label, main number in bright yellow (#FFD700), subtitle "PEOPLE ARE LISTENING TO US RIGHT NOW", orange trend indicator (#FFA500) with +/− signs, cyan peak value (#00FFFF), and orange-red percentage from peak (#FF6347). Needle calculation: angle = -180° + ((listeners - 1000) / 9000) × 200°.
- **Historical Data**: PostgreSQL database for snapshots, with time-series charts (24h, 7d, 30d views) and CSV export.
- **3-Day Statistics Widget**: Aggregated listener totals for the last 3 days, with Indonesian date labels, formatted counts, and **weekly champion icon** (searches 7 days for highest program). Champion displays gold trophy icon with glow effect and pulse animation. Auto-refreshes every 30 seconds.
- **Crew On Duty Widget**: Displays current on-duty staff (Operator and Producer) based on real-time shift and program schedules. Includes staff photos (military uniform theme) and fallbacks for staff without photos. Auto-refreshes every 30 seconds.
- **Admin Dashboard**: Configures listener multiplier, stream URL, and alert thresholds.
- **Alert System**: Configurable alert thresholds with real-time monitoring and history logging.
- **Program On Air Integration**: Displays current program details (photo, name, presenters, air time, description) from a hardcoded schedule (web scraping fallback).
- **Coming Up Next**: Shows the next scheduled program's details.
- **Footer**: Internal use disclaimer and copyright.

### System Design Choices
- **Database Schema**: `stats_history`, `configuration`, `alert_thresholds`, and `alert_history`.
- **Data Flow**: Frontend requests `/api/radio-stats` (backend fetches from Icecast, applies multiplier), and `/api/on-air-program` (backend scrapes website or uses schedule).
- **Error Handling**: Comprehensive error handling and loading states.

## External Dependencies
- **Database**: PostgreSQL (Neon).
- **ORM**: Drizzle ORM.
- **Streaming Server**: Icecast (`https://stream-eu-nc.arenastreaming.com:5450/`).
- **HTTP Client**: Axios.
- **Charting Library**: Recharts.
- **UI Component Library**: Shadcn/ui.
- **Styling Framework**: Tailwind CSS.
- **Parsing Library**: Cheerio.