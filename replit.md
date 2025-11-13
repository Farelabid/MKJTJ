# TJ Radio Jakarta - Dashboard Statistik Real-Time

## Overview
This project is a real-time dashboard for TJ Radio Jakarta, providing internal, professional, and easily readable visualization of live streaming statistics from an Icecast server. Its main purpose is to monitor listener data, including current listeners with a special multiplier, station information, and historical trends. The dashboard features an alert system for threshold notifications, comprehensive configuration management, and supports both dark/light modes and responsive design. The business vision is to empower TJ Radio Jakarta with robust tools for effective listenership monitoring, trend analysis, and broadcast configuration management.

## User Preferences
I prefer clear, concise explanations and a professional tone. For development, I favor an iterative approach, with a focus on maintainability and scalable solutions. Please ensure that all new features are thoroughly tested and documented. I expect the agent to ask for confirmation before making significant architectural changes or adding new external dependencies.

## System Architecture

### UI/UX Decisions
The dashboard's design is inspired by Spotify Analytics and SoundCloud Stats, with a default dark mode.
- **Color Scheme**: Primary "Radio red" (350 85% 55%), accent Teal (187 85% 45%), and Green (142 76% 45%).
- **Typography**: Inter for UI, JetBrains Mono for numeric data.
- **Animations**: Minimal, including counter animations, pulse indicators, and animated "LIVE" badges.
- **Branding**: Official TJ Radio logo, modern neon "ON AIR" graphic, and program-specific presenter photos.
- **Layout**: Desktop 3-column grid (Speedometer | Team Work | Weekly Statistics), responsive for mobile.
- **Header Widgets**:
    - **Stream Status**: Color-coded health indicator (green, blue, yellow, red) based on response time from Icecast, with animated signal icon and dynamic backgrounds. Displays status in Indonesian.
    - **Cuaca Jakarta**: Sky blue gradient widget showing real-time Jakarta weather with animated icon, temperature (°C), and Indonesian description from Open-Meteo API.
- **Information Display**: Real-time WIB clock and Indonesian date. Program statistics include "Pendengar Saat Ini" (raw listeners × 11) and "TOTAL PENDENGAR" (estimated unique listeners via EMA smoothing and program progress).
- **Program Images & Videos**: Large presenter photos/videos for "Program Sedang On Air" and "Coming Up Next"; small, colorful rounded icons for programs in statistics lists.
  - **Video Backgrounds (Nov 8, 2025)**: Specific programs use looping video backgrounds instead of static images:
    - **Coming Up Next** section: `looplogo_1762589395286.mp4` (24MB loop video) - Always displays for next program
    - **Program Sedang On Air - Afternoon Show**: `afternoonShow_1762590789847.mp4` (17MB loop video) - Shows during Afternoon Show (13:00-16:00 WIB)
    - **Program Sedang On Air - Good Morning Jakarta**: `gmjindyirwan_1763001208942.mp4` (loop video) - Shows during Good Morning Jakarta (06:00-10:00 WIB with INDY & IRWAN)
    - **Program Sedang On Air - Office Hour**: `oFFICE_HOUR_1763001501486.mp4` (loop video) - Shows during Office Hour (10:00-13:00 WIB)
    - Video settings: autoPlay, loop, muted, playsInline with dark gradient overlay
  - **AI-Generated Images with Host Photo Overlay (Nov 8, 2025)**: Programs without official presenter photos use contextual AI-generated stock images with dark gradient overlay, circular host photos, and program information:
    - **Drive Time Weekend**: Radio broadcasting studio at sunset with circular photos of RISAN & NAYLA + text overlay
    - **MALMING (TAPPING)**: Nightclub party lights with host photos + text overlay
    - **Weekend Seru**: Weekend celebration atmosphere with host photos + text overlay
    - **Yesterday Hit**: Generic radio DJ image with host photos + text overlay
  - Host photo overlay format (applies to both video and AI-generated backgrounds): 
    - Circular host photos (112x112px) with 3px white/90 border and shadow-2xl effect
    - Positioned at bottom-left of background media
    - Program name (bold, 2xl) + presenter text (white/90 opacity)
    - Dark gradient overlay (black/90 via black/50 to black/30) for text readability
    - Object-position: 50% 25% for proper host photo cropping
- **Badge Styling**: "LIVE Badge" (red, dual animation) and "UPCOMING Badge" (teal, static).
- **Host Photos**: 22 unique host photos (112x112px circular avatars) dynamically displayed in the Team Work section based on schedule and overlaid on video/AI-generated backgrounds.

