import React, { useEffect, useMemo, useState, useRef } from "react";
import MapGL, { MapGLHandle } from "./MapGL";
import useDebounce from "./useDebounce";
import { fetchEvents, type LinkedEvent } from "./utils/fetchEvents";
import TonightsPicks from "../components/TonightsPicks";
import OnboardingModal from "../components/OnboardingModal";
import EventSidebar from "../components/EventSidebar";
import BottomNavigation, { NavTab } from "../components/BottomNavigation";
import FilterBar, { QuickFilter } from "../components/FilterBar";
import PermissionModal from "../components/PermissionModal";
import DataAttribution from "../components/DataAttribution";
import { cacheEvents, getCachedEvents } from "./utils/eventCache";
import { getLikedEvents, getCategoryPreferenceScore, addRecentSearch } from "./utils/personalization";

const FILTER_OPTIONS = [
  { id: "music", label: "🎵 Music", keywords: ["music", "concert", "band", "dj", "jazz", "rock", "pop", "classical"] },
  { id: "nightlife", label: "🍻 Nightlife", keywords: ["club", "bar", "nightlife", "party", "pub"] },
  { id: "food", label: "🍔 Food & Drink", keywords: ["food", "restaurant", "cafe", "dining", "brunch", "dinner"] },
  { id: "arts", label: "🎨 Arts & Culture", keywords: ["art", "museum", "gallery", "exhibition", "culture", "theater", "theatre"] },
  { id: "sports", label: "⚽ Sports & Outdoors", keywords: ["sport", "fitness", "outdoor", "hiking", "running", "yoga"] },
  { id: "family", label: "👨‍👩‍👧 Family", keywords: ["family", "kids", "children", "workshop"] },
];

// OPTIMIZATION: Pre-compute filter lookup map for O(1) access
const FILTER_MAP = new Map(FILTER_OPTIONS.map(opt => [opt.id, opt]));

type EventLite = LinkedEvent;
type Bounds = { minLon: number; minLat: number; maxLon: number; maxLat: number };

function isLiveNow(e: EventLite, now = Date.now()) {
  const s = e.start ? Date.parse(e.start) : NaN;
  const hasEnd = !!e.end;
  const en = hasEnd ? Date.parse(e.end!) : (isFinite(s) ? s + 6*60*60*1000 : NaN); // +6h fallback
  
  // Check if event is currently happening
  if (!isFinite(s) || !isFinite(en) || s > now || now > en) {
    return false;
  }
  
  // Don't mark events as LIVE if they span more than 12 hours (likely exhibitions or all-day venue events)
  const durationHours = (en - s) / (1000 * 60 * 60);
  if (durationHours > 12) {
    return false;
  }
  
  return true;
}

