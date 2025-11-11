// Events proxy with Vercel KV caching (5m TTL) + in-memory micro-cache (90s)
import { kv } from "@vercel/kv";

const PRIMARY_SOURCE = "https://api.hel.fi/linkedevents/v1/event/?page_size=1000";
const FALLBACK_SOURCE = "https://open-api.myhelsinki.fi/v2/events/?limit=1000";

const KV_KEY = "events:myhelsinki:v2";
const KV_TTL_SEC = 300; // 5 minutes

let CACHE = { at: 0, json: null }; // in-memory micro-cache per running instance
const TTL_MS = 90 * 1000; // 90 seconds

function simplifyHelsinki(it) {
  // Simplify Helsinki Linked Events API format
  const title = it?.name?.fi || it?.name?.en || "Event";
  const loc = it?.location ?? {};
  const offers = it?.offers ?? [];
  const isFree = offers[0]?.is_free ? "free" : "paid";
  const start = it?.start_time ? new Date(it.start_time).toISOString().split('T')[0] : "";
  const website = it?.info_url?.fi || it?.info_url?.en || (offers[0]?.url ?? null);
  const keywords = (it?.keywords ?? []).map((k) => (k?.name?.fi || k?.name?.en || "").toLowerCase());
  const tagText = keywords.join(" ");
  let category = "other";
  if (/(music|musiikki)/.test(tagText)) category = "music";
  else if (/(food|ruoka|restaurant|ravintola|street food)/.test(tagText)) category = "food";
  else if (/(sport|urheilu|game|ottelu|marathon|juoksu)/.test(tagText)) category = "sports";
  else if (/(family|perhe|kids|lapset)/.test(tagText)) category = "family";

  // Extract coordinates from location URL if available
  let lat = null, lng = null;
  if (loc["@id"]) {
    // Location is a reference, coordinates would need separate API call
    // For now, we'll skip events without direct coordinates
  }

  return {
    id: "hel_" + it.id,
    title,
    time: start,
    lat,
    lng,
    category,
    price: isFree,
    website,
  };
}

function simplifyMyHelsinki(it) {
  // Original MyHelsinki format
  const title = it?.name?.fi || it?.name?.en || "Event";
  const loc = it?.location ?? {};
  const offers = it?.offers ?? [];
  const isFree = offers[0]?.is_free ? "free" : "paid";
  const start = it?.event_dates?.starting_day || "";
  const website = it?.info_url || (offers[0]?.url ?? null);
  const tags = (it?.tags ?? []).map((t) => (t?.name || "").toLowerCase());
  const tagText = tags.join(" ");
  let category = "other";
  if (/(music|musiikki)/.test(tagText)) category = "music";
  else if (/(food|ruoka|restaurant|ravintola|street food)/.test(tagText)) category = "food";
  else if (/(sport|urheilu|game|ottelu|marathon|juoksu)/.test(tagText)) category = "sports";
  else if (/(family|perhe|kids|lapset)/.test(tagText)) category = "family";

  return {
    id: "myh_" + it.id,
    title,
    time: start,
    lat: loc.lat,
    lng: loc.lon,
    category,
    price: isFree,
    website,
  };
}

export default async function handler(req, res) {
  try {
    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    if (req.method === "OPTIONS") return res.status(204).end();

    const now = Date.now();
    const isFresh = CACHE.json && now - CACHE.at < TTL_MS;

    const url = new URL(req.url, "https://dummy.local");
    const limit = Math.max(1, Math.min(1000, Number(url.searchParams.get("limit")) || 300));
    const q = (url.searchParams.get("q") || "").toLowerCase();
    const price = url.searchParams.get("price");
    const category = url.searchParams.get("category");

    let payload;
    
    // Fast path: in-memory cache (90s micro-TTL)
    if (isFresh) {
      payload = CACHE.json;
    } else {
      // Try Vercel KV cache (5m TTL)
      let kvPayload = null;
      try {
        // Check if KV is available (env vars present)
        if (process.env.KV_REST_API_URL) {
          kvPayload = await kv.get(KV_KEY);
        }
      } catch (e) {
        // KV not available or failed, continue to fetch
      }

      if (kvPayload && kvPayload.updatedAt) {
        // KV hit - use cached data
        payload = kvPayload;
        CACHE = { at: now, json: payload }; // Also populate in-memory cache
      } else {
        // KV miss or unavailable - fetch from upstream
        let all = [];
        
        // Try primary source (Helsinki Linked Events API)
        try {
          const r = await fetch(PRIMARY_SOURCE, { headers: { Accept: "application/json" } });
          if (r.ok) {
            const json = await r.json();
            all = (json?.data ?? [])
              .map(simplifyHelsinki)
              .filter((e) => e.title && e.title !== "Event");
          }
        } catch (e) {
          // Primary source failed, try fallback
        }
        
        // If primary failed or returned no results, try fallback
        if (all.length === 0) {
          try {
            const r = await fetch(FALLBACK_SOURCE, { headers: { Accept: "application/json" } });
            if (r.ok) {
              const json = await r.json();
              all = (json?.data ?? [])
                .map(simplifyMyHelsinki)
                .filter((e) => typeof e.lat === "number" && typeof e.lng === "number");
            }
          } catch (e) {
            // Both sources failed
          }
        }
        
        if (all.length === 0) {
          throw new Error("No events available from any source");
        }
        
        payload = { updatedAt: new Date().toISOString(), count: all.length, data: all };
        CACHE = { at: now, json: payload };
        
        // Store in KV with 5m TTL (fire and forget - don't block response)
        try {
          if (process.env.KV_REST_API_URL) {
            kv.set(KV_KEY, payload, { ex: KV_TTL_SEC }).catch(() => {
              // Silently ignore KV write errors
            });
          }
        } catch (e) {
          // KV not available, continue without it
        }
      }
    }

    let out = payload.data;
    if (q) out = out.filter((e) => e.title.toLowerCase().includes(q));
    if (price) out = out.filter((e) => e.price === price);
    if (category) out = out.filter((e) => e.category === category);
    out = out.slice(0, limit);

    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
    return res.status(200).json({ updatedAt: payload.updatedAt, count: out.length, data: out });
  } catch (err) {
    return res
      .status(500)
      .json({ error: "events-lite failed", message: err?.message || String(err) });
  }
}
