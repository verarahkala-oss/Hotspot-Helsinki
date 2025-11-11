import { useState, useEffect } from "react";
import { API_BASE_URL } from "./constants";

interface EventData {
  updatedAt: string;
  count: number;
  data: any[];
  error?: string;
}

interface UseEventsResult {
  data: any[] | null;
  loading: boolean;
  error: string | null;
}

export function useEvents(): UseEventsResult {
  const [data, setData] = useState<any[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const res = await fetch(`${API_BASE_URL}?limit=400`);
        
        if (!res.ok) {
          throw new Error("HTTP " + res.status);
        }
        
        const json: EventData = await res.json();
        
        // Check if there's an error in the response
        if (json.error) {
          throw new Error(json.error);
        }
        
        // Extract the data array from the response
        setData(json.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch events");
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  return { data, loading, error };
}
