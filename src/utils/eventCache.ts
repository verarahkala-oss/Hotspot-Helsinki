const CACHE_KEY = 'helsinki-hotspots-events';
const CACHE_TIMESTAMP_KEY = 'helsinki-hotspots-events-timestamp';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

export interface CachedEvents {
  events: any[];
  timestamp: number;
}

/**
 * Save events to localStorage with current timestamp
 */
export function cacheEvents(events: any[]): void {
  try {
    const cacheData: CachedEvents = {
      events,
      timestamp: Date.now()
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
  } catch (error) {
    console.warn('Failed to cache events:', error);
  }
}

/**
 * Retrieve cached events if they exist and are not expired
 * Returns null if cache is empty or expired
 */
export function getCachedEvents(): any[] | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const cacheData: CachedEvents = JSON.parse(cached);
    const now = Date.now();
    const age = now - cacheData.timestamp;

    // Return cached data even if expired (for offline fallback)
    // But indicate freshness for the caller to decide
    return cacheData.events;
  } catch (error) {
    console.warn('Failed to retrieve cached events:', error);
    return null;
  }
}

/**
 * Check if cached events are still fresh (within cache duration)
 */
export function isCacheFresh(): boolean {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return false;

    const cacheData: CachedEvents = JSON.parse(cached);
    const now = Date.now();
    const age = now - cacheData.timestamp;

    return age < CACHE_DURATION;
  } catch (error) {
    return false;
  }
}

/**
 * Clear cached events
 */
export function clearEventCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (error) {
    console.warn('Failed to clear event cache:', error);
  }
}
