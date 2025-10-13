# TJ Radio Jakarta - Dashboard Statistik Real-Time

## Overview
This project is a real-time dashboard for TJ Radio Jakarta, designed to display live streaming statistics from an Icecast server. Its primary purpose is to provide an internal, professional, and easily readable visualization of listener data. Key capabilities include displaying current listeners with a special 4x multiplier, station information, historical data visualization, and a comprehensive configuration management system. The dashboard also features an alert system for threshold notifications and supports both dark/light modes and responsive design. The overarching business vision is to provide TJ Radio Jakarta with robust tools for monitoring listenership, understanding trends, and managing broadcast configurations effectively.

## User Preferences
I prefer clear, concise explanations and a professional tone. For development, I favor an iterative approach, with a focus on maintainability and scalable solutions. Please ensure that all new features are thoroughly tested and documented. I expect the agent to ask for confirmation before making significant architectural changes or adding new external dependencies.

## System Architecture

### UI/UX Decisions
The dashboard's design is inspired by Spotify Analytics and SoundCloud Stats, featuring a dark mode default with deep charcoal backgrounds.
- **Color Scheme**: Primary "Radio red" (350 85% 55%), accent Teal (187 85% 45%) for data highlights, and Green (142 76% 45%) for success indicators.
- **Typography**: Inter for UI elements, and JetBrains Mono for numeric data.
- **Animations**: Minimal and purposeful, such as counter animations and pulse indicators.
- **Branding**: Official TJ Radio logo in the header, modern neon "ON AIR" graphic, and program-specific logos.
- **Layout**: Responsive design for both desktop and mobile, with key metrics prominently displayed.
- **Information Display**: Real-time WIB clock and Indonesian date display in the header. Program statistics include dual metrics ("Pendengar Saat Ini" = raw listeners × 6.5 and "TOTAL PENDENGAR" = cumulative absolute changes × 6.5), with EMA smoothing for spike detection.

### Technical Implementations
- **Frontend**: React with TypeScript, Wouter for routing, TanStack Query for state management, Tailwind CSS and Shadcn/ui for styling, Recharts for historical data visualization.
- **Backend**: Express.js, PostgreSQL (Neon) with Drizzle ORM, Cheerio for HTML parsing from Icecast, Axios for HTTP requests, Zod for schema validation.
- **Data Source**: Icecast server.
- **Background Jobs**: Interval-based snapshots (every 5 minutes) to store historical data and check alert thresholds.
- **Metrics Calculation**:
    - **Radio Stats**: Listeners (current/peak) = Raw Icecast data × Configurable Multiplier (default 4).
    - **Program Analytics (Updated Oct 2025 - Final)**: 
      * "Total Pendengar Saat ini" = Raw listeners (N) × **6.5** (direct real-time calculation)
      * "TOTAL PENDENGAR" = Cumulative absolute changes × **6.5** (sum of |ΔN| × 6.5 every minute since program start)
      * EMA smoothing (α=0.25) used for spike detection (>50% threshold, 5-min capping at ±25%)
      * State resets automatically at midnight or program change to prevent spurious spikes

### Feature Specifications
- **Real-time Statistics**: Display of current listeners, peak listeners, and currently playing song with auto-refresh every 30 seconds.
- **Historical Data**: PostgreSQL database for storing listener statistics snapshots, with time-series charts (24h, 7d, 30d views) and CSV export functionality.
- **Admin Dashboard**: `/admin` route for configuring listener multiplier, stream URL, and managing alert thresholds (min/max listeners).
- **Alert System**: Configurable alert thresholds with real-time monitoring and history logging.
- **Program On Air Integration**: Displays current program details (photo, name, presenters, air time, description) based on a hardcoded schedule in WIB timezone.
- **Footer**: Includes a disclaimer for internal use and copyright information.

### System Design Choices
- **Database Schema**: `stats_history` for historical data, `configuration` for app settings, `alert_thresholds` for alert rules, and `alert_history` for alert logs.
- **Data Flow**: Frontend requests `/api/radio-stats`, backend fetches from Icecast, parses with Cheerio, applies multiplier from DB, validates with Zod, and returns JSON.
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