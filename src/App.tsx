import React, { useEffect, useMemo, useState, useRef } from "react";
import MapGL, { MapGLHandle } from "./MapGL";
import useDebounce from "./useDebounce";
import { fetchEvents, type LinkedEvent } from "./utils/fetchEvents";
import TonightsPicks from "../components/TonightsPicks";
import OnboardingModal from "../components/OnboardingModal";
import EventSidebar from "../components/EventSidebar";

const FILTER_OPTIONS = [
  { id: "music", label: "🎵 Music", keywords: ["music", "concert", "band", "dj", "jazz", "rock", "pop", "classical"] },
  { id: "nightlife", label: "🍻 Nightlife", keywords: ["club", "bar", "nightlife", "party", "pub"] },
  { id: "food", label: "🍔 Food & Drink", keywords: ["food", "restaurant", "cafe", "dining", "brunch", "dinner"] },
  { id: "arts", label: "🎨 Arts & Culture", keywords: ["art", "museum", "gallery", "exhibition", "culture", "theater", "theatre"] },
  { id: "sports", label: "⚽ Sports & Outdoors", keywords: ["sport", "fitness", "outdoor", "hiking", "running", "yoga"] },
  { id: "family", label: "👨‍👩‍👧 Family", keywords: ["family", "kids", "children", "workshop"] },
];

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
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [heatmapMode, setHeatmapMode] = useState(false);
  const [show3DBuildings, setShow3DBuildings] = useState(true);
  const [distanceUnit, setDistanceUnit] = useState<"km" | "miles">("km");
  const [currentTime, setCurrentTime] = useState(Date.now());
  const debouncedBounds = useDebounce(bounds, 500);

  // Update current time every minute to refresh LIVE status
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  // Check if user has seen onboarding
  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem("hasSeenOnboarding");
    if (!hasSeenOnboarding) {
      setShowOnboarding(true);
    } else {
      // Load saved interests
      const savedInterests = localStorage.getItem("userInterests");
      if (savedInterests) {
        try {
          const interests = JSON.parse(savedInterests);
          setActiveFilters(new Set(interests));
        } catch (e) {
          console.error("Failed to load saved interests:", e);
        }
      }
    }
  }, []);

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
      filtered = filtered.filter(e => isLiveNow(e, currentTime));
    }
    
    return filtered;
  }, [events, query, price, category, debouncedBounds, onlyLive, activeFilters, currentTime]);

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
      // Save to localStorage
      localStorage.setItem("userInterests", JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const handleOnboardingComplete = (interests: string[]) => {
    setActiveFilters(new Set(interests));
    setShowOnboarding(false);
    localStorage.setItem("hasSeenOnboarding", "true");
    localStorage.setItem("userInterests", JSON.stringify(interests));
  };

  const handleReset = () => {
    setQuery("");
    setPrice("");
    setCategory("");
    setOnlyLive(false);
    setActiveFilters(new Set());
  };

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden" }}>
      {/* Onboarding Modal */}
      {showOnboarding && (
        <OnboardingModal 
          onComplete={handleOnboardingComplete}
          initialInterests={Array.from(activeFilters)}
        />
      )}

      {/* Header with title only */}
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          zIndex: 10,
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(10px)",
          padding: "12px 16px",
          borderRadius: 12,
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700 }}>
          Hotspot Helsinki
        </h1>
      </div>

      {/* Event count indicator */}
      <div
        style={{
          position: "absolute",
          top: 76,
          left: 16,
          zIndex: 10,
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(10px)",
          padding: "8px 12px",
          borderRadius: 8,
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
          fontSize: "13px",
          color: error ? "#c00" : "#666",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {loading && (
          <span
            style={{
              display: "inline-block",
              width: 14,
              height: 14,
              border: "2px solid #ddd",
              borderTop: "2px solid #667eea",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          />
        )}
        {error
          ? `⚠️ ${error}`
          : loading
          ? "Loading..."
          : `${filteredEvents.length} events`}
      </div>

      {/* Sidebar Toggle Button */}
      <button
        onClick={() => setSidebarOpen(true)}
        style={{
          position: "absolute",
          left: 16,
          top: 124,
          zIndex: 10,
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          color: "#fff",
          border: "none",
          borderRadius: 12,
          padding: "12px 18px",
          fontSize: "15px",
          fontWeight: 600,
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(102, 126, 234, 0.4)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = "0 6px 16px rgba(102, 126, 234, 0.5)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "0 4px 12px rgba(102, 126, 234, 0.4)";
        }}
      >
        <span style={{ fontSize: "18px" }}>📋</span>
        Events ({filteredEvents.length})
      </button>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Tonight's Picks Ribbon */}
      <TonightsPicks 
        events={filteredEvents} 
        onEventClick={(id) => {
          setSelectedId(id);
          mapRef.current?.flyToEvent(id, { zoom: 16 });
        }}
      />

      {/* Map */}
      <MapGL 
        ref={mapRef}
        events={filteredEvents} 
        onBoundsChange={setBounds} 
        center={[24.9384, 60.1699]} 
        zoom={12} 
        themeOverride={themeOverride}
        selectedEventId={selectedId}
        onMarkerClick={setSelectedId}
        heatmapMode={heatmapMode}
        show3DBuildings={show3DBuildings}
      />

      {/* Event Sidebar */}
      <EventSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        events={filteredEvents}
        selectedId={selectedId}
        onEventClick={(id) => {
          setSelectedId(id);
          mapRef.current?.flyToEvent(id, { zoom: 16 });
        }}
        query={query}
        onQueryChange={setQuery}
        price={price}
        onPriceChange={setPrice}
        onlyLive={onlyLive}
        onOnlyLiveChange={setOnlyLive}
        onReset={handleReset}
        activeFilters={activeFilters}
        onShowInterests={() => setShowOnboarding(true)}
        isLiveNow={isLiveNow}
        onEnableCompass={() => mapRef.current?.enableCompass()}
        themeOverride={themeOverride}
        onThemeChange={setThemeOverride}
        heatmapMode={heatmapMode}
        onHeatmapModeChange={setHeatmapMode}
        show3DBuildings={show3DBuildings}
        onShow3DBuildingsChange={setShow3DBuildings}
        distanceUnit={distanceUnit}
        onDistanceUnitChange={setDistanceUnit}
        onApplyPreset={(preset) => {
          if (preset === "tonight") {
            setOnlyLive(true);
            setActiveFilters(new Set());
          } else if (preset === "weekend") {
            // This weekend logic would need date filtering
            setOnlyLive(false);
          } else if (preset === "free") {
            setPrice("free");
            setActiveFilters(new Set());
          } else if (preset === "near-me") {
            // Trigger geolocation and set bounds
            mapRef.current?.enableCompass();
          }
        }}
      />
    </div>
  );
}