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
- **Program Images**: Large presenter photos for "Program Sedang On Air" and "Coming Up Next"; small, colorful rounded icons for programs in statistics lists.
- **Badge Styling**: "LIVE Badge" (red, dual animation) and "UPCOMING Badge" (teal, static).
- **Host Photos**: 22 unique host photos dynamically displayed in the Team Work section based on schedule.

### Technical Implementations
- **Frontend**: React with TypeScript, Wouter for routing, TanStack Query for state management, Tailwind CSS and Shadcn/ui for styling, Recharts for data visualization.
- **Backend**: Express.js, PostgreSQL (Neon) with Drizzle ORM, Cheerio for HTML parsing (Icecast stats + tjradiojakarta.com/live program info), Axios for HTTP requests, Zod for schema validation.
- **Data Sources**: Icecast server (listener statistics) and tjradiojakarta.com/live (current program information via web scraping).
- **Background Jobs**: Interval-based snapshots for historical data and alert threshold checks.
- **Metrics Calculation**:
    - "PENDENGAR SAAT INI" = Raw listeners (N) × 11.
    - "TOTAL PENDENGAR" = (N × 11) × 6 × program progress percentage.
    - EMA smoothing (α=0.25) applied for spike detection, resetting at midnight or program change.

### Feature Specifications
- **Real-time Statistics**: Current listeners, peak listeners, and currently playing song, auto-refreshing every 30 seconds.
- **Speedometer Gauge**: Custom gauge with a pre-rendered background, animated purple/magenta needle based on listener count, and neon-glow numerical display.
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
- **Database Schema**: `stats_history`, `configuration`, `alert_thresholds`, and `alert_history`.
- **Data Flow**: Frontend requests `/api/radio-stats` and `/api/on-air-program`; backend fetches from Icecast and scrapes the website.
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
- **Weather API**: Open-Meteo API.