### Technical Implementations
- **Frontend**: React with TypeScript, Wouter for routing, TanStack Query for state management, Tailwind CSS and Shadcn/ui for styling, Recharts for data visualization.
- **Backend**: Express.js, PostgreSQL (Neon) with Drizzle ORM, Cheerio for HTML parsing (Icecast stats + tjradiojakarta.com/live program info), Axios for HTTP requests, Zod for schema validation.
- **Data Sources**: 
    - **Primary Streaming Server**: Icecast (`https://stream-eu-nc.arenastreaming.com:5450/`) - Main listener statistics via HTML parsing
    - **Backup Streaming Server**: IndoStreamServer (`https://live1.indostreamserver.com:8012/`) - Backup listener statistics via Shoutcast format (port 8012, endpoint `/7.html`)
    - **Program Information**: tjradiojakarta.com/live (current program information via web scraping)
    - **Dual-Server Integration (Nov 11, 2025)**: Listener counts are automatically combined from both Icecast and IndoStreamServer in parallel for redundancy and accuracy. Credentials stored securely in environment variables (INDOSTREAM_USERNAME, INDOSTREAM_PASSWORD).
- **Background Jobs**: Interval-based snapshots for historical data and alert threshold checks.
- **Metrics Calculation** (Updated Nov 13, 2025):
    - **Listener Multiplier**: Configurable via admin dashboard, stored in database configuration table (default: 11, production: 319)
    - "PENDENGAR SAAT INI" = (Icecast listeners + IndoStream listeners) × listener_multiplier (from config)
    - "TOTAL PENDENGAR" = (PENDENGAR SAAT INI) × 12 × program progress percentage
    - EMA smoothing (α=0.25) applied for spike detection, resetting at midnight or program change

### Feature Specifications
- **Real-time Statistics**: Current listeners, peak listeners, and currently playing song. **Auto-refresh interval: 20 seconds** for real-time listener data (radio-stats and stream-health), providing more frequent updates for live monitoring.
- **Speedometer Gauge**: Custom gauge with pre-rendered background and triple-layer needle design for maximum visibility:
    - **Needle Design**: Triple-layer structure (red outline 10px + black middle 7px + white core 4px with glow) for high contrast against yellow-to-red gauge background
    - **Needle Components**: Large red triangle tip with white stroke, red center dot (8px radius) with white border as rotation anchor
    - **Rotation**: SVG transform attribute with smooth 0.8s cubic-bezier animation, angle calculated based on listener count (-130° to +50° range)
    - **Text Overlay**: Neon-glow numerical display with pointer-events passthrough for proper layering
    - **No Center Obstruction**: Removed center circle to ensure full text readability
- **Historical Data & Trend Analysis**: PostgreSQL-backed time-series line charts for "Pendengar Saat Ini" and "Peak" trends, with 6 duration options (1h to 30d). Includes average, maximum, and minimum statistics.
- **3-Day Statistics Widget**: Aggregated listener totals for the last 3 days, with a weekly champion program icon.
- **Team Work Section**: Displays current team (Operator, Producer, Hosts) with photos and roles, derived directly from the program schedule. Includes "ONAIR NOW" and "Coming Up Next" program details. Features professional producer photos and 3D tilt effect on the producer photo.
- **Weekly Statistics Widget**: 7-day bar chart of listener statistics with a "Program Favorite" section.
- **Admin Dashboard**: For configuring listener multiplier, stream URL, and alert thresholds.
- **Alert System**: Configurable thresholds with real-time monitoring and history.
- **Program On Air Integration**: Displays current program details (photo, name, presenters, air time, description) from a hardcoded schedule with web scraping fallback.
- **Coming Up Next**: Shows details of the next scheduled program.
- **Footer**: Internal use disclaimer and copyright, with an auto-playing TJ Radio Jakarta streaming player.

### System Design Choices
- **Database Schema**: `stats_history`, `configuration`, `alert_thresholds`, `alert_history`, `program_stats`, and `minute_snapshots`.
- **Timezone Handling (Critical Fix Nov 8, 2025)**: All timestamps in `minute_snapshots` table are stored in WIB timezone (UTC+7) to match the `date` field. This ensures proper data retrieval for EMA calculations. Both `saveMinuteSnapshot` and `getRecentSnapshots` use WIB timezone calculations.
- **Data Flow**: Frontend requests `/api/radio-stats` and `/api/on-air-program`; backend fetches from Icecast and scrapes the website.
- **Error Handling**: Comprehensive error handling and loading states.

## External Dependencies
- **Database**: PostgreSQL (Neon).
- **ORM**: Drizzle ORM.
- **Primary Streaming Server**: Icecast (`https://stream-eu-nc.arenastreaming.com:5450/`).
- **Backup Streaming Server**: IndoStreamServer (`https://live1.indostreamserver.com:8012/` - Shoutcast format).
- **HTTP Client**: Axios.
- **Charting Library**: Recharts.
- **UI Component Library**: Shadcn/ui.
- **Styling Framework**: Tailwind CSS.
- **Parsing Library**: Cheerio.
- **Weather API**: Open-Meteo API.