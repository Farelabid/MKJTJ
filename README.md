# Radio Streaming Dashboard - Statistik & Analisis Data

Dashboard monitoring radio streaming dengan fokus pada **analisis data real-time**, **EMA (Exponential Moving Average)**, **jadwal program**, dan **sistem alert otomatis**.

## 🎯 Tujuan

Platform monitoring yang mampu:
- Menampilkan data pendengar secara **real-time**
- Menghitung **EMA** untuk smoothing data
- Mengelola **jadwal program** berdasarkan WIB
- Menyimpan **riwayat metric** secara otomatis
- Memberikan **alert otomatis** berdasarkan threshold

Fokus: **Akurasi data**, **ketahanan sistem**, dan **pemrosesan statistik**.

---

## 🏗️ Tech Stack

### Backend
- **Node.js** + **Express.js** - REST API server
- **PostgreSQL (Neon)** + **Drizzle ORM** - Database & ORM
- **Axios** - HTTP client untuk fetching data
- **Cheerio** - Web scraping untuk Icecast
- **Zod** - Schema validation

### Frontend
- **React 18** + **TypeScript** - UI framework
- **Vite** - Build tool
- **Wouter** - Lightweight routing
- **TanStack Query** - Data fetching & caching
- **Recharts** - Data visualization
- **Tailwind CSS** - Styling

---

## 📊 Fitur Utama

### 1. Dual-Server Data Integration

Sistem mengambil data dari dua server streaming:
- **Icecast (Primary)** - Scraping HTML menggunakan Cheerio
- **IndoStreamServer (Backup)** - HTTP GET dengan Basic Auth

**Graceful Degradation**: Jika server utama gagal, sistem akan error. Jika backup gagal, sistem tetap berjalan dengan data dari server utama saja.

### 2. Exponential Moving Average (EMA)

Menghitung EMA untuk data pendengar dengan interval **30 detik**:

**Formula**:
```
Nhat(t) = α × Nc(t) + (1 - α) × Nhat(t-1)
```

**Fitur**:
- ✅ Smoothing factor (alpha = 0.25)
- ✅ Spike detection & 5-minute spike window
- ✅ Baseline otomatis dari 5 menit pertama
- ✅ Device-to-listener multiplier (K = 11)
- ✅ Estimasi unique listeners
- ✅ Penyimpanan ke database (minute_snapshots)

**Spike Detection**:
- Deteksi lonjakan > 2× baseline atau > 2× lastN
- Aktivasi spike window selama 5 menit (10 interval × 30s)
- Capping maksimal ±25% dari nilai sebelumnya

### 3. Program Scheduling System

Jadwal siaran berdasarkan **hari** dan **timezone WIB**:
- **Weekday** (Senin-Jumat)
- **Saturday** (Sabtu)
- **Sunday** (Minggu)

**Fitur**:
- ✅ Identifikasi program yang sedang on-air
- ✅ Progress (%) berlangsungnya program
- ✅ Elapsed time calculation
- ✅ Integration dengan EMA stats

### 4. Database Schema

6 tabel utama:

#### stats_history
Snapshot 5 menit untuk data historis.
```sql
- id (UUID)
- timestamp (timestamptz)
- streamName (text)
- listenersRaw (integer)      -- Raw dari server
- listenersPeakRaw (integer)
- listenersCurrent (integer)   -- Raw × multiplier
- listenersPeak (integer)
- bitrate (integer)
- currentlyPlaying (text)
```

#### minute_snapshots
Snapshot 30 detik untuk EMA calculation.
```sql
- id (UUID)
- timestamp (timestamptz)
- rawListeners (integer)
- Nhat (integer)               -- EMA-smoothed listeners
- programName (text)
- date (text)                  -- YYYY-MM-DD (WIB)
```

#### program_stats
Statistik per program per hari.
```sql
- id (UUID)
- programName (text)
- date (text)                  -- YYYY-MM-DD (WIB)
- LM (integer)                 -- Listener-Minutes mentah
- LMhat (integer)              -- Listener-Minutes smoothed
- Nhat (integer)               -- EMA dari raw listeners
- baseline (integer)           -- Avg Nhat 5 menit pertama
- targetLM (integer)
- progress (real)              -- 0-100
- elapsedMinutes (integer)
- avgConcurrentListeners (integer)
- estimatedUniqueListeners (integer)
- startTime (text)             -- HH:mm
- endTime (text)               -- HH:mm
- lastUpdated (timestamptz)
```

#### configuration
Settings sistem (key-value).
```sql
- id (UUID)
- key (text, unique)
- value (text)
- updatedAt (timestamptz)
```

