// Multi-source events aggregator with Vercel KV caching (5m TTL) + in-memory micro-cache (90s)
import { kv } from "@vercel/kv";

const KV_KEY = "events:aggregated:v3";
const KV_TTL_SEC = 300; // 5 minutes

let CACHE = { at: 0, json: null }; // in-memory micro-cache per running instance
const TTL_MS = 90 * 1000; // 90 seconds

// ==================== UNIFIED EVENT TYPE ====================
/**
 * @typedef {Object} HotspotEvent
 * @property {string} id - Unique identifier with source prefix (e.g., "linkedevents_123")
 * @property {string} source - Data source: "linkedevents", "myhelsinki", "eventbrite", "meetup"
 * @property {string} title - Event title
 * @property {string} description - Event description (optional)
 * @property {string} startTime - ISO 8601 datetime
 * @property {string|null} endTime - ISO 8601 datetime (null if unknown)
 * @property {number} lat - Latitude
 * @property {number} lng - Longitude
 * @property {string} venueName - Venue name
 * @property {string} city - City name
 * @property {string} category - Normalized category: music, food, sports, family, arts, tech, nightlife, other
 * @property {string} priceType - "free" or "paid"
 * @property {string|null} url - Event info/registration URL
 * @property {string|null} imageUrl - Event image URL
 * @property {boolean} isLiveNow - Computed: true if currently happening
 * @property {number} score - Computed: ranking score based on distance, live status, etc.
 */

// ==================== HELPER FUNCTIONS ====================

/**
 * Normalize category from keywords/tags
 */
function normalizeCategory(keywords) {
  const text = keywords.join(" ").toLowerCase();
  
  if (/(music|musiikki|concert|konsertti|band|dj|live music)/.test(text)) return "music";
  if (/(food|ruoka|restaurant|ravintola|street food|culinary|cooking)/.test(text)) return "food";
  if (/(sport|urheilu|game|ottelu|marathon|juoksu|fitness|yoga)/.test(text)) return "sports";
  if (/(family|perhe|kids|lapset|children|child)/.test(text)) return "family";
  if (/(art|taide|museum|gallery|exhibition|näyttely|performance)/.test(text)) return "arts";
  if (/(tech|technology|startup|coding|programming|meetup|hackathon)/.test(text)) return "tech";
  if (/(night|club|party|dance|nightlife|yö)/.test(text)) return "nightlife";
  
  return "other";
}

/**
 * Calculate if event is currently live
 */