// Calculate distance between two points using Haversine formula (in km)
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Score events based on: LIVE status, distance, popularity, and category match
function scoreEvent(
  event: EventLite,
  userLoc: { lat: number; lng: number } | null,
  activeFilters: Set<string>,
  currentTime: number
): number {
  let score = 0;
  
  // 1. LIVE STATUS (highest priority) - +1000 points
  if (isLiveNow(event, currentTime)) {
    score += 1000;
  }
  
  // 2. DISTANCE - Up to +500 points (closer is better)
  if (userLoc && event.lat !== null && event.lng !== null) {
    const distance = calculateDistance(userLoc.lat, userLoc.lng, event.lat, event.lng);
    // Events within 1km get max points, scaling down to 0 at 10km+
    const distanceScore = Math.max(0, 500 - (distance * 50));
    score += distanceScore;
  }
  
  // 3. PERSONALIZATION - Up to +500 points for liked categories
  const categoryPrefScore = getCategoryPreferenceScore(event.category);
  score += categoryPrefScore;
  
  // 4. CATEGORY MATCH - +200 points per matching filter (OPTIMIZED: use Map lookup)
  if (activeFilters.size > 0) {
    const searchText = `${event.category} ${event.title}`.toLowerCase();
    const matchCount = Array.from(activeFilters).filter(filterId => {
      const filterOption = FILTER_MAP.get(filterId);
      if (!filterOption) return false;
      return filterOption.keywords.some(keyword => 
        searchText.includes(keyword.toLowerCase())
      );
    }).length;
    score += matchCount * 200;
  }
  
  // 5. TIME UNTIL START - Slight bonus for events starting soon
  if (event.start) {
    const startTime = Date.parse(event.start);
    const hoursUntilStart = (startTime - currentTime) / (1000 * 60 * 60);
    if (hoursUntilStart > 0 && hoursUntilStart <= 3) {
      // Events starting in the next 3 hours get a small boost
      score += (3 - hoursUntilStart) * 50;
    }
  }
  
  return score;
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
  const [sidebarView, setSidebarView] = useState<"events" | "settings">("events");
  const [heatmapMode, setHeatmapMode] = useState(false);
  const [show3DBuildings, setShow3DBuildings] = useState(true);
  const [distanceUnit, setDistanceUnit] = useState<"km" | "miles">("km");
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [activeTab, setActiveTab] = useState<NavTab>("map");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [activeQuickFilters, setActiveQuickFilters] = useState<Set<QuickFilter>>(new Set());
  const [maxDistance, setMaxDistance] = useState<number>(100); // 100 = no limit
  const [geolocationLoaded, setGeolocationLoaded] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [locationPermissionAsked, setLocationPermissionAsked] = useState(false);
  // OPTIMIZATION: Debounce bounds to prevent excessive filtering during map pan/zoom
  const debouncedBounds = useDebounce(bounds, 500);

  // Check if we should show permission modal
  useEffect(() => {
    const hasAskedPermission = localStorage.getItem("locationPermissionAsked");
    if (!hasAskedPermission && "geolocation" in navigator) {
      // Wait a bit before showing the modal (better UX)
      setTimeout(() => {
        setShowPermissionModal(true);
      }, 1500);
    } else if (hasAskedPermission === "granted") {
      // Auto-request if previously granted
      requestGeolocation();
    }
  }, []);

  const requestGeolocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setGeolocationLoaded(true);
        },
        (error) => {
          console.log("Geolocation not available:", error.message);
          setGeolocationLoaded(true); // Mark as loaded even on error
        },
        { timeout: 5000, maximumAge: 300000 } // 5s timeout, 5min cache
      );
    } else {
      setGeolocationLoaded(true);
    }
  };

  const handleLocationAllow = () => {
    localStorage.setItem("locationPermissionAsked", "granted");
    setShowPermissionModal(false);
    setLocationPermissionAsked(true);
    requestGeolocation();
  };

  const handleLocationDeny = () => {
    localStorage.setItem("locationPermissionAsked", "denied");
    setShowPermissionModal(false);
    setLocationPermissionAsked(true);
    setGeolocationLoaded(true);
  };

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
    
    // Load cached events first
    const cached = getCachedEvents();
    if (cached && cached.length > 0) {
      setEvents(cached);
      setLoading(false);
    }
    
    const fetchAndSetEvents = async () => {
      if (cancelled) return;
      // Only show loading if we don't have cached data
      if (!cached || cached.length === 0) {
        setLoading(true);
      }
      setError(null);
      try {
        const liveEvents = await fetchEvents();
        if (!cancelled) {
          setEvents(liveEvents);
          // Cache successful fetch
          cacheEvents(liveEvents);
        }
      } catch (e: any) {
        console.error("Failed to fetch events:", e);
        if (!cancelled) {
          const errorMsg = e?.message || "Failed to load events";
          setError(cached && cached.length > 0 ? errorMsg + " (showing cached data)" : errorMsg);
          // Keep cached events if available, otherwise use demo
          if (!cached || cached.length === 0) {
            setEvents(DEMO_EVENTS);
          }
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

  // Retry function for manual refresh
  const handleRetry = () => {
    setLoading(true);
    setError(null);
    fetchEvents()
      .then((liveEvents) => {
        setEvents(liveEvents);
        cacheEvents(liveEvents);
      })
      .catch((e: any) => {
        console.error("Retry failed:", e);
        setError(e?.message || "Failed to load events");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  // Filter events by query, price, category, bounds, radial filters, and LIVE status
  // Then score and sort by relevance
  const filteredEvents = useMemo(() => {
    let filtered = events;
    
    // Filter out events that ended more than 24 hours ago
    const twentyFourHoursAgo = currentTime - (24 * 60 * 60 * 1000);
    filtered = filtered.filter(e => {
      if (!e.end) return true; // Keep events without end time
      const endTime = Date.parse(e.end);
      return endTime > twentyFourHoursAgo;
    });

    // Apply Quick Filters
    if (activeQuickFilters.has("now")) {
      filtered = filtered.filter(e => isLiveNow(e, currentTime));
    }
    
    if (activeQuickFilters.has("tonight")) {
      const todayStart = new Date(currentTime);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(currentTime);
      todayEnd.setHours(23, 59, 59, 999);
      
      filtered = filtered.filter(e => {
        if (!e.start) return false;
        const startTime = Date.parse(e.start);
        return startTime >= todayStart.getTime() && startTime <= todayEnd.getTime();
      });
    }
    
    if (activeQuickFilters.has("weekend")) {
      filtered = filtered.filter(e => {
        if (!e.start) return false;
        const eventDate = new Date(e.start);
        const day = eventDate.getDay();
        return day === 0 || day === 6; // Sunday (0) or Saturday (6)
      });
    }
    
    if (activeQuickFilters.has("free")) {
      filtered = filtered.filter(e => e.price === "free");
    }
    
    if (activeQuickFilters.has("popular")) {
      // Filter by events with high scores (top 30%)
      const scoredEvents = filtered.map(event => ({
        event,
        score: scoreEvent(event, userLocation, activeFilters, currentTime)
      }));
      scoredEvents.sort((a, b) => b.score - a.score);
      const topThreshold = Math.ceil(scoredEvents.length * 0.3);
      filtered = scoredEvents.slice(0, topThreshold).map(({ event }) => event);
    }

    // Filter by distance if user location is available
    if (userLocation && maxDistance < 100) {
      filtered = filtered.filter(e => {
        if (e.lat === null || e.lng === null) return false;
        const distance = calculateDistance(userLocation.lat, userLocation.lng, e.lat, e.lng);
        return distance <= maxDistance;
      });
    }
    
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
    
    // Score and sort events by relevance (skip if "popular" filter already sorted)
    if (!activeQuickFilters.has("popular")) {
      const scoredEvents = filtered.map(event => ({
        event,
        score: scoreEvent(event, userLocation, activeFilters, currentTime)
      }));
      
      // Sort by score (highest first)
      scoredEvents.sort((a, b) => b.score - a.score);
      
      filtered = scoredEvents.map(({ event }) => event);
    }
    
    return filtered;
  }, [events, query, price, category, debouncedBounds, onlyLive, activeFilters, currentTime, userLocation, activeQuickFilters, maxDistance]);

  // Show only liked events when Saved tab is active
  const displayEvents = useMemo(() => {
    if (activeTab === "saved") {
      const likedEventIds = new Set(getLikedEvents().map(e => e.id));
      return filteredEvents.filter(e => likedEventIds.has(e.id));
    }
    return filteredEvents;
  }, [activeTab, filteredEvents]);

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
    setActiveQuickFilters(new Set());
    setMaxDistance(100);
  };

  const handleQuickFilterToggle = (filter: QuickFilter) => {
    setActiveQuickFilters(prev => {
      const next = new Set(prev);
      if (next.has(filter)) {
        next.delete(filter);
      } else {
        next.add(filter);
      }
      return next;
    });
  };

  const handleCategoryFilterToggle = (categoryId: string) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      localStorage.setItem("userInterests", JSON.stringify(Array.from(next)));
      return next;
    });
  };

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden" }}>
      {/* Filter Bar */}
      <FilterBar
        activeQuickFilters={activeQuickFilters}
        onQuickFilterToggle={handleQuickFilterToggle}
        activeCategoryFilters={activeFilters}
        onCategoryFilterToggle={handleCategoryFilterToggle}
        maxDistance={maxDistance}
        onMaxDistanceChange={setMaxDistance}
        userLocation={userLocation}
      />

      {/* Permission Modal */}
      <PermissionModal
        isOpen={showPermissionModal}
        onAllow={handleLocationAllow}
        onDeny={handleLocationDeny}
      />

      {/* Onboarding Modal */}
      {showOnboarding && (
        <OnboardingModal 
          onComplete={handleOnboardingComplete}
          initialInterests={Array.from(activeFilters)}
        />
      )}

      {/* Data Attribution */}
      <DataAttribution />

      {/* Header with title only */}
      <div
        style={{
          position: "absolute",
          top: 70,
          left: 16,
          zIndex: 10,
          background: "rgba(255, 255, 255, 0.98)",
          backdropFilter: "blur(12px)",
          padding: "14px 20px",
          borderRadius: 16,
          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.12)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "#1a1a1a" }}>
          Hotspot Helsinki
        </h1>
      </div>

      {/* Event count indicator */}
      <div
        style={{
          position: "absolute",
          top: 130,
          left: 16,
          zIndex: 10,
          background: "rgba(255, 255, 255, 0.98)",
          backdropFilter: "blur(12px)",
          padding: "10px 14px",
          borderRadius: 12,
          boxShadow: "0 2px 12px rgba(0, 0, 0, 0.1)",
          fontSize: "13px",
          color: error ? "#c00" : "#666",
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontWeight: 500,
        }}
      >
        {loading && (
          <span
            style={{
              display: "inline-block",
              width: 14,
              height: 14,
              border: "2px solid #e0e0e0",
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
        onClick={() => {
          setSidebarView("events");
          setSidebarOpen(true);
        }}
        style={{
          position: "absolute",
          left: 16,
          top: 178,
          zIndex: 10,
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          color: "#fff",
          border: "none",
          borderRadius: 14,
          padding: "14px 20px",
          fontSize: "15px",
          fontWeight: 600,
          cursor: "pointer",
          boxShadow: "0 4px 16px rgba(102, 126, 234, 0.4)",
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

      {/* Settings Button */}
      <button
        onClick={() => {
          setSidebarView("settings");
          setSidebarOpen(true);
        }}
        style={{
          position: "absolute",
          left: 16,
          top: 230,
          zIndex: 10,
          background: "rgba(255, 255, 255, 0.98)",
          backdropFilter: "blur(12px)",
          color: "#666",
          border: "1px solid #e0e0e0",
          borderRadius: 14,
          padding: "14px 20px",
          fontSize: "15px",
          fontWeight: 600,
          cursor: "pointer",
          boxShadow: "0 2px 12px rgba(0, 0, 0, 0.1)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = "0 4px 16px rgba(102, 126, 234, 0.2)";
          e.currentTarget.style.borderColor = "#667eea";
          e.currentTarget.style.color = "#667eea";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "0 2px 12px rgba(0, 0, 0, 0.1)";
          e.currentTarget.style.borderColor = "#e0e0e0";
          e.currentTarget.style.color = "#666";
        }}
      >
        <span style={{ fontSize: "18px" }}>⚙️</span>
        Settings
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
        view={sidebarView}
        onClose={() => {
          setSidebarOpen(false);
          setActiveTab("map");
        }}
        events={displayEvents}
        selectedId={selectedId}
        onEventClick={(id) => {
          setSelectedId(id);
          mapRef.current?.flyToEvent(id, { zoom: 16 });
        }}
        query={query}
        onQueryChange={(newQuery) => {
          setQuery(newQuery);
          // Track search after 2+ characters
          if (newQuery.trim().length >= 2) {
            addRecentSearch(newQuery);
          }
        }}
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
        loading={loading}
        error={error}
        onRetry={handleRetry}
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

      {/* Floating Action Buttons */}
      <div
        style={{
          position: "fixed",
          right: 16,
          bottom: 100,
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {/* Center on My Location Button */}
        <button
          onClick={() => mapRef.current?.centerOnUserLocation()}
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            fontSize: "24px",
            boxShadow: "0 4px 12px rgba(102, 126, 234, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.1)";
            e.currentTarget.style.boxShadow = "0 6px 16px rgba(102, 126, 234, 0.5)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "0 4px 12px rgba(102, 126, 234, 0.4)";
          }}
          title="Center on my location"
        >
          📍
        </button>

        {/* Home/Reset Button */}
        <button
          onClick={() => {
            mapRef.current?.resetToHome();
            handleReset();
          }}
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "#fff",
            color: "#667eea",
            border: "2px solid #667eea",
            cursor: "pointer",
            fontSize: "24px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.1)";
            e.currentTarget.style.background = "#667eea";
            e.currentTarget.style.color = "#fff";
            e.currentTarget.style.boxShadow = "0 4px 12px rgba(102, 126, 234, 0.3)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.background = "#fff";
            e.currentTarget.style.color = "#667eea";
            e.currentTarget.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.1)";
          }}
          title="Reset to home"
        >
          🏠
        </button>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation 
        activeTab={activeTab} 
        onTabChange={(tab) => {
          setActiveTab(tab);
          if (tab === "map") {
            setSidebarOpen(false);
          } else if (tab === "explore") {
            setSidebarView("events");
            setSidebarOpen(true);
          } else if (tab === "saved") {
            // Future: show saved events
            setSidebarView("events");
            setSidebarOpen(true);
          } else if (tab === "profile") {
            setSidebarView("settings");
            setSidebarOpen(true);
          }
        }}
      />
    </div>
  );
}