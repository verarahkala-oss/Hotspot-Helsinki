/**
 * Google Places API Proxy
 * Server-side endpoint to protect API key
 */

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (!GOOGLE_API_KEY) {
    return res.status(500).json({ error: "Google Places API key not configured" });
  }

  const { action, placeId, query, lat, lng, radius, type } = req.query;

  try {
    switch (action) {
      case "details":
        return handlePlaceDetails(req, res, placeId);
      
      case "search":
        return handleSearch(req, res, query, lat, lng);
      
      case "nearby":
        return handleNearby(req, res, lat, lng, radius, type);
      
      case "photo":
        return handlePhoto(req, res, req.query.photoReference, req.query.maxWidth);
      
      default:
        return res.status(400).json({ error: "Invalid action. Use: details, search, nearby, or photo" });
    }
  } catch (error) {
    console.error("Google Places API error:", error);
    return res.status(500).json({ error: error.message || "Failed to fetch from Google Places API" });
  }
}

async function handlePlaceDetails(req, res, placeId) {
  if (!placeId) {
    return res.status(400).json({ error: "placeId is required" });
  }

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

  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${GOOGLE_API_KEY}`;
  
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

  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=100&keyword=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}`;
  
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

  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}&key=${GOOGLE_API_KEY}`;
  
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

  const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${GOOGLE_API_KEY}`;
  
  // Redirect to the photo URL
  return res.redirect(307, url);
}
