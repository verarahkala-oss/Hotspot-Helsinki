# Hotspot-Helsinki
Live events happening in Helsinki

## Features
- 🗺️ Interactive map showing live events in Helsinki
- 🔴 LIVE NOW indicator for currently happening events
- 📍 Geolocation support
- 🎨 Dark/Light theme support
- 🔍 Search and filter events by name, price, category, and status
- 📊 Event clustering for better map visualization
- ⚡ Auto-refresh every 10 minutes
- 🔄 Multi-level caching (90s in-memory + 5min Vercel KV)
- 🎯 Smart scoring & ranking (distance, live status, free events)
- 🔗 Multi-source aggregation with deduplication

## Data Sources

This app aggregates events from **free public APIs** - no sign-ups or API keys required!

| Source | Events | Coverage |
|--------|--------|----------|
| **LinkedEvents API** | ~100-300 | Official City of Helsinki events (museums, libraries, cultural venues, festivals) |
| **MyHelsinki API** | ~50-150 | Tourism & city events, attractions |

**Total: ~150-450 events at any given time!**

All data is fetched from official City of Helsinki APIs - always up-to-date, always free.

## Setup

### Prerequisites
- Node.js 18+ and npm

### Installation
```bash
npm install
```

### Environment Variables

**No API keys needed!** The app works out of the box.

For production on Vercel, KV cache variables are auto-configured when you add KV storage (optional).

### Development
```bash
npm run dev
```

App runs at: `http://localhost:5173/`

### Build
```bash
npm run build
```

### Deploy to Vercel
```bash
vercel deploy
```

## API Endpoint

The `/api/events-lite` endpoint supports these query parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `lat` | float | 60.1699 | User latitude for distance scoring |
| `lng` | float | 24.9384 | User longitude for distance scoring |
| `radiusKm` | float | 5 | Radius filter in kilometers (1-50) |
| `limit` | int | 200 | Maximum events to return (1-1000) |
| `q` | string | - | Search query (title, description, venue) |
| `category` | string | - | Filter: music, food, sports, family, arts, tech, nightlife, other |
| `freeOnly` | boolean | false | Show only free events |
| `liveOnly` | boolean | false | Show only currently happening events |
| `bbox` | string | - | Bounding box: "minLng,minLat,maxLng,maxLat" |

**Example:**
```
/api/events-lite?lat=60.17&lng=24.94&radiusKm=10&category=music&freeOnly=true&liveOnly=true
```

## Event Scoring Algorithm

Events are ranked by a smart scoring system:

- **Base score**: 1000 points
- **Distance**: -10 points per km from user location
- **Live now**: +500 points (huge boost for currently happening events)
- **Starting soon**: +200 (within 2h), +100 (within 6h), +50 (within 24h)
- **Free event**: +50 points
- **Has image**: +25 points
- **Has URL**: +10 points

This ensures the most relevant events appear first: live events near you, then upcoming events, prioritizing free events with good info.

## Caching Strategy

Three-level caching for optimal performance:

1. **In-memory cache**: 90 seconds (ultra-fast, per-instance)
2. **Vercel KV cache**: 5 minutes (shared across instances)
3. **HTTP cache headers**: 60 seconds (browser/CDN caching)

API sources are only hit when all caches expire, reducing external API calls by ~95%.

## Technologies
- React + TypeScript
- Vite
- MapLibre GL JS
- LinkedEvents API (City of Helsinki)
- MyHelsinki Open API
- Vercel + Vercel KV (serverless + caching)

## License
MIT


