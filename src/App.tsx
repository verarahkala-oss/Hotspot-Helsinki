import React, { useEffect, useMemo, useState } from "react";
import MapView from "./MapView";
import useDebounce from "./useDebounce";
// If you have a constants file, import from there instead:
const API_BASE_URL = "https://hotspot-helsinki.vercel.app/api/events-lite";

type EventLite = {
  id: string;
  title: string;
  time?: string;
  lat: number;
  lng: number;
  category: string;
  price: "free" | "paid";
  website?: string | null;
};
type Bounds = { minLon: number; minLat: number; maxLon: number; maxLat: number };

export default function App() {
  const [events, setEvents] = useState<EventLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [price, setPrice] = useState<"" | "free" | "paid">("");
  const [category, setCategory] = useState<"" | "music" | "food" | "sports" | "family" | "other">("");
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const debouncedBounds = useDebounce(bounds, 500);

  const url = useMemo(() => {
    const p = new URLSearchParams();
    p.set("limit", "500");
    if (debouncedBounds) {
      const { minLon, minLat, maxLon, maxLat } = debouncedBounds;
      p.set("bbox", `${minLon},${minLat},${maxLon},${maxLat}`);
    }
    if (query) p.set("q", query);
    if (price) p.set("price", price);
    if (category) p.set("category", category);
    return `${API_BASE_URL}?${p.toString()}`;
  }, [debouncedBounds, query, price, category]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setEvents(json?.data ?? []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Network");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [url]);

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
      <h1 style={{ marginBottom: 8 }}>Hotspot Helsinki</h1>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <input
          placeholder="Search events…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd", minWidth: 200 }}
        />
        <select value={price} onChange={(e) => setPrice(e.target.value as any)} style={{ padding: 8, borderRadius: 8 }}>
          <option value="">All prices</option>
          <option value="free">Free</option>
          <option value="paid">Paid</option>
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value as any)} style={{ padding: 8, borderRadius: 8 }}>
          <option value="">All categories</option>
          <option value="music">Music</option>
          <option value="food">Food</option>
          <option value="sports">Sports</option>
          <option value="family">Family</option>
          <option value="other">Other</option>
        </select>
        <button onClick={() => { setQuery(""); setPrice(""); setCategory(""); }} style={{ padding: "8px 12px", borderRadius: 8 }}>
          Reset
        </button>
      </div>

      <div style={{ marginBottom: 8, color: error ? "#c00" : "#444" }}>
        {error ? `Failed to load: ${error}` : loading ? "Loading…" : `Loaded ${events.length} in view`}
      </div>

      <MapView events={events} onBoundsChange={setBounds} center={[60.1699, 24.9384]} zoom={12} />

      <ul style={{ listStyle: "none", padding: 0, marginTop: 12, display: "grid", gap: 8 }}>
        {events.slice(0, 20).map((ev) => (
          <li key={ev.id} style={{ border: "1px solid #eee", borderRadius: 10, padding: 10 }}>
            <strong>{ev.title}</strong>
            <div style={{ color: "#666", fontSize: 12 }}>
              {ev.category} • {ev.price} {ev.time ? `• ${String(ev.time).slice(0, 16)}` : ""}
            </div>
            {ev.website && <a href={ev.website} target="_blank" rel="noreferrer">Open</a>}
          </li>
        ))}
      </ul>
    </div>
  );
}