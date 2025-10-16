# TJ Radio Jakarta - Dashboard Statistik Real-Time

## Overview
This project is a real-time dashboard for TJ Radio Jakarta, designed to display live streaming statistics from an Icecast server. Its primary purpose is to provide an internal, professional, and easily readable visualization of listener data. Key capabilities include displaying current listeners with a special 4x multiplier, station information, historical data visualization, and a comprehensive configuration management system. The dashboard also features an alert system for threshold notifications and supports both dark/light modes and responsive design. The overarching business vision is to provide TJ Radio Jakarta with robust tools for monitoring listenership, understanding trends, and managing broadcast configurations effectively.

## Recent Changes (October 16, 2025)
- **Crew On Duty Feature**: Replaced center cassette animation with dynamic staff photos showing current Operator and Producer
  - Displays photos based on shift schedule (Operators: 3 shifts) and program schedule (Producers: 6 programs)
  - Operator shifts: Shift 1 (05:00-12:00), Shift 2 (12:00-19:00), Shift 3 (19:00-24:00)
  - Producer schedule varies by program and weekday (Audrey, Risan/Raisan, Indira, Nayla, Patricia, Luvi, Jhosua/Joshua)
  - Fallback to "CREW" label and default image for staff without photos (Ade, Internship)
  - Auto-refresh every 30 seconds, endpoint: `/api/crew-on-duty`
