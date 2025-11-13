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

This app aggregates events from multiple sources:

| Source | Status | Events | Coverage |
|--------|--------|--------|----------|
| **LinkedEvents API** | ✅ Always Active | ~50-200 | Official City of Helsinki events (museums, libraries, cultural venues) |
| **MyHelsinki API** | ✅ Always Active | ~30-100 | Tourism & city events |
| **Eventbrite API** | 🔑 Requires Key | ~100-300 | Community events, concerts, workshops, nightlife |
| **Meetup API** | 🔑 Requires Key | ~50-100 | Tech meetups, networking, professional events |

### Without API Keys
- Works immediately with LinkedEvents + MyHelsinki
- Shows ~80-300 official city events
- Good for tourists & general events

### With Eventbrite Key (Recommended)
- Adds ~100-300 community events
- Better nightlife, entertainment, workshops coverage
- 2-3x more events on the map

### With Meetup Key (Optional)
- Adds ~50-100 tech/networking events
- Best for professionals & tech community
- Great supplement to Eventbrite

## Setup

### Prerequisites
- Node.js 18+ and npm

### Installation
```bash
npm install
```

### Environment Variables

#### For Local Development:
Create a `.env` file in the root directory:

```bash
# Optional: Eventbrite API (Recommended for more events)
EVENTBRITE_API_KEY=your_private_token_here

# Optional: Meetup API
MEETUP_API_KEY=your_oauth_token_here
```

#### For Production (Vercel):
Add these as environment variables in your Vercel project settings:
- `EVENTBRITE_API_KEY` (optional)
- `MEETUP_API_KEY` (optional)
- Vercel KV variables are auto-configured when you add KV storage

### Getting API Keys

#### Eventbrite API Key (Recommended):
1. Go to [Eventbrite Platform](https://www.eventbrite.com/platform/api)
2. Sign in or create an Eventbrite account
3. Navigate to Account Settings → API Keys
4. Click "Create API Key" or "Create App"
5. Copy your **Private Token**
6. Add to `.env` as `EVENTBRITE_API_KEY=YOUR_TOKEN`

**Free tier limits:**
- 1,000 requests/day (plenty for this app with caching)
- No credit card required

#### Meetup API Key (Optional):
1. Go to [Meetup API OAuth](https://secure.meetup.com/meetup_api/oauth_consumers/)
2. Sign in to Meetup
3. Create an OAuth Consumer
4. Get your access token
5. Add to `.env` as `MEETUP_API_KEY=YOUR_TOKEN`

**Note:** Meetup API setup is more complex (OAuth 2.0). The app works great with just Eventbrite.

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
| `bbox` | string | - | Legacy: "minLng,minLat,maxLng,maxLat" |

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
- Eventbrite API (optional)
- Meetup API (optional)
- Vercel + Vercel KV (serverless + caching)

## License
MIT


