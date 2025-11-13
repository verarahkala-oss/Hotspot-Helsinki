import React, { useEffect, useMemo, useState, useRef } from "react";
import MapGL, { MapGLHandle } from "./MapGL";
import useDebounce from "./useDebounce";
import { fetchEvents, type LinkedEvent } from "./utils/fetchEvents";
import RadialFilterMenu, { FILTER_OPTIONS } from "../components/RadialFilterMenu";

type EventLite = LinkedEvent;
type Bounds = { minLon: number; minLat: number; maxLon: number; maxLat: number };

function isLiveNow(e: EventLite, now = Date.now()) {
  const s = e.start ? Date.parse(e.start) : NaN;
  const hasEnd = !!e.end;
  const en = hasEnd ? Date.parse(e.end!) : (isFinite(s) ? s + 6*60*60*1000 : NaN); // +6h fallback
  return isFinite(s) && isFinite(en) && s <= now && now <= en;
}

// Fallback demo events in case API fails
const DEMO_EVENTS: EventLite[] = [
  {
    id: "demo-1",
    title: "Demo Event - Market Square",
    start: new Date(Date.now() - 3600000).toISOString(),
    end: new Date(Date.now() + 7200000).toISOString(),
    lat: 60.1675,
    lng: 24.9525,
    category: "Market",
    price: "free",
    time: new Date().toLocaleString(),
    website: "https://www.hel.fi"
  }
];

export default function App() {
  const mapRef = useRef<MapGLHandle | null>(null);
  const cardRefs = useRef<Record<string, HTMLLIElement | null>>({});
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
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const debouncedBounds = useDebounce(bounds, 500);

  // Fetch live events from LinkedEvents API on mount
  useEffect(() => {
    let cancelled = false;
    
    const fetchAndSetEvents = async () => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
      try {
        const liveEvents = await fetchEvents();
        if (!cancelled) {
          setEvents(liveEvents);
        }
      } catch (e: any) {
        console.error("Failed to fetch events, using demo data:", e);
        if (!cancelled) {
          setError(e?.message || "Failed to load events");
          setEvents(DEMO_EVENTS); // Fallback to demo events
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    
    // Initial fetch
    fetchAndSetEvents();
    
    // Refresh events every 10 minutes to remove past events and get new ones
    const intervalId = setInterval(fetchAndSetEvents, 10 * 60 * 1000);
    
    return () => { 
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []); // Only run once on mount

  // Filter events by query, price, category, bounds, radial filters, and LIVE status
  const filteredEvents = useMemo(() => {
    let filtered = events;
    
    // Filter by search query
    if (query) {
      const lowerQuery = query.toLowerCase();
      filtered = filtered.filter(e => 
        e.title.toLowerCase().includes(lowerQuery) ||
        e.category.toLowerCase().includes(lowerQuery)
      );
    }
    
    // Filter by price
    if (price) {
      filtered = filtered.filter(e => e.price === price);
    }
    
    // Filter by category
    if (category) {
      filtered = filtered.filter(e => 
        e.category.toLowerCase().includes(category.toLowerCase())
      );
    }

    // Filter by radial menu filters
    if (activeFilters.size > 0) {
      filtered = filtered.filter(e => {
        // Check if event matches any active filter
        return Array.from(activeFilters).some(filterId => {
          const filterOption = FILTER_OPTIONS.find(opt => opt.id === filterId);
          if (!filterOption) return false;
          
          // Special handling for "free" filter
          if (filterId === "free") {
            return e.price === "free";
          }
          
          // Check if any keyword matches the event's category or title
          const searchText = `${e.category} ${e.title}`.toLowerCase();
          return filterOption.keywords.some(keyword => 
            searchText.includes(keyword.toLowerCase())
          );
        });
      });
    }
    
    // Filter by bounds
    if (debouncedBounds) {
      const { minLon, minLat, maxLon, maxLat } = debouncedBounds;
      filtered = filtered.filter(e => 
        e.lng >= minLon && e.lng <= maxLon &&
        e.lat >= minLat && e.lat <= maxLat
      );
    }
    
    // Filter by LIVE status if toggle is on
    if (onlyLive) {
      const now = Date.now();
      filtered = filtered.filter(e => isLiveNow(e, now));
    }
    
    return filtered;
  }, [events, query, price, category, debouncedBounds, onlyLive, activeFilters]);

  const onRowClick = (id: string) => {
    setSelectedId(id);
    mapRef.current?.flyToEvent(id);
  };

  const handleFilterToggle = (filterId: string) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(filterId)) {
        next.delete(filterId);
      } else {
        next.add(filterId);
      }
      return next;
    });
  };

  // Scroll to selected card with smooth animation
  useEffect(() => {
    if (selectedId && cardRefs.current[selectedId]) {
      const card = cardRefs.current[selectedId];
      card?.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center'
      });
    }
  }, [selectedId]);

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
        {/* Category filter temporarily disabled - LinkedEvents uses different categorization */}
        {/*
        <select value={category} onChange={(e) => setCategory(e.target.value as any)} style={{ padding: 8, borderRadius: 8 }}>
          <option value="">All categories</option>
          <option value="music">Music</option>
          <option value="food">Food</option>
          <option value="sports">Sports</option>
          <option value="family">Family</option>
          <option value="other">Other</option>
        </select>
        */}
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
        <button onClick={() => { setQuery(""); setPrice(""); setCategory(""); setOnlyLive(false); setActiveFilters(new Set()); }} style={{ padding: "8px 12px", borderRadius: 8 }}>
          Reset
        </button>
      </div>

      <div style={{ marginBottom: 8, color: error ? "#c00" : "#444", display: "flex", alignItems: "center", gap: 8 }}>
        {loading && <span style={{ 
          display: "inline-block", 
          width: 16, 
          height: 16, 
          border: "2px solid #ddd", 
          borderTop: "2px solid #333",
          borderRadius: "50%",
          animation: "spin 1s linear infinite"
        }} />}
        {error ? `⚠️ ${error} (showing demo data)` : loading ? "Loading events from LinkedEvents API..." : `📍 ${filteredEvents.length} events in view`}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

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

      {/* Radial Filter Menu */}
      <RadialFilterMenu 
        activeFilters={activeFilters}
        onFilterToggle={handleFilterToggle}
      />

      <ul style={{ listStyle: "none", padding: 0, marginTop: 12, display: "grid", gap: 8 }}>
        {filteredEvents.slice(0, 20).map((ev) => {
          const live = isLiveNow(ev);
          const isSelected = selectedId === ev.id;
          return (
          <li 
            key={ev.id} 
            ref={(el) => { cardRefs.current[ev.id] = el; }}
            onClick={() => onRowClick(ev.id)}
            className={isSelected ? "event-card-selected" : ""}
            style={{ 
              border: isSelected ? "2px solid #1e90ff" : "1px solid #eee", 
              borderRadius: 10, 
              padding: 10,
              cursor: "pointer",
              backgroundColor: isSelected ? "#f0f8ff" : "transparent",
              transition: "all 0.3s ease"
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