#### alert_thresholds
Batas alert untuk listeners.
```sql
- id (UUID)
- thresholdType (text)         -- 'min_listeners' | 'max_listeners'
- value (integer)
- enabled (boolean)
- createdAt (timestamptz)
```

#### alert_history
Riwayat alert yang triggered.
```sql
- id (UUID)
- thresholdId (varchar)
- listenersCount (integer)
- message (text)
- triggeredAt (timestamptz)
```

### 5. Background Jobs

#### Job 1: Stats Snapshot (5 menit)
```javascript
// Interval: 5 menit
- Fetch data dari Icecast + IndoStreamServer
- Combine listener data
- Simpan ke stats_history
- Check alert thresholds
```

#### Job 2: EMA Calculation (30 detik)
```javascript
// Interval: 30 detik
- Get current program WIB
- Fetch raw listeners (N)
- Calculate Nhat dengan spike detection
- Simpan ke minute_snapshots
- Update program_stats (LM, LMhat, baseline, progress, etc)
```

#### Job 3: Daily Reset (Otomatis per program change)
```javascript
// Trigger: Program baru dimulai
- Reset EMA state untuk program baru
- Finalisasi stats program sebelumnya
- Clear spike window dan baseline
```

### 6. API Endpoints

Semua endpoint fokus pada **fungsi** dan **data**:

#### GET /api/stats/live
Real-time listener statistics.
```json
{
  "timestamp": "2025-01-14T12:00:00Z",
  "listenersRaw": 150,
  "listenersPeakRaw": 200,
  "listenersCurrent": 1650,
  "listenersPeak": 2200,
  "multiplier": 11,
  "sources": {
    "icecast": { "available": true, "listeners": 120, "peak": 180 },
    "indoStream": { "available": true, "listeners": 30, "peak": 20 }
  }
}
```

#### GET /api/ema
EMA data dengan konteks program saat ini.
```json
{
  "currentProgram": "Office Hour",
  "date": "2025-01-14",
  "ema": {
    "Nhat": 145.5,
    "lastN": 150,
    "baselineN": 120,
    "spikeWindowCount": 3,
    "spikeWindowSecondsRemaining": 90,
    "alpha": 0.25,
    "multiplier": 11
  },
  "programStats": { ... },
  "recentSnapshots": [ ... ]
}
```

#### GET /api/program/current
Program yang sedang on-air.
```json
{
  "isLive": true,
  "program": {
    "name": "Office Hour",
    "displayName": "office HOUR",
    "startTime": "10:00",
    "endTime": "13:00",
    "durationMinutes": 180,
    "elapsedMinutes": 45,
    "progress": 25.0,
    "color": "#F44336",
    "stats": { ... }
  }
}
```

#### GET /api/program/stats?date=YYYY-MM-DD
Statistik semua program untuk tanggal tertentu.
```json
{
  "date": "2025-01-14",
  "programs": [
    {
      "programName": "Good Morning Jakarta",
      "LM": 36000,
      "LMhat": 34500,
      "Nhat": 145,
      "baseline": 120,
      "avgConcurrentListeners": 1595,
      "estimatedUniqueListeners": 9570,
      ...
    }
  ],
  "total": 6
}
```

#### GET /api/alerts?limit=50
Combined alert data (thresholds + history).
```json
{
  "thresholds": [ ... ],
  "history": [ ... ],
  "summary": {
    "totalThresholds": 2,
    "activeThresholds": 2,
    "recentAlerts": 15
  }
}
```

#### GET /api/history?hours=24
Stats history dengan optional date range.
```json
{
  "stats": [ ... ],
  "total": 288,
  "query": {
    "hours": "24",
    "startDate": null,
    "endDate": null
  }
}
```

#### GET /api/config
Mendapatkan semua configuration.

#### POST /api/config
Update configuration.

---

## 🚀 Setup & Installation

### Prerequisites
- Node.js 20+
- PostgreSQL database (Neon recommended)
- npm atau yarn

### 1. Clone & Install Dependencies
```bash
git clone <repository-url>
cd MKJTJ
npm install
```

### 2. Environment Variables
Copy `.env.example` ke `.env` dan isi:
```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require

# Server
PORT=5000
NODE_ENV=production

# IndoStreamServer Credentials (optional backup)
INDOSTREAM_USERNAME=your_username
INDOSTREAM_PASSWORD=your_password
```

### 3. Push Database Schema
```bash
# Set DATABASE_URL in environment first
export DATABASE_URL="postgresql://..."

# Push schema to Neon
npm run db:push
```

