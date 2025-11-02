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
- **Layout**: Desktop 3-column grid (Speedometer | Team Work | Weekly Statistics), responsive design for mobile.
- **Header Widgets**: Two compact widgets positioned side-by-side in the header:
  - **Stream Status**: Color-coded health indicator widget displaying streaming connection quality based on real-time metrics from Icecast server. Features animated Signal icon with dynamic gradient backgrounds (green=excellent <300ms, blue=good <1000ms, yellow=degraded <3000ms, red=offline). Shows response time and status in Indonesian ("Sempurna", "Baik", "Lambat", "Offline"). Auto-refresh every 30 seconds (synced with stats).
  - **Cuaca Jakarta**: Sky blue gradient widget displaying real-time Jakarta weather with animated weather icon (sun, cloud, rain, etc.), temperature in Celsius, and Indonesian description. Data from Open-Meteo API (free, no key required), 5-minute auto-refresh with error fallback "Data tidak tersedia".
- **Information Display**: Real-time WIB clock and Indonesian date display. Program statistics include "Pendengar Saat Ini" (raw listeners × 11) and "TOTAL PENDENGAR" (estimated unique listeners based on program progress), with EMA smoothing for spike detection.
- **Program Images**: Large aspect-video presenter photos for "Program Sedang On Air" and "Coming Up Next". Small 80×80px colorful rounded icons for all 6 programs in statistics lists.
- **Badge Styling**: "LIVE Badge" for on-air programs (red background, dual animation) and "UPCOMING Badge" for next programs (teal background, static).
- **Host Photos**: 22 unique host photos dynamically displayed in Team Work section based on current program schedule. Mapped hosts include: ABI, AKBAR, CAK LONTONG, DENNY/DENNY CH, DANY, EKO/EKO KUNTADHI, HATMA, INDY, IRWAN, LUVI, MAZDJO/MAZJO, MO/MOSIDIK, NAYLA, ODAH, OT, PUTRI, RENO, RIO, RISAN, SAKINAH, SALSA/SALSABILLA, YASSER. All hosts now have photos (100% coverage).

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
- **Speedometer Gauge**: Uses background image template (SPEEDOBACK_1762085711848.png) with pre-rendered yellow-to-red gradient arc and scale marks (1.000-10K). Overlays include: animated purple/magenta gradient needle with glow effect positioned based on current listener count, and center statistics showing "OVER" label, main number in bright yellow (#FFD700) with multi-layer neon glow effect, subtitle "PEOPLE ARE LISTENING TO US RIGHT NOW", orange trend indicator (#FFA500) with +/− signs, cyan peak value (#00FFFF), and orange-red percentage from peak (#FF6347). Needle calculation: angle = -180° + ((listeners - 1000) / 9000) × 200°.
- **Historical Data**: PostgreSQL database for snapshots, with time-series charts (24h, 7d, 30d views) and CSV export.
- **3-Day Statistics Widget**: Aggregated listener totals for the last 3 days, with Indonesian date labels, formatted counts, and **weekly champion icon** (searches 7 days for highest program). Champion displays gold trophy icon with glow effect and pulse animation. Auto-refreshes every 30 seconds.
- **Team Work Section**: Displays current team on duty with orange header showing "TJRADIO TODAY TEAM" and date with day name (e.g., "MINGGU 02 NOVEMBER 2025"), 4 crew photos in a row (Operator with cyan/light blue border, Producer with orange border, Host 1 and Host 2 with bright green neon glow borders), red "ONAIR NOW" banner showing current program info (name, time, stats), and "Coming Up Next" program preview. **Photos retrieved directly from program schedule** (no longer using /api/crew-on-duty endpoint). Operator determined by shift schedule (05:00-12:00, 12:00-19:00, 19:00-24:00). Uses NEW professional producer photos uploaded Nov 2, 2025. Auto-refreshes every 30 seconds.
- **Weekly Statistics Widget**: Displays 7-day bar chart of listener statistics with Indonesian date labels, formatted listener counts, and **Program Favorite** section featuring the program with highest listeners in the past 7 days (gold trophy icon with glow and pulse animation). Retrieved via /api/weekly-stats endpoint. Auto-refreshes every 30 seconds.
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

## Recent Changes (November 2, 2025)
### Major Schedule Update from CSV File
- **Source**: Official schedule file `jadwal_tjradio_1762098305741.csv`
- **New Weekend Programs**:
  - "Afternoon Show" (Sabtu-Minggu 13:00-16:00): Putri & Hatma (Sabtu), Putri & Abi (Minggu)
  - "Drive Time Weekend" (Sabtu-Minggu 16:00-20:00): Risan & Nayla
  - "Song on the Week" reduced to 12:00-13:00 (music segment only, no presenters)
- **Host Schedule Updates**:
  - Office Hour: Rio (Sen), Odah (Sel-Rab), Luvi (Kam-Jum)
  - Coffee Break: Otesyech & Risan (Sen, Jum), Abi & Hatma (Sel-Kam)
  - Shift Malam: Updated per day (Denny & Eko, Mazdjo & Eko, Mosidik & Denny, Mosidik solo)
- **Producer Schedule Updates**:
  - Good Morning Jakarta: Audrey (Sen, Kam), Zakiya (Sel, Rab, Jum)
  - Coffee Break: Nayla (Sen, Rab), Patricia (Sel, Kam, Jum)
  - Afternoon Show: Patricia (Sabtu), Nayla (Minggu)
  - Drive Time Weekend: Sakinah
- **New Producer Photos**: Uploaded 5 professional photos (jhosua, luvi, nayla, patricia, risan) at 1762098258506-507
- **New Operator Photo**: Replaced ADE operator photo with new professional version (opr_ade_1762099159402.png)
- **Team Work Widget Update**: 
  - Removed dependency on /api/crew-on-duty endpoint
  - Photos now retrieved directly from shift/program schedule mapping
  - Operator determined by 3 shifts: Shift 1 (05:00-12:00), Shift 2 (12:00-19:00), Shift 3 (19:00-24:00)
  - Operator names displayed with actual person names (e.g., "FARHAN" for internship, not just "INTERNSHIP" label)
  - Producer photos use NEW professional uploads (not crew uniforms)
  - All data calculated client-side based on current WIB time, shift, program, and day
  - Layout: 4 photos (Operator-cyan/light blue + Producer-orange + 2 Hosts-bright green with neon glow)
  - Photo frame colors: Operator (cyan-400), Producer (orange-500), Host (lime-400 with shadow glow and pulse animation)
  - Header updated: Orange gradient banner with "TJRADIO TODAY TEAM" (left, dark blue text) and 2-line date on right (day name on top, full date below, both in yellow)
  - Banner text updated: "ONAIR NOW" (white + yellow) replacing "LIVE NOW"
- **3D Tilt Effect**: Producer photo now has exclusive 3D perspective animation (6s loop, rotateX/rotateY transforms) for visual spotlight
- **Virtual Crew Shift (00:01-05:59 WIB)**: Special Night Flow crew photos automatically displayed during late-night hours:
  - Operator: virtual_operator_1762106064761.png
  - Producer: virtual_produser_1762106064761.png
  - Host 1: virtual_host1_1762106064760.png
  - Host 2: virtual_host2_1762106064761.png
- **Updated Operator Photo**: Aryo operator photo updated to professional version (opr_aryo_1762105125710.png)
- **Coverage Status**: Maintained 100% photo coverage for all 22 hosts, 9 producers, 6 operators, and 4 virtual crew members
- **Jakarta Weather Widget** (Latest Update):
  - Replaced "Now Playing" widget with real-time Jakarta weather display in dashboard header
  - Backend endpoint: `/api/jakarta-weather` fetches data from Open-Meteo API (free, no API key)
  - Weather utility: `client/src/lib/weatherUtils.ts` maps weather codes to Indonesian descriptions and Lucide icons
  - Widget features: Sky blue gradient background, animated weather icon with pulse effect, temperature in °C, Indonesian weather condition
  - Error handling: Validates API responses, displays "Data tidak tersedia" fallback on errors, retry logic (2 attempts)
  - Auto-refresh: Every 5 minutes (stale time: 4 minutes)
  - Supported conditions: Cerah, Cerah Berawan, Berawan, Berkabut, Gerimis, Hujan, Salju, Hujan Lebat, Petir, and more