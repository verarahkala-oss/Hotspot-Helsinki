# Hotspot-Helsinki
Live events happening in Helsinki

## Features
- 🗺️ Interactive map showing live events in Helsinki
- 🔴 LIVE NOW indicator for currently happening events
- 📍 Geolocation support
- 🎨 Dark/Light theme support
- 🔍 Search and filter events by name, price, and status
- 📊 Event clustering for better map visualization
- ⚡ Auto-refresh every 10 minutes
- 🔄 10-minute caching to reduce API calls

## Data Sources
This app fetches events from two sources:
1. **LinkedEvents API** - City of Helsinki's official events database
2. **Eventbrite API** - Additional events from Eventbrite platform

## Setup

### Prerequisites
- Node.js 18+ and npm

### Installation
```bash
npm install
```

### Environment Variables
Create a `.env` file in the root directory:

```bash
# Eventbrite API Key (optional - app works without it)
VITE_EVENTBRITE_API_KEY=your_eventbrite_api_key_here
```

**How to get an Eventbrite API key:**
1. Go to [Eventbrite API Documentation](https://www.eventbrite.com/platform/api)
2. Sign in or create an Eventbrite account
3. Create an app to get your API key
4. Copy your **Private Token** into the `.env` file

> **Note:** The app will work without an Eventbrite API key - it will just show events from LinkedEvents API only.

### Development
```bash
npm run dev
```

### Build
```bash
npm run build
```

## Technologies
- React + TypeScript
- MapLibre GL JS
- Vite
- LinkedEvents API
- Eventbrite API