function isLiveNow(event) {
  const now = Date.now();
  const start = new Date(event.startTime).getTime();
  
  if (event.endTime) {
    const end = new Date(event.endTime).getTime();
    return now >= start && now <= end;
  }
  
  // If no end time, assume 2-hour duration
  const assumedEnd = start + (2 * 60 * 60 * 1000);
  return now >= start && now <= assumedEnd;
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Score an event based on multiple factors
 */
function scoreEvent(event, userLat, userLng, now) {
  let score = 1000; // Base score
  
  // Distance penalty (closer is better)
  if (userLat && userLng) {
    const distance = calculateDistance(userLat, userLng, event.lat, event.lng);
    score -= distance * 10; // -10 points per km
  }
  
  // Live now bonus (huge boost)
  if (event.isLiveNow) {
    score += 500;
  }
  
  // Starting soon bonus
  const startTime = new Date(event.startTime).getTime();
  const hoursUntilStart = (startTime - now) / (60 * 60 * 1000);
  
  if (hoursUntilStart > 0 && hoursUntilStart <= 2) {
    score += 200; // Starting within 2 hours
  } else if (hoursUntilStart > 2 && hoursUntilStart <= 6) {
    score += 100; // Starting within 6 hours
  } else if (hoursUntilStart > 6 && hoursUntilStart <= 24) {
    score += 50; // Starting within 24 hours
  }
  
  // Free event bonus
  if (event.priceType === "free") {
    score += 50;
  }
  
  // Has image bonus (better quality listing)
  if (event.imageUrl) {
    score += 25;
  }
  
  // Has URL bonus
  if (event.url) {
    score += 10;
  }
  
  return Math.max(0, score);
}

/**
 * Deduplicate events that appear in multiple sources
 */
function dedupeEvents(events) {
  const seen = new Map();
  
  for (const event of events) {
    // Create a fuzzy key: normalize title + venue + start time (to nearest hour)
    const normalizedTitle = event.title.toLowerCase().trim().replace(/[^\w\s]/g, '');
    const startHour = new Date(event.startTime).toISOString().slice(0, 13); // YYYY-MM-DDTHH
    const key = `${normalizedTitle}_${event.venueName.toLowerCase()}_${startHour}`;
    
    if (!seen.has(key)) {
      seen.set(key, event);
    } else {
      // Keep the "better" event (prefer one with more data)
      const existing = seen.get(key);
      const existingQuality = 
        (existing.url ? 10 : 0) + 
        (existing.imageUrl ? 20 : 0) + 
        (existing.description ? 5 : 0) +
        (existing.endTime ? 5 : 0);
      const newQuality = 
        (event.url ? 10 : 0) + 
        (event.imageUrl ? 20 : 0) + 
        (event.description ? 5 : 0) +
        (event.endTime ? 5 : 0);
      
      if (newQuality > existingQuality) {
        seen.set(key, event);
      }
    }
  }
  
  return Array.from(seen.values());
}

// ==================== DATA SOURCE ADAPTERS ====================

/**
 * Fetch events from Helsinki LinkedEvents API
 */
async function fetchLinkedEvents(bounds) {
  try {
    const now = new Date().toISOString().split('T')[0];
    const url = `https://api.hel.fi/linkedevents/v1/event/?page_size=500&start=${now}&include=location&sort=start_time`;
    
    const response = await fetch(url, { 
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000) // 10s timeout
    });
    
    if (!response.ok) return [];
    
    const data = await response.json();
    const events = [];
    
    for (const item of data.data || []) {
      // Must have location with coordinates
      if (!item.location?.position?.coordinates) continue;
      
      const [lng, lat] = item.location.position.coordinates;
      
      // Skip online/virtual events (check venue name and description)
      const venueName = (item.location?.name?.fi || item.location?.name?.en || "").toLowerCase();
      const description = (item.description?.fi || item.description?.en || "").toLowerCase();
      const title = (item.name?.fi || item.name?.en || item.name?.sv || "").toLowerCase();
      
      if (
        venueName.includes("internet") ||
        venueName.includes("online") ||
        venueName.includes("verkko") ||
        venueName.includes("video") ||
        venueName.includes("zoom") ||
        venueName.includes("stream") ||
        venueName.includes("etä") || // remote in Finnish
        description.includes("online-tapahtuma") ||
        description.includes("online event") ||
        description.includes("virtual event") ||
        description.includes("etätapahtuma") ||
        description.includes("zoom") ||
        description.includes("streamattava") ||
        description.includes("streamattava") ||
        title.includes("online") ||
        title.includes("verkossa") ||
        title.includes("zoom") ||
        title.includes("stream")
      ) {
        continue;
      }
      
      // Skip events for seniors/retirees
      if (
        title.includes("eläkeläis") ||
        title.includes("eläkeläin") ||
        title.includes("seniorei") ||
        title.includes("ikäihmis") ||
        title.includes("senior") ||
        description.includes("eläkeläis") ||
        description.includes("eläkeläin") ||
        description.includes("seniorei") ||
        description.includes("ikäihmis") ||
        venueName.includes("eläkeläis") ||
        venueName.includes("seniorei")
      ) {
        continue;
      }
      
      // Filter by bounds if provided
      if (bounds) {
        const [minLng, minLat, maxLng, maxLat] = bounds;
        if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) continue;
      }
      
      const eventTitle = item.name?.fi || item.name?.en || item.name?.sv || "Event";
      const eventDescription = item.description?.fi || item.description?.en || "";
      const keywords = (item.keywords || []).map(k => k.name?.fi || k.name?.en || "");
      const offers = item.offers || [];
      const priceType = offers.some(o => o.is_free) ? "free" : "paid";
      
      events.push({
        id: `linkedevents_${item.id}`,
        source: "linkedevents",
        title: eventTitle,
        description: eventDescription,
        startTime: item.start_time,
        endTime: item.end_time || null,
        lat,
        lng,
        venueName: item.location?.name?.fi || item.location?.name?.en || "Unknown Venue",
        city: "Helsinki",
        category: normalizeCategory(keywords),
        priceType,
        url: item.info_url?.fi || item.info_url?.en || offers[0]?.url || null,
        imageUrl: item.images?.[0]?.url || null,
        isLiveNow: false, // Will be computed later
        score: 0 // Will be computed later
      });
    }
    
    return events;
  } catch (error) {
    console.error("LinkedEvents fetch error:", error);
    return [];
  }
}

