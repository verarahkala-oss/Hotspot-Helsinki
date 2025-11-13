/**
 * Google Places API Proxy
 * Server-side endpoint to protect API key
 */

import { createRateLimiter, addRateLimitHeaders } from './_lib/rateLimiter.js';
import {
  validateLatitude,
  validateLongitude,
  validatePlaceId,
  validateString,
  validatePhotoReference,
  validateNumber,
  validateAction
} from './_lib/validation.js';

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

// Rate limiter: 100 requests per 15 minutes per IP
const rateLimiter = createRateLimiter({ maxRequests: 100, windowMs: 15 * 60 * 1000 });

// Allowed origins for CORS (add your production domain)
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'https://hotspot-helsinki.vercel.app',
  'https://helsinki-hotspots.vercel.app',
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null
].filter(Boolean);

export default async function handler(req, res) {
  // CORS with origin validation
  const origin = req.headers.origin || req.headers.referer;
  const isAllowedOrigin = ALLOWED_ORIGINS.some(allowed => 
    origin && origin.startsWith(allowed)
  );
  
  if (isAllowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  
  if (req.method === "OPTIONS") return res.status(204).end();
  
  // Rate limiting
  const limitResult = rateLimiter(req);
  addRateLimitHeaders(res, limitResult);
  
  if (!limitResult.allowed) {
    return res.status(429).json({ 
      error: "Too many requests",
      retryAfter: limitResult.resetTime
    });
  }

  if (!GOOGLE_API_KEY) {
    return res.status(500).json({ error: "Google Places API key not configured" });
  }

  // Input validation
  try {
    const action = req.query.action;
    validateAction(action, ['details', 'search', 'nearby', 'photo']);
    
    const { placeId, query, lat, lng, radius, type, photoReference, maxWidth } = req.query;

    switch (action) {
      case "details":
        return await handlePlaceDetails(req, res, placeId);
      
      case "search":
        return await handleSearch(req, res, query, lat, lng);
      
      case "nearby":
        return await handleNearby(req, res, lat, lng, radius, type);
      
      case "photo":
        return await handlePhoto(req, res, photoReference, maxWidth);
      
      default:
        return res.status(400).json({ error: "Invalid action. Use: details, search, nearby, or photo" });
    }
  } catch (error) {
    console.error("Google Places API error:", error);
    
    // Don't expose internal errors to clients
    if (error.message && error.message.includes('Invalid')) {
      return res.status(400).json({ error: error.message });
    }
    
    return res.status(500).json({ error: "Failed to fetch from Google Places API" });
  }
}

async function handlePlaceDetails(req, res, placeId) {
  if (!placeId) {
    return res.status(400).json({ error: "placeId is required" });
  }
  
  // Validate place ID format
  const validPlaceId = validatePlaceId(placeId);

  const fields = [
    "place_id",
    "name",
    "rating",
    "user_ratings_total",
    "formatted_address",
    "formatted_phone_number",
    "website",
    "opening_hours",
    "photos",
    "price_level",
    "types",
    "geometry"
  ].join(",");

  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${validPlaceId}&fields=${fields}&key=${GOOGLE_API_KEY}`;
  
  const response = await fetch(url);
  const data = await response.json();

  if (data.status !== "OK") {
    return res.status(404).json({ error: data.status, message: data.error_message });
  }

  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=7200");
  return res.status(200).json(data.result);
}

async function handleSearch(req, res, query, lat, lng) {
  if (!query || !lat || !lng) {
    return res.status(400).json({ error: "query, lat, and lng are required" });
  }
  
  // Validate inputs
  const validQuery = validateString(query, 200);
  const validLat = validateLatitude(lat);
  const validLng = validateLongitude(lng);

  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${validLat},${validLng}&radius=100&keyword=${encodeURIComponent(validQuery)}&key=${GOOGLE_API_KEY}`;
  
  const response = await fetch(url);
  const data = await response.json();

  if (data.status !== "OK" || !data.results || data.results.length === 0) {
    return res.status(404).json({ error: "No places found" });
  }

  // Return the place_id of the best match, then client can fetch details
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=7200");
  return res.status(200).json({ placeId: data.results[0].place_id });
}

async function handleNearby(req, res, lat, lng, radius = 500, type = "restaurant") {
  if (!lat || !lng) {
    return res.status(400).json({ error: "lat and lng are required" });
  }
  
  // Validate inputs
  const validLat = validateLatitude(lat);
  const validLng = validateLongitude(lng);
  const validRadius = validateNumber(radius, 1, 50000); // Max 50km
  const validType = validateString(type, 50);

  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${validLat},${validLng}&radius=${validRadius}&type=${encodeURIComponent(validType)}&key=${GOOGLE_API_KEY}`;
  
  const response = await fetch(url);
  const data = await response.json();

  if (data.status !== "OK") {
    return res.status(404).json({ error: data.status, results: [] });
  }

  // Return top 10 results
  const results = data.results.slice(0, 10).map(place => ({
    placeId: place.place_id,
    name: place.name,
    vicinity: place.vicinity,
    rating: place.rating,
    priceLevel: place.price_level,
    types: place.types || [],
    geometry: place.geometry,
    photoReference: place.photos?.[0]?.photo_reference,
    openNow: place.opening_hours?.open_now
  }));

  res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=3600");
  return res.status(200).json({ results });
}

async function handlePhoto(req, res, photoReference, maxWidth = 400) {
  if (!photoReference) {
    return res.status(400).json({ error: "photoReference is required" });
  }
  
  // Validate inputs
  const validPhotoRef = validatePhotoReference(photoReference);
  const validMaxWidth = validateNumber(maxWidth, 1, 1600); // Google max is 1600

  const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${validMaxWidth}&photo_reference=${validPhotoRef}&key=${GOOGLE_API_KEY}`;
  
  // Redirect to the photo URL
  return res.redirect(307, url);
}
