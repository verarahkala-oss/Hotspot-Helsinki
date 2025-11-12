import React, { useEffect, useMemo, useState, useRef } from "react";
import MapGL, { MapGLHandle } from "./MapGL";
import useDebounce from "./useDebounce";
// If you have a constants file, import from there instead:
const API_BASE_URL = "https://hotspot-helsinki.vercel.app/api/events-lite";

type EventLite = {
  id: string;
  title: string;
  time?: string;
  lat: number | null;
  lng: number | null;
  category: string;
  price: "free" | "paid";
  website?: string | null;
  start?: string;  // ISO date
  end?: string;    // ISO date
};
type Bounds = { minLon: number; minLat: number; maxLon: number; maxLat: number };

function isLiveNow(e: EventLite, now = Date.now()) {
  const s = e.start ? Date.parse(e.start) : NaN;
  const hasEnd = !!e.end;
  const en = hasEnd ? Date.parse(e.end!) : (isFinite(s) ? s + 6*60*60*1000 : NaN); // +6h fallback
  return isFinite(s) && isFinite(en) && s <= now && now <= en;
}

export default function App() {
  const mapRef = useRef<MapGLHandle | null>(null);
  const [events, setEvents] = useState<EventLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [price, setPrice] = useState<"" | "free" | "paid">("");
  const [category, setCategory] = useState<"" | "music" | "food" | "sports" | "family" | "other">("");
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [themeOverride, setThemeOverride] = useState<"light" | "dark" | undefined>(undefined);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [onlyLive, setOnlyLive] = useState(false);
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

  // Filter events by LIVE status if toggle is on
  const filteredEvents = useMemo(() => {
    if (!onlyLive) return events;
    const now = Date.now();
    return events.filter(e => isLiveNow(e, now));
  }, [events, onlyLive]);

  const onRowClick = (id: string) => {
    setSelectedId(id);
    mapRef.current?.flyToEvent(id);
  };

  // Auto-fly to single result
  useEffect(() => {
    if (filteredEvents.length === 1) {
      const id = filteredEvents[0].id;
      setSelectedId(id);
      mapRef.current?.flyToEvent(id, { zoom: 16 });
    }
  }, [filteredEvents]);

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
        <select value={themeOverride ?? ""} onChange={(e) => {
          const v = e.target.value as "" | "light" | "dark";
          setThemeOverride(v || undefined);
        }} style={{ padding: 8, borderRadius: 8 }}>
          <option value="">Theme: System</option>
          <option value="light">Theme: Light</option>
          <option value="dark">Theme: Dark</option>
        </select>
        <button 
          onClick={() => setOnlyLive(v => !v)}
          style={{ 
            padding: "8px 12px", 
            borderRadius: 8,
            background: onlyLive ? "#ff3b3b" : "transparent",
            color: onlyLive ? "#fff" : "inherit",
            border: onlyLive ? "none" : "1px solid #ddd",
            fontWeight: onlyLive ? 600 : 400,
            cursor: "pointer"
          }}
        >
          {onlyLive ? "🔴 LIVE NOW" : "Show LIVE"}
        </button>
        <button onClick={() => { setQuery(""); setPrice(""); setCategory(""); setOnlyLive(false); }} style={{ padding: "8px 12px", borderRadius: 8 }}>
          Reset
        </button>
      </div>

      <div style={{ marginBottom: 8, color: error ? "#c00" : "#444" }}>
        {error ? `Failed to load: ${error}` : loading ? "Loading…" : `Loaded ${filteredEvents.length} in view`}
      </div>

      <MapGL 
        ref={mapRef}
        events={filteredEvents} 
        onBoundsChange={setBounds} 
        center={[24.9384, 60.1699]} 
        zoom={12} 
        themeOverride={themeOverride}
        selectedEventId={selectedId}
        onMarkerClick={setSelectedId}
      />

      <ul style={{ listStyle: "none", padding: 0, marginTop: 12, display: "grid", gap: 8 }}>
        {filteredEvents.slice(0, 20).map((ev) => {
          const live = isLiveNow(ev);
          return (
          <li 
            key={ev.id} 
            onClick={() => onRowClick(ev.id)}
            style={{ 
              border: selectedId === ev.id ? "2px solid #1e90ff" : "1px solid #eee", 
              borderRadius: 10, 
              padding: 10,
              cursor: "pointer",
              backgroundColor: selectedId === ev.id ? "#f0f8ff" : "transparent"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <strong>{ev.title}</strong>
              {live && <span style={{ background: "#ff3b3b", color: "#fff", borderRadius: 8, padding: "2px 6px", fontSize: 11, fontWeight: 600 }}>LIVE</span>}
            </div>
            <div style={{ color: "#666", fontSize: 12 }}>
              {ev.category} • {ev.price} {ev.time ? `• ${String(ev.time).slice(0, 16)}` : ""}
            </div>
            {ev.website && <a href={ev.website} target="_blank" rel="noreferrer">Open</a>}
          </li>
          );
        })}
      </ul>
    </div>
  );
}