/**
 * Fetch events from MyHelsinki API (fallback/supplementary)
 */
async function fetchMyHelsinkiEvents(bounds) {
  try {
    const url = "https://open-api.myhelsinki.fi/v2/events/?limit=500";
    
    const response = await fetch(url, { 
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) return [];
    
    const data = await response.json();
    const events = [];
    
    for (const item of data.data || []) {
      const loc = item.location || {};
      if (!loc.lat || !loc.lon) continue;
      
      // Skip online/virtual events
      const venueName = (loc.address?.street_address || "").toLowerCase();
      const description = (item.description?.fi || item.description?.en || "").toLowerCase();
      const title = (item.name?.fi || item.name?.en || "").toLowerCase();
      
      if (
        venueName.includes("internet") ||
        venueName.includes("online") ||
        venueName.includes("verkko") ||
        venueName.includes("video") ||
        venueName.includes("zoom") ||
        venueName.includes("stream") ||
        venueName.includes("etä") || // remote in Finnish
        description.includes("online-tapahtuma") ||
        description.includes("online event") ||
        description.includes("virtual event") ||
        description.includes("etätapahtuma") ||
        description.includes("zoom") ||
        description.includes("streamattava") ||
        title.includes("online") ||
        title.includes("verkossa") ||
        title.includes("zoom") ||
        title.includes("stream")
      ) {
        continue;
      }
      
      // Skip events for seniors/retirees
      if (
        title.includes("eläkeläis") ||
        title.includes("eläkeläin") ||
        title.includes("seniorei") ||
        title.includes("ikäihmis") ||
        title.includes("senior") ||
        description.includes("eläkeläis") ||
        description.includes("eläkeläin") ||
        description.includes("seniorei") ||
        description.includes("ikäihmis") ||
        venueName.includes("eläkeläis") ||
        venueName.includes("seniorei")
      ) {
        continue;
      }
      
      // Filter by bounds if provided
      if (bounds) {
        const [minLng, minLat, maxLng, maxLat] = bounds;
        if (loc.lon < minLng || loc.lon > maxLng || loc.lat < minLat || loc.lat > maxLat) continue;
      }
      
      const eventTitle = item.name?.fi || item.name?.en || "Event";
      const eventDescription = item.description?.fi || item.description?.en || "";
      const tags = (item.tags || []).map(t => t.name || "");
      const offers = item.offers || [];
      const priceType = offers.some(o => o.is_free) ? "free" : "paid";
      const startDay = item.event_dates?.starting_day;
      
      // Skip if no start date
      if (!startDay) continue;
      
      events.push({
        id: `myhelsinki_${item.id}`,
        source: "myhelsinki",
        title: eventTitle,
        description: eventDescription,
        startTime: `${startDay}T00:00:00Z`, // MyHelsinki only provides date, not time
        endTime: item.event_dates?.ending_day ? `${item.event_dates.ending_day}T23:59:59Z` : null,
        lat: loc.lat,
        lng: loc.lon,
        venueName: loc.address?.street_address || "Unknown Venue",
        city: loc.address?.locality || "Helsinki",
        category: normalizeCategory(tags),
        priceType,
        url: item.info_url || offers[0]?.url || null,
        imageUrl: item.description?.images?.[0]?.url || null,
        isLiveNow: false,
        score: 0
      });
    }
    
    return events;
  } catch (error) {
    console.error("MyHelsinki fetch error:", error);
    return [];
  }
}

/**
 * Fetch events from Eventbrite API
 * Requires EVENTBRITE_API_KEY environment variable
 */
async function fetchEventbriteEvents(bounds) {
  const apiKey = process.env.EVENTBRITE_API_KEY;
  if (!apiKey) {
    console.log("Eventbrite API key not configured, skipping");
    return [];
  }
  
  try {
    // Default to Helsinki coordinates if no bounds provided
    const centerLat = bounds ? (bounds[1] + bounds[3]) / 2 : 60.1699;
    const centerLng = bounds ? (bounds[0] + bounds[2]) / 2 : 24.9384;
    
    const now = new Date().toISOString();
    const url = new URL("https://www.eventbriteapi.com/v3/events/search/");
    url.searchParams.append("location.latitude", centerLat);
    url.searchParams.append("location.longitude", centerLng);
    url.searchParams.append("location.within", "25km");
    url.searchParams.append("start_date.range_start", now);
    url.searchParams.append("expand", "venue,category");
    url.searchParams.append("page_size", "200");
    
    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) return [];
    
    const data = await response.json();
    const events = [];
    
    for (const item of data.events || []) {
      if (!item.venue?.latitude || !item.venue?.longitude) continue;
      
      const lat = parseFloat(item.venue.latitude);
      const lng = parseFloat(item.venue.longitude);
      
      // Filter by bounds if provided
      if (bounds) {
        const [minLng, minLat, maxLng, maxLat] = bounds;
        if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) continue;
      }
      
      events.push({
        id: `eventbrite_${item.id}`,
        source: "eventbrite",
        title: item.name?.text || "Event",
        description: item.description?.text || "",
        startTime: item.start?.local || item.start?.utc,
        endTime: item.end?.local || item.end?.utc || null,
        lat,
        lng,
        venueName: item.venue?.name || "Unknown Venue",
        city: item.venue?.address?.city || "Helsinki",
        category: item.category?.name ? normalizeCategory([item.category.name]) : "other",
        priceType: item.is_free ? "free" : "paid",
        url: item.url || null,
        imageUrl: item.logo?.url || null,
        isLiveNow: false,
        score: 0
      });
    }
    
    return events;
  } catch (error) {
    console.error("Eventbrite fetch error:", error);
    return [];
  }
}

