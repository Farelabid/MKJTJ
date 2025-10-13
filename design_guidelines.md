# Design Guidelines: TJ Radio Jakarta Statistics Dashboard

## Design Approach: Modern Analytics Dashboard
**Selected Approach**: Dashboard-focused design system inspired by Spotify Analytics and SoundCloud Stats interfaces
**Justification**: Utility-focused real-time data application requiring clear information hierarchy, instant readability, and professional data visualization

## Core Design Elements

### A. Color Palette
**Dark Mode (Primary)**
- Background: 222 15% 8% (deep charcoal)
- Surface: 222 15% 12% (elevated cards)
- Primary Brand: 350 85% 55% (radio red - energetic)
- Accent: 187 85% 45% (teal - for data highlights)
- Success: 142 76% 45% (listener growth)
- Text Primary: 0 0% 95%
- Text Secondary: 0 0% 65%

**Light Mode**
- Background: 0 0% 98%
- Surface: 0 0% 100%
- Primary: 350 75% 50%
- Text Primary: 222 15% 12%
- Text Secondary: 0 0% 45%

### B. Typography
**Font Stack**: 'Inter' (Google Fonts) for UI, 'JetBrains Mono' for numeric data
- Hero Stats: 3xl to 5xl, font-bold (current listeners)
- Section Headers: xl to 2xl, font-semibold
- Labels: sm, font-medium, text-secondary
- Live Data: mono font, tracking-tight for numbers
- Body Text: base, leading-relaxed

### C. Layout System
**Spacing Scale**: Tailwind units of 3, 4, 6, 8, 12, 16
- Card padding: p-6 to p-8
- Section gaps: gap-6 on mobile, gap-8 on desktop
- Container: max-w-7xl mx-auto px-4
- Grid: 1 col mobile, 2-3 cols desktop for stat cards

### D. Component Library

**Hero Stats Card**
- Large animated counter displaying current listeners × 4
- Prominent display with pulse effect on data update
- Peak listeners comparison badge
- Live indicator (red dot + "LIVE" text)

**Information Cards** (Grid Layout)
- Radio name with station logo placeholder
- Description and tagline
- Bitrate and stream quality indicator
- Stream URL with copy button
- Currently playing track (marquee if long)

**Data Visualization**
- Simple bar comparison: Current vs Peak
- Percentage indicator of current/peak ratio
- Color-coded based on threshold (green >80%, yellow 50-80%, red <50%)
- Sparkline chart showing listener trend (if historical data available)

**Status Indicators**
- Auto-refresh countdown timer (circular progress)
- Last updated timestamp
- Connection status badge
- Data fetch error states with retry button

**Action Elements**
- "Listen Live" CTA button (primary, with external link icon)
- Share statistics button (secondary)
- Refresh data manually button (ghost)

### E. Animations
**Minimal & Purposeful Only**
- Counter increment animation on data refresh (0.3s ease)
- Subtle pulse on live indicator (2s infinite)
- Fade-in on card data updates (0.2s)
- Loading skeleton for data fetch states
- NO decorative animations, scrolling effects, or transitions

## Page Structure

**Dashboard Layout** (Single Page)
1. **Header Bar** (sticky)
   - TJ Radio Jakarta logo/branding
   - Live status indicator
   - Auto-refresh timer display

2. **Hero Statistics Section**
   - Massive current listeners count (center focus)
   - Peak listeners comparison
   - Visual progress toward peak

3. **Radio Information Grid** (2-3 columns desktop, 1 mobile)
   - Station details card
   - Stream information card
   - Currently playing card

4. **Data Visualization Section**
   - Current vs Peak bar chart
   - Listener percentage gauge
   - Quick stats tiles (bitrate, stream start time)

5. **Footer/Actions**
   - Listen Live prominent CTA
   - Last updated info
   - Data source attribution

## Accessibility & Performance
- High contrast ratios (4.5:1 minimum)
- Focus indicators on all interactive elements
- Screen reader labels for live data updates
- Reduced motion respect for animations
- Optimized for 30-second auto-refresh cycle

## Images
**No hero image required** - This is a data dashboard where statistics are the hero
**Station Logo**: Small square logo (64x64px) in header and station info card - use placeholder with radio wave icon if not available

## Critical Dashboard Principles
- **Data First**: Numbers are the primary content, not decoration
- **Instant Readability**: User should grasp all stats in <3 seconds
- **Live Feel**: Visual cues that data is real-time and updating
- **Professional Trust**: Clean, corporate dashboard aesthetic builds credibility
- **Mobile Optimized**: Full functionality in vertical layout for monitoring on-the-go