# TJ Radio Jakarta - Dashboard Statistik Real-Time

## Overview
Dashboard statistik real-time untuk TJ Radio Jakarta yang menampilkan data streaming langsung dari server Icecast. Aplikasi ini menampilkan jumlah pendengar dengan perhitungan khusus (4x multiplier), informasi stasiun, dan visualisasi data yang menarik.

## Tujuan Proyek
- Menampilkan statistik radio streaming secara real-time
- Memberikan visualisasi data yang mudah dibaca dan profesional
- Auto-refresh data setiap 30 detik
- Mendukung dark mode dan light mode
- Responsive design untuk desktop dan mobile

## Status Terkini
✅ **Completed** - MVP lengkap dan berfungsi dengan baik

### Fitur yang Sudah Diimplementasikan
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

## Arsitektur Proyek

### Frontend
- **Framework**: React + TypeScript
- **Routing**: Wouter
- **State Management**: TanStack Query (React Query)
- **Styling**: Tailwind CSS + Shadcn/ui components
- **Theme**: Dark/Light mode dengan localStorage persistence
- **Fonts**: Inter (UI), JetBrains Mono (numeric data)

### Backend
- **Framework**: Express.js
- **Data Source**: Icecast server (https://stream-eu-nc.arenastreaming.com:5450/)
- **Parsing**: Cheerio untuk parse HTML
- **HTTP Client**: Axios
- **Validation**: Zod schema

### Data Flow
1. Frontend melakukan request ke `/api/radio-stats`
2. Backend fetch data dari Icecast server
3. Parse HTML menggunakan Cheerio
4. Apply 4x multiplier ke listeners data
5. Validate dengan Zod schema
6. Return JSON ke frontend
7. Frontend display dengan React Query (auto-refresh 30s)

### Key Files
- `shared/schema.ts` - Data model dan TypeScript interfaces
- `server/routes.ts` - API endpoint untuk fetch radio stats
- `client/src/pages/dashboard.tsx` - Main dashboard page
- `client/src/components/theme-provider.tsx` - Theme management
- `tailwind.config.ts` - Design tokens dan theme configuration
- `design_guidelines.md` - Design system guidelines

## Perhitungan Khusus
- **Listeners (current)** = Data dari Icecast × 4
- **Listeners (peak)** = Data dari Icecast × 4

Multiplier 4x diterapkan di backend sebelum data dikirim ke frontend.

## Design System
Dashboard menggunakan design system terinspirasi dari Spotify Analytics dan SoundCloud Stats:
- **Primary Color**: Radio red (350 85% 55%) - energetic brand color
- **Accent Color**: Teal (187 85% 45%) - untuk data highlights
- **Success Color**: Green (142 76% 45%) - untuk listener growth
- **Dark Mode Default**: Deep charcoal background
- **Typography**: Inter untuk UI, JetBrains Mono untuk angka
- **Animations**: Minimal dan purposeful (counter animations, pulse indicators)

## Environment Variables
Tidak ada environment variables yang diperlukan. Aplikasi mengambil data langsung dari public Icecast server.

## Running the Project
```bash
npm run dev
```
Aplikasi akan berjalan di port 5000.

## Testing
Dashboard dapat ditest dengan:
- Memastikan data loading dengan benar dari Icecast
- Verify auto-refresh bekerja setiap 30s
- Test theme toggle (dark/light mode)
- Test copy URL functionality
- Test manual refresh button
- Verify responsive design di berbagai device sizes
- Test error handling jika Icecast server tidak dapat diakses

## Future Enhancements
1. Historical data tracking dan trend charts
2. Database untuk menyimpan riwayat statistik
3. Export data ke CSV/PDF
4. Admin panel untuk konfigurasi
5. Alert notifications untuk threshold tertentu
6. Multiple stream support
7. Customizable multiplier dari UI

## Catatan Teknis
- Listener ratio calculation sudah di-guard untuk handle zero peak (mencegah NaN)
- Clipboard API sudah ada fallback untuk non-secure contexts
- Schema validation menggunakan Zod di backend
- Error handling komprehensif dengan user-friendly messages
- Progress bar clamped 0-100% untuk mencegah overflow visual

## Kontak
Dashboard untuk TJ Radio Jakarta - Teman Perjalanan Jakarta
Data source: stream-eu-nc.arenastreaming.com