### 4. Development
```bash
npm run dev
```
Server akan berjalan di `http://localhost:5000`

### 5. Production Build
```bash
npm run build
npm start
```

---

## 📐 Cara Kerja EMA

### Algoritma EMA
1. **Inisialisasi**: Saat program baru dimulai, `Nhat = null`, `baselineN = null`
2. **Spike Detection**: Cek apakah `N > 2 × baseline` atau `N > 2 × lastN`
3. **Spike Capping**: Jika dalam spike window, cap `Nc` di range `lastN × 0.75` sampai `lastN × 1.25`
4. **EMA Calculation**: `Nhat = α × Nc + (1 - α) × Nhat_prev`
5. **Baseline**: Dihitung dari rata-rata 10 snapshot pertama (5 menit)

### Listener-Minutes (LM)
```
LM = Σ(N × interval_minutes)
LMhat = Σ(Nhat × interval_minutes)
```

### Estimasi Unique Listeners
```
estimatedUniqueListeners = LMhat ÷ ALT_session
ALT_session ≈ 6 (Average Listening Time dalam menit)
```

---

## 🔧 Konfigurasi

### EMA Parameters
Di `server/routes.ts`:
```javascript
const ALPHA = 0.25;  // EMA smoothing factor
const DEVICE_TO_LISTENER_MULTIPLIER = 11;  // K multiplier
const EMA_INTERVAL = 30 * 1000;  // 30 seconds
```

### Snapshot Interval
```javascript
const SNAPSHOT_INTERVAL = 5 * 60 * 1000;  // 5 minutes
```

### Program Schedules
Edit di `server/routes.ts`:
```javascript
const WEEKDAY_SCHEDULES = [
  { name: "Night Flow", startHour: 0, startMin: 0, endHour: 6, endMin: 0, durationMinutes: 360 },
  // ... tambahkan program lain
];
```

---

## 🧪 Testing

### Manual Testing
1. Akses dashboard di `http://localhost:5000`
2. Verifikasi data real-time muncul
3. Cek endpoint API menggunakan curl atau Postman

### API Testing
```bash
# Test live stats
curl http://localhost:5000/api/stats/live

# Test EMA data
curl http://localhost:5000/api/ema

# Test current program
curl http://localhost:5000/api/program/current

# Test program stats
curl http://localhost:5000/api/program/stats?date=2025-01-14

# Test alerts
curl http://localhost:5000/api/alerts?limit=20

# Test history
curl http://localhost:5000/api/history?hours=24
```

---

## 📊 Database Queries

### Get Program Stats for Date
```sql
SELECT * FROM program_stats WHERE date = '2025-01-14';
```

### Get Recent EMA Snapshots
```sql
SELECT * FROM minute_snapshots
WHERE program_name = 'Office Hour'
AND date = '2025-01-14'
ORDER BY timestamp DESC
LIMIT 10;
```

### Get Alert History
```sql
SELECT * FROM alert_history
ORDER BY triggered_at DESC
LIMIT 50;
```

### Check Stats History
```sql
SELECT timestamp, listeners_raw, listeners_current
FROM stats_history
WHERE timestamp >= NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;
```

---

## 🐛 Troubleshooting

### Database Connection Error
```
ERROR: DATABASE_URL must be set
```
**Solution**: Set `DATABASE_URL` environment variable.

### Icecast Unavailable
```
ERROR: Icecast unavailable: timeout
```
**Solution**: Icecast server mungkin down. Background job akan retry otomatis.

### IndoStream Backup Failed
```
WARN: IndoStream unavailable, using Icecast only
```
**Solution**: Ini adalah warning saja. Sistem akan tetap berjalan dengan data Icecast.

### EMA Not Calculating
```
LOG: [EMA] No active program at this time
```
**Solution**: Pastikan ada program yang aktif sesuai schedule WIB.

---

## 📝 Notes

### Timezone
Semua waktu menggunakan **WIB (UTC+7)**. Konversi dilakukan otomatis di backend.

### Data Retention
- `stats_history`: Keep all (5-minute snapshots)
- `minute_snapshots`: Optional cleanup untuk data lama
- `alert_history`: Keep all

### Performance
- Background jobs berjalan independent
- Database connection pooling (max 10 connections)
- Query optimization dengan index pada timestamp dan date columns

---

## 🤝 Contributing

1. Fork repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

---

## 📄 License

MIT License - Copyright (c) 2025

---

## 🙏 Acknowledgments

- Icecast streaming server
- IndoStreamServer backup
- Neon PostgreSQL
- Drizzle ORM
- React community
