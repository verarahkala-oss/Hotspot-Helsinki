import { useState, useEffect } from "react";
import { API_BASE_URL } from "./constants";
import { useDebounce } from "./hooks/useDebounce";
import { cacheEvents, getCachedEvents, isCacheFresh } from "./utils/eventCache";

interface EventData {
  updatedAt: string;
  count: number;
  data: any[];
  error?: string;
}

interface BBox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

interface UseEventsOptions {
  bbox?: BBox;
  category?: string;
  price?: string;
  q?: string;
}

interface UseEventsResult {
  data: any[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// Helsinki city center default bounds
const HELSINKI_DEFAULT_BBOX: BBox = {
  minLon: 24.85,
  minLat: 60.15,
  maxLon: 25.05,
  maxLat: 60.25,
};

export function useEvents(options: UseEventsOptions = {}): UseEventsResult {
  const [data, setData] = useState<any[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Debounce bbox changes to avoid too many requests while panning
  const debouncedBBox = useDebounce(options.bbox, 500);

  // Load cached events on mount
  useEffect(() => {
    const cached = getCachedEvents();
    if (cached && cached.length > 0) {
      setData(cached);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        // Only show loading spinner if we don't have cached data
        if (!data || data.length === 0) {
          setLoading(true);
        }
        setError(null);

        // Build query params
        const params = new URLSearchParams();
        params.set("limit", "400");

        // Add bbox if provided, otherwise use Helsinki default
        const bbox = debouncedBBox || HELSINKI_DEFAULT_BBOX;
        const bboxStr = `${bbox.minLon},${bbox.minLat},${bbox.maxLon},${bbox.maxLat}`;
        params.set("bbox", bboxStr);

        // Add optional filters
        if (options.category) params.set("category", options.category);
        if (options.price) params.set("price", options.price);
        if (options.q) params.set("q", options.q);

        const url = `${API_BASE_URL}?${params.toString()}`;
        const res = await fetch(url);
        
        if (!res.ok) {
          throw new Error("HTTP " + res.status);
        }
        
        const json: EventData = await res.json();
        
        // Check if there's an error in the response
        if (json.error) {
          throw new Error(json.error);
        }
        
        // Extract the data array from the response
        const events = json.data || [];
        setData(events);
        
        // Cache the successful response
        if (events.length > 0) {
          cacheEvents(events);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Failed to fetch events";
        setError(errorMsg);
        
        // Try to use cached data if fetch fails
        const cached = getCachedEvents();
        if (cached && cached.length > 0) {
          setData(cached);
          setError(errorMsg + " (showing cached data)");
        } else {
          setData(null);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [debouncedBBox, options.category, options.price, options.q, refreshTrigger]);

  const refetch = () => setRefreshTrigger(prev => prev + 1);

  return { data, loading, error, refetch };
}
