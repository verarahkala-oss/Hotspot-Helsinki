export interface LinkedEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  lat: number;
  lng: number;
  category: string;
  website?: string;
  price: "free" | "paid";
  time?: string;
}

interface LinkedEventsResponse {
  meta: {
    count: number;
    next: string | null;
  };
  data: Array<{
    id: string;
    name: {
      fi?: string;
      en?: string;
      sv?: string;
    };
    start_time: string;
    end_time: string | null;
    location?: {
      position?: {
        type: string;
        coordinates: [number, number];
      };
      name?: {
        fi?: string;
        en?: string;
        sv?: string;
      };
    };
    info_url?: {
      fi?: string;
      en?: string;
      sv?: string;
    };
    offers?: Array<{
      is_free?: boolean;
      price?: {
        fi?: string;
        en?: string;
      };
    }>;
    keywords?: Array<{
      name?: {
        fi?: string;
        en?: string;
      };
    }>;
  }>;
}

const CACHE_KEY = 'helsinki_events_cache';
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

interface CachedData {
  events: LinkedEvent[];
  timestamp: number;
}

/**
 * Fetch live events from Helsinki LinkedEvents API
 * Automatically caches results for 10 minutes
 */
export async function fetchEvents(): Promise<LinkedEvent[]> {
  // Check cache first
  const cached = getFromCache();
  if (cached) {
    console.log('Using cached events:', cached.length);
    return cached;
  }

  try {
    // Fetch upcoming events (max 200) with location data
    const now = new Date().toISOString().split('T')[0];
    const url = `https://api.hel.fi/linkedevents/v1/event/?page_size=200&start=${now}&include=location&sort=start_time`;
    
    console.log('Fetching events from LinkedEvents API...', url);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`LinkedEvents API error: ${response.status}`);
    }

    const data: LinkedEventsResponse = await response.json();
    
    const currentTime = Date.now();
    
    // Transform and filter events
    const events: LinkedEvent[] = data.data
      .filter(event => {
        // Must have coordinates
        if (!event.location?.position?.coordinates) return false;
        
        // Must have a name
        if (!event.name?.fi && !event.name?.en) return false;
        
        // Must have start time
        if (!event.start_time) return false;
        
        // Filter out past events (if event has end time, check if it's in the future)
        if (event.end_time) {
          const endTime = new Date(event.end_time).getTime();
          if (endTime < currentTime) {
            return false; // Event has ended
          }
        }
        
        return true;
      })
      .map(event => {
        const [lon, lat] = event.location!.position!.coordinates;
        
        // Get name in preferred language
        const title = event.name.fi || event.name.en || event.name.sv || 'Untitled Event';
        
        // Get URL in preferred language
        const website = event.info_url?.fi || event.info_url?.en || event.info_url?.sv;
        
        // Determine price
        const isFree = event.offers?.[0]?.is_free;
        const price: "free" | "paid" = isFree ? "free" : "paid";
        
        // Get category from first keyword (or use a generic label)
        const category = event.keywords?.[0]?.name?.en || 
                        event.keywords?.[0]?.name?.fi || 
                        event.location?.name?.fi ||
                        event.location?.name?.en ||
                        'Event';
        
        console.log('Event category:', category); // Debug: see what categories we're getting
        
        // Format time display as duration (start - end time only)
        const startDate = new Date(event.start_time);
        const startTime = startDate.toLocaleString('fi-FI', {
          timeZone: 'Europe/Helsinki',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        let time = startTime;
        if (event.end_time) {
          const endDate = new Date(event.end_time);
          const endTime = endDate.toLocaleString('fi-FI', {
            timeZone: 'Europe/Helsinki',
            hour: '2-digit',
            minute: '2-digit'
          });
          time = `${startTime} - ${endTime}`;
        }

        return {
          id: event.id,
          title,
          start: event.start_time,
          end: event.end_time || undefined,
          lat,
          lng: lon,
          category,
          website,
          price,
          time
        };
      });

    console.log(`Fetched ${events.length} events from LinkedEvents API`);
    
    // Cache the results
    saveToCache(events);
    
    return events;
  } catch (error) {
    console.error('Failed to fetch events from LinkedEvents API:', error);
    throw error;
  }
}

function getFromCache(): LinkedEvent[] | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const data: CachedData = JSON.parse(cached);
    const age = Date.now() - data.timestamp;

    if (age > CACHE_DURATION) {
      console.log('Cache expired');
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return data.events;
  } catch (error) {
    console.error('Cache read error:', error);
    return null;
  }
}

function saveToCache(events: LinkedEvent[]): void {
  try {
    const data: CachedData = {
      events,
      timestamp: Date.now()
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Cache write error:', error);
  }
}
