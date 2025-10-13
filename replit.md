# TJ Radio Jakarta - Dashboard Statistik Real-Time

## Overview
Dashboard statistik real-time untuk TJ Radio Jakarta yang menampilkan data streaming langsung dari server Icecast. Aplikasi ini menampilkan jumlah pendengar dengan perhitungan khusus (4x multiplier), informasi stasiun, visualisasi data historis, dan sistem manajemen konfigurasi lengkap.

## Tujuan Proyek
- Menampilkan statistik radio streaming secara real-time
- Menyimpan dan menganalisis data historis untuk tren
- Memberikan visualisasi data yang mudah dibaca dan profesional
- Auto-refresh data setiap 30 detik
- Mendukung dark mode dan light mode
- Responsive design untuk desktop dan mobile
- Admin panel untuk konfigurasi dan monitoring
- Alert system untuk notifikasi threshold

## Status Terkini
✅ **Completed** - MVP lengkap + Next Phase Features + UI Improvements

### Fitur MVP (Completed)
1. **Hero Statistics Display**
   - Tampilan besar untuk jumlah pendengar saat ini (dengan animasi counter)
   - Badge untuk peak listeners
   - Progress bar menuju peak
   - Live indicator dengan animasi pulse

2. **Radio Information Cards**
   - Detail stasiun (nama, deskripsi, genre)
   - Informasi stream (bitrate, format, waktu mulai)
   - Currently playing (lagu/program yang sedang diputar)
   - Copy URL stream dengan tombol

3. **Data Visualization**
   - Bar chart perbandingan current vs peak listeners
   - Percentage indicator dengan color coding (hijau >80%, kuning 50-80%, merah <50%)
   - Quick stats tiles (listeners aktual, peak aktual, multiplier, kualitas)

4. **Interactive Features**
   - Auto-refresh setiap 30 detik dengan countdown timer
   - Manual refresh button
   - Theme toggle (dark/light mode)
   - Listen Live button (link ke stream)
   - Copy stream URL dengan fallback untuk non-secure contexts

5. **UX Enhancements**
   - Beautiful loading states dengan skeleton
   - Error states dengan retry button
   - Toast notifications untuk feedback
   - Smooth animations pada data update
   - Responsive layout untuk mobile dan desktop

### Next Phase Features (Completed)
1. **Database & Historical Data Storage**
   - PostgreSQL database untuk persistence
   - Stats history table dengan timestamp
   - Background job menyimpan snapshot setiap 5 menit
   - API endpoints untuk historical data

2. **Historical Charts & Trend Visualization**
   - Time-series chart dengan Recharts
   - Date range selector (24 jam, 7 hari, 30 hari)
   - Statistik otomatis (rata-rata, maksimum, minimum)
   - Auto-refresh data chart setiap 1 menit

3. **Export Functionality**
   - CSV export dengan date range filter
   - Download statistics data
   - Export panel dengan time range selector

4. **Admin Dashboard & Configuration**
   - Admin page di `/admin`
   - Settings untuk listener multiplier (editable)
   - Settings untuk stream URL (editable)
   - Configuration persistence di database
   - Link dari main dashboard ke admin panel

5. **Alert System & Notifications**
   - Alert threshold management (min/max listeners)
   - Real-time monitoring saat save snapshot
   - Alert history tracking di database
   - Enable/disable threshold
   - Alert management UI di admin panel

### UI Improvements (Completed)
1. **Program Listeners Analytics**
   - Jumlah pendengar per program berdasarkan time slot
   - 6 program dengan jadwal tetap:
     * Good Morning Jakarta (06:00-10:00)
     * Office Hour (10:01-13:00)
     * Coffee Break (13:01-16:00)
     * Drive Time (16:01-20:00)
     * Shift Malam (20:01-22:00)
     * Yesterday Hits (22:01-05:59)
   - Perhitungan otomatis dari data historis 24 jam
   - Semua angka dikalikan 4 (multiplier)
   - Visualisasi bar chart dengan color coding

2. **TJ Radio Branding**
   - Logo oficial TJ Radio di header dashboard
   - Menggantikan icon generic dengan brand identity

3. **Dashboard Simplification**
   - Menghapus "Statistik Cepat" (raw data)
   - Fokus pada metrics yang relevan untuk user

## Arsitektur Proyek

### Frontend
- **Framework**: React + TypeScript
- **Routing**: Wouter (2 routes: `/` dashboard, `/admin` admin panel)
- **State Management**: TanStack Query (React Query)
- **Styling**: Tailwind CSS + Shadcn/ui components
- **Theme**: Dark/Light mode dengan localStorage persistence
- **Fonts**: Inter (UI), JetBrains Mono (numeric data)
- **Charts**: Recharts untuk visualisasi data historis

