import { useState, useEffect } from 'react';
import {
  getCachedPlaceDetails,
  findNearbyPlaces,
  PlaceDetails,
  NearbyPlace,
} from '../utils/googlePlaces';

/**
 * Hook to fetch venue details from Google Places
 */
export function useVenueDetails(venueName: string, lat: number, lng: number) {
  const [details, setDetails] = useState<PlaceDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!venueName || !lat || !lng) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    getCachedPlaceDetails(venueName, lat, lng)
      .then((data) => {
        if (!cancelled) {
          setDetails(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Failed to fetch venue details');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [venueName, lat, lng]);

  return { details, loading, error };
}

/**
 * Hook to fetch nearby places
 */
export function useNearbyPlaces(
  lat: number,
  lng: number,
  radius: number = 500,
  type: string = 'restaurant'
) {
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!lat || !lng) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    findNearbyPlaces(lat, lng, radius, type)
      .then((data) => {
        if (!cancelled) {
          setPlaces(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Failed to fetch nearby places');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [lat, lng, radius, type]);

  return { places, loading, error };
}