/**
 * Fetch events from Meetup API
 * Requires MEETUP_API_KEY environment variable
 */
async function fetchMeetupEvents(bounds) {
  const apiKey = process.env.MEETUP_API_KEY;
  if (!apiKey) {
    console.log("Meetup API key not configured, skipping");
    return [];
  }
  
  try {
    // Meetup GraphQL API endpoint
    const centerLat = bounds ? (bounds[1] + bounds[3]) / 2 : 60.1699;
    const centerLng = bounds ? (bounds[0] + bounds[2]) / 2 : 24.9384;
    
    const query = `
      query($lat: Float!, $lon: Float!, $radius: Int!) {
        rankedEvents(input: {lat: $lat, lon: $lon, radius: $radius, first: 200}) {
          edges {
            node {
              id
              title
              description
              dateTime
              endTime
              eventUrl
              images {
                baseUrl
              }
              venue {
                name
                lat
                lng
                city
              }
              isFree: going {
                totalCount
              }
            }
          }
        }
      }
    `;
    
    const response = await fetch("https://api.meetup.com/gql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        query,
        variables: { lat: centerLat, lon: centerLng, radius: 25 }
      }),
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) return [];
    
    const data = await response.json();
    const events = [];
    
    for (const edge of data.data?.rankedEvents?.edges || []) {
      const item = edge.node;
      if (!item.venue?.lat || !item.venue?.lng) continue;
      
      const lat = item.venue.lat;
      const lng = item.venue.lng;
      
      // Filter by bounds if provided
      if (bounds) {
        const [minLng, minLat, maxLng, maxLat] = bounds;
        if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) continue;
      }
      
      events.push({
        id: `meetup_${item.id}`,
        source: "meetup",
        title: item.title || "Meetup",
        description: item.description || "",
        startTime: item.dateTime,
        endTime: item.endTime || null,
        lat,
        lng,
        venueName: item.venue.name || "Unknown Venue",
        city: item.venue.city || "Helsinki",
        category: "tech", // Meetup events are typically tech/networking
        priceType: "free", // Most meetups are free
        url: item.eventUrl || null,
        imageUrl: item.images?.[0]?.baseUrl || null,
        isLiveNow: false,
        score: 0
      });
    }
    
    return events;
  } catch (error) {
    console.error("Meetup fetch error:", error);
    return [];
  }
}

// ==================== MAIN HANDLER ====================