- **Hero Section Redesign**: Complete redesign of top section with 3-column layout matching new UI mockup
  - Left: Current listeners (pink #FF69B4) & peak stats with yellow (#C4F542) highlights
  - Center: Crew On Duty - Operator and Producer photos with "crewOnDuty" logo header
  - Right: 3-day statistics with horizontal progress bars
- **Manual Historical Data**: Added data for 13 Oct (187K) and 15 Oct (193K) to complete 3-day statistics display
- **3-Day Statistics Update**: Redesigned with horizontal bar charts showing daily listener totals for 3 days BEFORE current day (e.g., if today is Oct 16, shows Oct 13-15), yellow (#C4F542) bars, and "PROGRAM FAVORITE MINGGU INI" label
- **3-Day Date Calculation Fix**: Corrected timezone handling to properly calculate dates using local timezone instead of UTC conversion, preventing off-by-one date errors
- **Sponsor Image Enlargement**: Header sponsor image (TransJakarta, JXB logos) enlarged to 82px height (130% then 120% progressive scaling) for better visibility
- **"PENDENGAR SAAT INI" Visual Enhancements**: Implemented 6 visual improvements for better aesthetics and user engagement:
  1. Card container with animated gradient border (pink-to-yellow) and glow shadow effects
  2. Animated radio wave/signal icons with pulse and ping effects as visual indicators
  3. Neon glow effect on large listener numbers using multi-layer text-shadow
  4. Visual progress bar with gradient for "% DARI PEAK" (replaces plain text)
  5. Trending indicator with arrow icons (up/down/stable) showing percentage change vs previous update (5% threshold)
  6. Subtle geometric background pattern (diagonal lines) for visual depth
- **"JUMLAH LISTENERS SEBELUMNYA" Visual Enhancements**: Applied consistent visual improvements to 3-day statistics section:
  1. Card container with animated gradient border (yellow-to-pink) and glow shadow effects
  2. Animated Calendar and Trophy icons with pulse and ping effects
  3. Highlighted highest listener number with yellow (#C4F542) color and neon glow effect
  4. Enhanced horizontal progress bars with gradient fills and glow effects (extra bright for highest value)
  5. Pink (#FF69B4) glow on program favorite name
  6. Subtle diagonal line background pattern matching PENDENGAR SAAT INI section
- **Hero Section Layout Balance**: Updated grid layout to use `items-stretch` and added `h-full` to both "PENDENGAR SAAT INI" and "JUMLAH LISTENERS SEBELUMNYA" cards for equal height and balanced appearance

## Previous Changes (October 14, 2025)
- **Program Schedule Update**: Reduced from 7 to 6 programs by removing "Yesterday Hit" (23:00-24:00)
- **Shift Malam Extended**: Duration increased from 3 hours (20:00-23:00) to 4 hours (20:00-24:00), now covers evening to midnight
- **Icon Replacement**: Program statistics icons updated to colorful rounded designs (80×80px) from attached_assets (icon_nightflow, icon_goodmorningjakarta, icon_odahote, icon_officehour, icon_coffeebrak, icon_drivetime, icon_shiftmalam)
- **Program Count**: Now displays 6 programs across 24-hour schedule with no gaps

## User Preferences
I prefer clear, concise explanations and a professional tone. For development, I favor an iterative approach, with a focus on maintainability and scalable solutions. Please ensure that all new features are thoroughly tested and documented. I expect the agent to ask for confirmation before making significant architectural changes or adding new external dependencies.

## System Architecture

### UI/UX Decisions
The dashboard's design is inspired by Spotify Analytics and SoundCloud Stats, featuring a dark mode default with deep charcoal backgrounds.
- **Color Scheme**: Primary "Radio red" (350 85% 55%), accent Teal (187 85% 45%) for data highlights, and Green (142 76% 45%) for success indicators.
- **Typography**: Inter for UI elements, and JetBrains Mono for numeric data.
- **Animations**: Minimal and purposeful, such as counter animations, pulse indicators, and animated "LIVE" badge with dual animation (pulse + ping effects) for active programs.
- **Branding**: Official TJ Radio logo in the header, modern neon "ON AIR" graphic, and program-specific presenter photos.
- **Layout**: Responsive design for both desktop and mobile, with key metrics prominently displayed.
- **Information Display**: Real-time WIB clock and Indonesian date display in the header. Program statistics include "Pendengar Saat Ini" = raw listeners × 11 and "TOTAL PENDENGAR" = (Pendengar Saat Ini × 8) × percentage progress, with EMA smoothing for spike detection.
- **Program Images**: 
  - **Hero Card** ("Program Sedang On Air"): Large aspect-video (16:9) presenter photo for currently active program. Frontend mapping with WIB day detection.
  - **Coming Up Next**: Large aspect-video (16:9) presenter photo for next scheduled program. Same image mapping logic as hero card.
  - **Statistics List**: Small 80×80px colorful rounded icons for all 6 programs (icon_[program]_*.png).
  - **Special Logic**: "Good Morning Jakarta" shows icon_odahote on Sat/Sun, icon_goodmorningjakarta on Mon-Fri.
  - **Fallback**: Programs without uploaded images show Radio icon (statistics list) or stock image (hero card).
- **Badge Styling**: 
  - **LIVE Badge** (On Air Program): Red background (bg-red-600) with dual animation (pulse + ping effects), displays pulsing dot icon for active programs.
  - **UPCOMING Badge** (Coming Up Next): Teal background (bg-teal-600) with Clock icon, no animation, indicates next scheduled program.

### Technical Implementations
- **Frontend**: React with TypeScript, Wouter for routing, TanStack Query for state management, Tailwind CSS and Shadcn/ui for styling, Recharts for historical data visualization.
- **Backend**: Express.js, PostgreSQL (Neon) with Drizzle ORM, Cheerio for HTML parsing (Icecast stats + tjradiojakarta.com/live program info), Axios for HTTP requests, Zod for schema validation.
- **Data Sources**: 
  - Icecast server (listener statistics)
  - tjradiojakarta.com/live (current program information via web scraping)
- **Background Jobs**: Interval-based snapshots (every 5 minutes) to store historical data and check alert thresholds.
- **Metrics Calculation**:
    - **Radio Stats**: Listeners (current/peak) = Raw Icecast data × Configurable Multiplier (default 11).
    - **Program Analytics (Updated Oct 2025)**: 
      * "Total Pendengar Saat ini" = Raw listeners (N) × **11** (direct real-time calculation)
      * "TOTAL PENDENGAR" = (Total Pendengar Saat ini × 8) × percentage progress
      * Formula: estimatedUniqueListeners = avgConcurrentListeners × 8 × (progress / 100)
      * **Progress Calculation (Real-Time)**: Based on current WIB time vs program schedule
        - Calculated on every API request (not from database snapshots)
        - Formula: progress = (elapsedMinutes / programDuration) × 100
        - Returns 0% for programs not started, 100% for programs finished
        - Handles midnight crossing (Night Flow 00:00-06:00)
        - Display format: 2 decimal places (e.g., "47.92%")
        - Frontend shows progress for ALL programs (active/inactive)
      * EMA smoothing (α=0.25) used for spike detection (>50% threshold, 5-min capping at ±25%)
      * State resets automatically at midnight or program change to prevent spurious spikes
      * Calculation interval: **30 seconds** (previously 1 minute)

### Feature Specifications
- **Real-time Statistics**: Display of current listeners, peak listeners, and currently playing song with auto-refresh every 30 seconds.
- **Historical Data**: PostgreSQL database for storing listener statistics snapshots, with time-series charts (24h, 7d, 30d views) and CSV export functionality.
- **3-Day Statistics Widget**: Top-right dashboard component showing aggregated listener totals from all 6 programs for last 3 days (yesterday, 2 days ago, 3 days ago), with Indonesian date labels (yellow/lime background), formatted listener counts (K/M suffix), and record program display showing which program had highest listeners in the period. Responsive layout (desktop: absolute top-right, mobile: stacked below hero). Auto-refreshes every 30 seconds. Endpoint: `/api/three-day-stats`.
- **Crew On Duty Widget**: Center hero section component displaying current on-duty staff based on real-time scheduling:
  - **Operator Schedule** (shift-based, 3 shifts per day): 
    * Shift 1 (05:00-12:00): Audrey (Mon/Fri/Sat/Sun), Rully (Tue/Wed/Thu)
    * Shift 2 (12:00-19:00): Jhosua (Mon/Tue/Thu), Ade (Wed/Sun), Rully (Fri/Sat)
    * Shift 3 (19:00-24:00): Aryo (Mon/Tue/Wed/Sat), Ade (Thu), Jhosua (Fri), Internship (Sun)
  - **Producer Schedule** (program + weekday-based):
    * Good Morning Jakarta: Audrey (all days)
    * Office Hour: Risan (Mon/Thu/Fri/Sat/Sun), Indira (Tue/Wed)
    * Coffee Break: Nayla (Mon/Wed/Sun), Patricia (Tue/Thu/Fri/Sat)
    * Drive Time: Luvi (Mon-Fri), Indira (Sat/Sun)
    * Shift Malam: Jhosua (all days)
  - Staff photos in military uniform theme (Operators: blue, Producers: green military)
  - Fallback to generic "CREW" display for staff without photos (Ade, Indira, Internship)
  - Auto-refresh every 30 seconds. Endpoint: `/api/crew-on-duty`
- **Admin Dashboard**: `/admin` route for configuring listener multiplier, stream URL, and managing alert thresholds (min/max listeners).
- **Alert System**: Configurable alert thresholds with real-time monitoring and history logging.
- **Program On Air Integration**: Displays current program details (photo, name, presenters, air time, description) using hardcoded schedule (web scraping disabled due to unreliable JavaScript-rendered content). Schedule follows WIB timezone with accurate time range detection. Response always includes "source": "schedule".
- **Coming Up Next**: Shows next scheduled program after the currently live one, with program image, time range, presenter info, and description. Uses same image mapping logic as "Program Sedang On Air". Displays UPCOMING badge (teal background) with Clock icon. Auto-refreshes every 30 seconds. Endpoint: `/api/coming-up-next` with wrap-around logic (last program → first program).
- **Footer**: Includes a disclaimer for internal use and copyright information.

### System Design Choices
- **Database Schema**: `stats_history` for historical data, `configuration` for app settings, `alert_thresholds` for alert rules, and `alert_history` for alert logs.
- **Data Flow**: 
  - Radio Stats: Frontend requests `/api/radio-stats`, backend fetches from Icecast, parses with Cheerio, applies multiplier from DB, validates with Zod, and returns JSON.
  - Program Info: Frontend requests `/api/on-air-program`, backend scrapes tjradiojakarta.com/live, extracts program data (title, presenter, time, description, image) via Cheerio DOM traversal, falls back to schedule if scraping fails.
- **Error Handling**: Comprehensive error handling with user-friendly messages and loading states.

## External Dependencies
- **Database**: PostgreSQL (specifically Neon for cloud hosting).
- **ORM**: Drizzle ORM.
- **Streaming Server**: Icecast (data source: `https://stream-eu-nc.arenastreaming.com:5450/`).
- **HTTP Client**: Axios.
- **Charting Library**: Recharts.
- **UI Component Library**: Shadcn/ui.
- **Styling Framework**: Tailwind CSS.
- **Parsing Library**: Cheerio.