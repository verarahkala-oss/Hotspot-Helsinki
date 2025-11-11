// Minimal events proxy/normalizer with 90s in-memory cache (per lambda)
const SOURCE = "https://open-api.myhelsinki.fi/v2/events/?limit=1000";

let CACHE = { at: 0, json: null }; // cache per running instance
const TTL_MS = 90 * 1000;

function simplify(it) {
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
    if (isFresh) {
      payload = CACHE.json;
    } else {
      const r = await fetch(SOURCE, { headers: { Accept: "application/json" } });
      if (!r.ok) throw new Error(`Upstream HTTP ${r.status}`);
      const json = await r.json();
      const all = (json?.data ?? [])
        .map(simplify)
        .filter((e) => typeof e.lat === "number" && typeof e.lng === "number");
      payload = { updatedAt: new Date().toISOString(), count: all.length, data: all };
      CACHE = { at: now, json: payload };
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