### Backend
- **Framework**: Express.js
- **Database**: PostgreSQL (Neon)
- **ORM**: Drizzle ORM
- **Data Source**: Icecast server (https://stream-eu-nc.arenastreaming.com:5450/)
- **Parsing**: Cheerio untuk parse HTML
- **HTTP Client**: Axios
- **Validation**: Zod schema
- **Background Jobs**: Interval-based snapshot (5 minutes)

### Database Schema
1. **stats_history** - Historical statistics snapshots
   - id, timestamp, streamName, listenersRaw, listenersPeakRaw, listenersCurrent, listenersPeak, bitrate, currentlyPlaying

2. **configuration** - App configuration
   - id, key, value, updatedAt
   - Keys: listener_multiplier, stream_url

3. **alert_thresholds** - Alert threshold settings
   - id, thresholdType (min_listeners/max_listeners), value, enabled, createdAt

4. **alert_history** - Alert history log
   - id, thresholdId, listenersCount, message, triggeredAt

### Data Flow
1. Frontend melakukan request ke `/api/radio-stats`
2. Backend fetch data dari Icecast server
3. Parse HTML menggunakan Cheerio
4. Get multiplier dari database config (default 4)
5. Apply multiplier ke listeners data
6. Validate dengan Zod schema
7. Return JSON ke frontend
8. Frontend display dengan React Query (auto-refresh 30s)

**Background Job:**
- Setiap 5 menit, save snapshot ke database
- Check alert thresholds
- Trigger alert jika threshold tercapai
- Log ke alert_history table

### Key Files
- `shared/schema.ts` - Data model, TypeScript interfaces, dan database schema
- `server/db.ts` - Database connection (Neon PostgreSQL)
- `server/storage.ts` - Storage layer dengan IStorage interface
- `server/routes.ts` - API endpoints + background job scheduler
- `client/src/pages/dashboard.tsx` - Main dashboard page
- `client/src/pages/admin.tsx` - Admin configuration page
- `client/src/components/historical-chart.tsx` - Historical data visualization
- `client/src/components/export-panel.tsx` - CSV export functionality
- `client/src/components/alert-management.tsx` - Alert threshold management
- `client/src/components/theme-provider.tsx` - Theme management
- `tailwind.config.ts` - Design tokens dan theme configuration
- `design_guidelines.md` - Design system guidelines

## Perhitungan Khusus
- **Listeners (current)** = Data dari Icecast × Multiplier (configurable, default 4)
- **Listeners (peak)** = Data dari Icecast × Multiplier (configurable, default 4)

Multiplier dapat diubah melalui admin panel dan disimpan di database.

## Design System
Dashboard menggunakan design system terinspirasi dari Spotify Analytics dan SoundCloud Stats:
- **Primary Color**: Radio red (350 85% 55%) - energetic brand color
- **Accent Color**: Teal (187 85% 45%) - untuk data highlights
- **Success Color**: Green (142 76% 45%) - untuk listener growth
- **Dark Mode Default**: Deep charcoal background
- **Typography**: Inter untuk UI, JetBrains Mono untuk angka
- **Animations**: Minimal dan purposeful (counter animations, pulse indicators)

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (auto-configured)
- Tidak ada API keys yang diperlukan untuk Icecast (public server)

## Running the Project
```bash
npm run dev
```
Aplikasi akan berjalan di port 5000.

### Database Commands
```bash
npm run db:push        # Push schema changes to database
npm run db:push --force # Force push if needed
```

## API Endpoints

### Public Endpoints
- `GET /api/radio-stats` - Current radio statistics
- `GET /api/stats-history?hours=24` - Historical stats (query param: hours)
- `GET /api/export/csv?hours=24` - Export CSV (query param: hours)

### Configuration Endpoints
- `GET /api/config` - Get all configuration
- `POST /api/config` - Set configuration (body: {key, value})

### Alert Endpoints
- `GET /api/alert-thresholds` - Get all alert thresholds
- `POST /api/alert-thresholds` - Create threshold (body: {thresholdType, value, enabled})
- `PATCH /api/alert-thresholds/:id` - Update threshold (body: {enabled})
- `DELETE /api/alert-thresholds/:id` - Delete threshold
- `GET /api/alert-history?limit=50` - Get alert history

## Admin Panel
Access admin panel di `/admin`:
- Configure listener multiplier
- Configure stream URL
- Manage alert thresholds (min/max listeners)
- View threshold status (enabled/disabled)
- Create, toggle, and delete thresholds

## Testing
Dashboard dapat ditest dengan:
- Memastikan data loading dengan benar dari Icecast
- Verify auto-refresh bekerja setiap 30s
- Test theme toggle (dark/light mode)
- Test copy URL functionality
- Test manual refresh button
- Verify responsive design di berbagai device sizes
- Test error handling jika Icecast server tidak dapat diakses
- Test historical chart dengan berbagai time range (24h, 7d, 30d)
- Test CSV export functionality
- Test admin configuration changes
- Test alert threshold creation and management

## Background Jobs
- **Snapshot Job**: Runs every 5 minutes
  - Fetches current stats from Icecast
  - Applies multiplier from config
  - Saves to stats_history table
  - Checks alert thresholds
  - Logs alerts to alert_history table

## Future Enhancements
1. PDF export dengan charts (currently only CSV)
2. Email/SMS notifications untuk alerts
3. Real-time websocket updates (instead of polling)
4. User authentication untuk admin panel
5. Multiple stream support
6. Advanced analytics dan reporting
7. API rate limiting
8. Data retention policies

## Catatan Teknis
- Listener ratio calculation sudah di-guard untuk handle zero peak (mencegah NaN)
- Clipboard API sudah ada fallback untuk non-secure contexts
- Schema validation menggunakan Zod di backend
- Error handling komprehensif dengan user-friendly messages
- Progress bar clamped 0-100% untuk mencegah overflow visual
- Historical chart menggunakan custom queryFn untuk proper URL formatting
- Background job menggunakan setInterval (5 minutes)
- Alert monitoring terintegrasi dengan snapshot job
- Database menggunakan Neon PostgreSQL dengan Drizzle ORM

## Kontak
Dashboard untuk TJ Radio Jakarta - Teman Perjalanan Jakarta
Data source: stream-eu-nc.arenastreaming.com
