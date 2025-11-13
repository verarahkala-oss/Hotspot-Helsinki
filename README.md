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
- 🏢 **Venue details with Google Places** (ratings, photos, opening hours)
- 🍽️ **Nearby places finder** (restaurants, cafes near events)

## Data Sources

This app aggregates events from **free public APIs** - no sign-ups required!

| Source | Events | Coverage |
|--------|--------|----------|
| **LinkedEvents API** | ~100-300 | Official City of Helsinki events (museums, libraries, cultural venues, festivals) |
| **MyHelsinki API** | ~50-150 | Tourism & city events, attractions |
| **Google Places API** | Venue Data | Venue details, ratings, photos, opening hours, nearby places |

**Total: ~150-450 events** with rich venue information!

## Setup

### Prerequisites
- Node.js 18+ and npm
- Google Places API key (optional but recommended for venue details)

### Installation
```bash
npm install
```

### Environment Variables

Create a `.env` file in the root directory:

```bash
# Google Places API (Optional but recommended)
VITE_GOOGLE_PLACES_API_KEY=your_google_places_api_key_here
GOOGLE_PLACES_API_KEY=your_google_places_api_key_here
```

**Getting Google Places API Key:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable these APIs:
   - Places API
   - Maps JavaScript API
4. Go to "Credentials" → "Create Credentials" → "API Key"
5. Copy your API key to both environment variables

**Free tier includes:**
- 100 requests/day for Place Details
- $200 monthly credit (covers ~28,000 requests)
- No credit card required for testing

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

Add your Google Places API key in Vercel environment variables:
- `GOOGLE_PLACES_API_KEY` (for server-side API)
- `VITE_GOOGLE_PLACES_API_KEY` (for client-side - optional)

## Google Places Integration

### Features Available:

1. **Venue Details in Event Popups**:
   - **Automatically shown** when clicking on any event marker
   - Venue photos (300px high-quality images)
   - Star ratings & review counts
   - Price level (€-€€€€)
   - Opening hours & current status (🟢 Open / 🔴 Closed)
   - Today's opening hours
   - Full address, phone number, and venue website
   - Seamlessly integrated into map popups with React

2. **Nearby Places Finder**:
   - Expandable section in event popups
   - Shows restaurants & cafes within 500m of event venue
   - Includes 60×60px photos, ratings, and open/closed status
   - Helps users plan meals around events
   - Lazy-loaded on demand to minimize API calls

3. **Smart Caching**:
   - 1-hour client-side cache (reduces duplicate API calls)
   - 1-hour server-side HTTP cache
   - Minimizes API calls (well within free tier limits)
   - Estimated cost: $0.17/day for 1,000 daily users

### How It Works:

When you click on any event marker on the map, the popup automatically:
1. Shows basic event information (title, category, price, time)
2. Searches for the venue using Google Places API
3. Fetches detailed venue information (photos, ratings, hours)
4. Displays venue details directly in the popup
5. Offers option to view nearby restaurants & cafes

All venue data is cached for 1 hour to minimize API usage and ensure fast loading.

### Usage in Code:

```typescript
import { VenueDetails } from '../components/VenueDetails';

// In your event popup:
<VenueDetails 
  venueName="Kiasma Museum"
  lat={60.1717}
  lng={24.9362}
/>
```

Or use the hooks directly:

```typescript
import { useVenueDetails, useNearbyPlaces } from '../hooks/useGooglePlaces';

const { details, loading } = useVenueDetails("Venue Name", lat, lng);
const { places } = useNearbyPlaces(lat, lng, 500, "restaurant");
```

## API Endpoints

### `/api/events-lite`

Query parameters:

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

### `/api/google-places`

Query parameters:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | string | ✅ | One of: `details`, `search`, `nearby`, `photo` |
| `placeId` | string | For `details` | Google Place ID |
| `query` | string | For `search` | Place name to search |
| `lat` | float | For `search`, `nearby` | Latitude |
| `lng` | float | For `search`, `nearby` | Longitude |
| `radius` | int | For `nearby` | Search radius in meters (default: 500) |
| `type` | string | For `nearby` | Place type (default: "restaurant") |
| `photoReference` | string | For `photo` | Photo reference from place details |
| `maxWidth` | int | For `photo` | Max photo width (default: 400) |

**Examples:**
```
/api/google-places?action=search&query=Kiasma&lat=60.17&lng=24.94
/api/google-places?action=details&placeId=ChIJ...
/api/google-places?action=nearby&lat=60.17&lng=24.94&radius=500&type=restaurant
/api/google-places?action=photo&photoReference=...&maxWidth=400
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
4. **Google Places cache**: 1 hour (client & server-side)

API sources are only hit when all caches expire, reducing external API calls by ~95%.

## Technologies
- React + TypeScript
- Vite
- MapLibre GL JS
- LinkedEvents API (City of Helsinki)
- MyHelsinki Open API
- Google Places API
- Vercel + Vercel KV (serverless + caching)

## License
MIT