export default async function handler(req, res) {
  try {
    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    if (req.method === "OPTIONS") return res.status(204).end();

    const now = Date.now();
    const isFresh = CACHE.json && now - CACHE.at < TTL_MS;

    // Parse query parameters
    const url = new URL(req.url, "https://dummy.local");
    const lat = parseFloat(url.searchParams.get("lat") || "60.1699"); // Helsinki center
    const lng = parseFloat(url.searchParams.get("lng") || "24.9384");
    const radiusKm = Math.max(1, Math.min(50, parseFloat(url.searchParams.get("radiusKm") || "5")));
    const limit = Math.max(1, Math.min(1000, Number(url.searchParams.get("limit")) || 200));
    const q = (url.searchParams.get("q") || "").toLowerCase();
    const category = url.searchParams.get("category");
    const freeOnly = url.searchParams.get("freeOnly") === "true";
    const liveOnly = url.searchParams.get("liveOnly") === "true";
    
    // Legacy bbox support (convert to bounds array)
    const bboxParam = url.searchParams.get("bbox");
    const bounds = bboxParam ? bboxParam.split(",").map(Number) : null;
    const hasBBox = bounds && bounds.length === 4 && bounds.every(n => Number.isFinite(n));

    let payload;
    
    // Fast path: in-memory cache (90s micro-TTL)
    if (isFresh) {
      payload = CACHE.json;
    } else {
      // Try Vercel KV cache (5m TTL)
      let kvPayload = null;
      try {
        if (process.env.KV_REST_API_URL) {
          kvPayload = await kv.get(KV_KEY);
        }
      } catch (e) {
        // KV not available or failed, continue to fetch
      }

      if (kvPayload && kvPayload.updatedAt) {
        // KV hit - use cached data
        payload = kvPayload;
        CACHE = { at: now, json: payload };
      } else {
        // KV miss or unavailable - fetch from all sources in parallel
        console.log("Fetching from all event sources...");
        
        const fetchBounds = hasBBox ? bounds : null;
        
        const [linkedEvents, myHelsinkiEvents] = await Promise.all([
          fetchLinkedEvents(fetchBounds),
          fetchMyHelsinkiEvents(fetchBounds)
        ]);
        
        console.log(`Fetched: LinkedEvents=${linkedEvents.length}, MyHelsinki=${myHelsinkiEvents.length}`);
        
        // Merge all events
        let allEvents = [...linkedEvents, ...myHelsinkiEvents];
        
        // Deduplicate events
        allEvents = dedupeEvents(allEvents);
        console.log(`After deduplication: ${allEvents.length} events`);
        
        // Compute isLiveNow and score for each event
        for (const event of allEvents) {
          event.isLiveNow = isLiveNow(event);
          event.score = scoreEvent(event, lat, lng, now);
        }
        
        payload = { 
          updatedAt: new Date().toISOString(), 
          count: allEvents.length, 
          data: allEvents 
        };
        
        CACHE = { at: now, json: payload };
        
        // Store in KV with 5m TTL (fire and forget)
        try {
          if (process.env.KV_REST_API_URL) {
            kv.set(KV_KEY, payload, { ex: KV_TTL_SEC }).catch(() => {});
          }
        } catch (e) {
          // Silently ignore KV errors
        }
      }
    }

    // Apply filters
    let out = payload.data;
    
    if (q) {
      out = out.filter(e => 
        e.title.toLowerCase().includes(q) || 
        e.description.toLowerCase().includes(q) ||
        e.venueName.toLowerCase().includes(q)
      );
    }
    
    if (category) {
      out = out.filter(e => e.category === category);
    }
    
    if (freeOnly) {
      out = out.filter(e => e.priceType === "free");
    }
    
    if (liveOnly) {
      out = out.filter(e => e.isLiveNow);
    }
    
    // Distance filter (if not using bbox)
    if (!hasBBox && radiusKm < 50) {
      out = out.filter(e => {
        const distance = calculateDistance(lat, lng, e.lat, e.lng);
        return distance <= radiusKm;
      });
    }
    
    // Sort by score (descending) and limit
    out = out.sort((a, b) => b.score - a.score).slice(0, limit);

    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
    return res.status(200).json({ 
      updatedAt: payload.updatedAt, 
      count: out.length, 
      data: out 
    });
  } catch (err) {
    console.error("Handler error:", err);
    return res
      .status(500)
      .json({ error: "events-lite failed", message: err?.message || String(err) });
  }
}
