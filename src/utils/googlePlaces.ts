/**
 * Google Places API Integration (via proxy)
 * Provides venue details, photos, ratings, and nearby places
 */

const API_BASE = "/api/google-places";

export interface PlaceDetails {
  place_id: string;
  name: string;
  rating?: number;
  user_ratings_total?: number;
  formatted_address?: string;
  formatted_phone_number?: string;
  website?: string;
  opening_hours?: {
    open_now?: boolean;
    weekday_text?: string[];
    periods?: Array<{
      open: { day: number; time: string };
      close: { day: number; time: string };
    }>;
  };
  photos?: Array<{
    photo_reference: string;
    height: number;
    width: number;
  }>;
  price_level?: number;
  types?: string[];
  geometry?: {
    location: {
      lat: number;
      lng: number;
    };
  };
}

export interface NearbyPlace {
  placeId: string;
  name: string;
  vicinity: string;
  rating?: number;
  priceLevel?: number;
  types: string[];
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  photoReference?: string;
  openNow?: boolean;
}

/**
 * Search for a place by name and coordinates, then get its details
 */
export async function searchPlace(
  name: string,
  lat: number,
  lng: number
): Promise<PlaceDetails | null> {
  try {
    // First, search for the place to get its place_id
    const searchUrl = `${API_BASE}?action=search&query=${encodeURIComponent(name)}&lat=${lat}&lng=${lng}`;
    const searchResponse = await fetch(searchUrl);
    
    if (!searchResponse.ok) {
      return null;
    }
    
    const searchData = await searchResponse.json();
    
    if (!searchData.placeId) {
      return null;
    }
    
    // Then get the full details
    return getPlaceDetails(searchData.placeId);
  } catch (error) {
    console.error("Error searching place:", error);
    return null;
  }
}

/**
 * Get detailed information about a place by Place ID
 */
export async function getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  try {
    const url = `${API_BASE}?action=details&placeId=${placeId}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching place details:", error);
    return null;
  }
}

/**
 * Find nearby places (restaurants, cafes, attractions) around a location
 */
export async function findNearbyPlaces(
  lat: number,
  lng: number,
  radius: number = 500,
  type: string = "restaurant"
): Promise<NearbyPlace[]> {
  try {
    const url = `${API_BASE}?action=nearby&lat=${lat}&lng=${lng}&radius=${radius}&type=${type}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error("Error finding nearby places:", error);
    return [];
  }
}

/**
 * Get photo URL from photo reference
 */
export function getPhotoUrl(
  photoReference: string,
  maxWidth: number = 400
): string {
  return `${API_BASE}?action=photo&photoReference=${photoReference}&maxWidth=${maxWidth}`;
}

/**
 * Get current opening status text
 */
export function getOpeningStatus(openingHours?: PlaceDetails["opening_hours"]): string {
  if (!openingHours) return "";
  
  if (openingHours.open_now === undefined) return "";
  
  return openingHours.open_now ? "🟢 Open now" : "🔴 Closed";
}

/**
 * Get today's opening hours
 */
export function getTodayHours(openingHours?: PlaceDetails["opening_hours"]): string {
  if (!openingHours?.weekday_text) return "";
  
  const today = new Date().getDay();
  // Google API weekday_text is ordered Monday-Sunday, but getDay() returns 0-6 (Sunday-Saturday)
  const dayIndex = today === 0 ? 6 : today - 1;
  
  return openingHours.weekday_text[dayIndex] || "";
}

/**
 * Format rating display
 */
export function formatRating(rating?: number, totalRatings?: number): string {
  if (!rating) return "";
  
  const stars = "⭐".repeat(Math.round(rating));
  const count = totalRatings ? ` (${totalRatings.toLocaleString()})` : "";
  
  return `${rating.toFixed(1)} ${stars}${count}`;
}

/**
 * Format price level
 */
export function formatPriceLevel(priceLevel?: number): string {
  if (priceLevel === undefined || priceLevel === 0) return "";
  
  return "€".repeat(priceLevel);
}

/**
 * Cache for place details to avoid repeated API calls
 */
const placeCache = new Map<string, { data: PlaceDetails; timestamp: number }>();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

export async function getCachedPlaceDetails(
  venueName: string,
  lat: number,
  lng: number
): Promise<PlaceDetails | null> {
  const cacheKey = `${venueName}_${lat.toFixed(4)}_${lng.toFixed(4)}`;
  
  // Check cache
  const cached = placeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  
  // Fetch new data
  const details = await searchPlace(venueName, lat, lng);
  
  if (details) {
    placeCache.set(cacheKey, { data: details, timestamp: Date.now() });
  }
  
  return details;
}
