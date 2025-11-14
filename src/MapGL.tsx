import React, { useEffect, useMemo, useRef, useImperativeHandle, forwardRef } from "react";
import { createRoot, Root } from "react-dom/client";
import maplibregl, { Map as MLMap, LngLatBoundsLike } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_STYLE_LIGHT, MAP_STYLE_DARK } from "./mapStyle";
import { VenueDetails } from "../components/VenueDetails";
import { loadMapIcons, getCategoryIcon } from "./mapIcons";

type Ev = { 
  id:string; 
  title:string; 
  lat:number | null; 
  lng:number | null; 
  category:string; 
  price:"free"|"paid"; 
  time?:string; 
  website?:string|null;
  start?: string;  // ISO date
  end?: string;    // ISO date
  ticketUrl?: string | null;  // Direct link to purchase tickets
  ticketPrice?: string | null;  // Price information from offers
  ticketInfo?: string | null;  // Additional ticket details
  maxAttendees?: number | null;  // Maximum capacity
  currentAttendees?: number | null;  // Current registrations
};
type Bounds = { minLon:number; minLat:number; maxLon:number; maxLat:number };

function formatEventTime(timeStr?: string): string {
  if (!timeStr) return "";
  
  // If it's the default all-day format (00:00-23:59 or similar), don't show time
  if (timeStr.includes("00:00") && timeStr.includes("23:59")) {
    return "All day";
  }
  if (timeStr.includes("00.00") && timeStr.includes("23.59")) {
    return "All day";
  }
  if (timeStr.includes("00:01") && timeStr.includes("23:59")) {
    return "All day";
  }
  
  // Return the time, but limit to reasonable length
  return timeStr.slice(0, 16);
}

function isLiveNow(e: Ev, now = Date.now()) {
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

function eventsToGeoJSON(events: Ev[], now = Date.now()) {
  return {
    type: "FeatureCollection",
    features: (events || [])
      .filter((e) => e.lat !== null && e.lng !== null)
      .map((e: Ev) => {
        const isLive = isLiveNow(e, now);
        // Simple score: live events get 1000, others get 500-700 based on category
        let score = 600;
        if (isLive) score = 1000;
        else if (e.price === "free") score += 50;
        else if (["music", "food", "arts"].includes(e.category)) score += 100;
        
        // Determine icon based on category
        const normalized = e.category.toLowerCase();
        let iconKey = "default";
        if (normalized.includes("music") || normalized.includes("concert")) iconKey = "music";
        else if (normalized.includes("night") || normalized.includes("club") || normalized.includes("bar")) iconKey = "nightlife";
        else if (normalized.includes("food") || normalized.includes("restaurant") || normalized.includes("cafe")) iconKey = "food";
        else if (normalized.includes("art") || normalized.includes("museum") || normalized.includes("gallery")) iconKey = "arts";
        else if (normalized.includes("theater") || normalized.includes("theatre") || normalized.includes("show")) iconKey = "theater";
        else if (normalized.includes("sport") || normalized.includes("outdoor")) iconKey = "sports";
        else if (normalized.includes("family") || normalized.includes("kids")) iconKey = "family";
        else if (normalized.includes("tech") || normalized.includes("coding") || normalized.includes("digital")) iconKey = "tech";
        else if (normalized.includes("gaming") || normalized.includes("game")) iconKey = "gaming";
        else if (normalized.includes("festival") || normalized.includes("fair")) iconKey = "festival";
        
        return {
          type: "Feature",
          properties: { 
            id: e.id, 
            title: e.title, 
            category: e.category, 
            price: e.price, 
            time: e.time || "", 
            website: e.website || "",
            isLive,
            score,
            iconKey,
            ticketUrl: e.ticketUrl || null,
            ticketPrice: e.ticketPrice || null,
            ticketInfo: e.ticketInfo || null,
            maxAttendees: e.maxAttendees || null,
            currentAttendees: e.currentAttendees || null
          },
          geometry: { type: "Point", coordinates: [e.lng!, e.lat!] }
        };
      })
  } as any;
}

export type MapGLHandle = {
  flyToEvent: (id: string, opts?: { zoom?: number; openPopup?: boolean }) => void;
  enableCompass: () => void;
  centerOnUserLocation: () => void;
  resetToHome: () => void;
};

const MapGL = forwardRef<MapGLHandle, {
  events: Ev[];
  onBoundsChange: (b: Bounds) => void;
  onMarkerClick?: (id: string) => void;
  selectedEventId?: string;
  center?: [number, number];
  zoom?: number;
  themeOverride?: "light" | "dark";
  heatmapMode?: boolean;
  show3DBuildings?: boolean;
}>(function MapGL({ events, onBoundsChange, onMarkerClick, selectedEventId, center = [24.9384, 60.1699], zoom = 12, themeOverride, heatmapMode: heatmapModeProp = false, show3DBuildings: show3DBuildingsProp = true }, ref) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const currentThemeRef = useRef<string | null>(null);
  const themeChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializingRef = useRef(false);
  const geolocateRef = useRef<maplibregl.GeolocateControl | null>(null);
  const geoMarkerRef = useRef<maplibregl.Marker | null>(null);
  const headingRef = useRef<number | null>(null);
  const coneElRef = useRef<HTMLElement | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const popupRootRef = useRef<Root | null>(null);
  const rafRef = useRef<number>(0);
  const [showSearchButton, setShowSearchButton] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(Date.now());
  const initialCenterRef = useRef(center);
  const heatmapMode = heatmapModeProp;
  const show3DBuildings = show3DBuildingsProp;

  // Update current time every minute to refresh LIVE status
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  const geo = useMemo(() => eventsToGeoJSON(events as any, currentTime), [events, currentTime]);
  
  // Build an index for quick lookup: id -> event
  const byId = useMemo(() => {
    const m = new Map<string, Ev>();
    for (const e of events) {
      if (e.lat !== null && e.lng !== null) {
        m.set(e.id, e);
      }
    }
    return m;
  }, [events]);
  
  // Helper to create popup with VenueDetails component
  const createEventPopup = (map: MLMap, coords: [number, number], properties: any) => {
    // Remove existing popup and unmount React component
    if (popupRef.current) {
      popupRef.current.remove();
    }
    if (popupRootRef.current) {
      popupRootRef.current.unmount();
      popupRootRef.current = null;
    }
    
    const badge = properties.isLive 
      ? `<span style="background:#ff3b3b;color:#fff;border-radius:8px;padding:2px 6px;font-size:11px;margin-left:6px;font-weight:600">LIVE NOW</span>` 
      : "";
    
    const formattedTime = formatEventTime(properties.time);
    const timeDisplay = formattedTime ? ` • ${formattedTime}` : "";
    
    // Build ticket/attendance info
    let ticketSection = "";
    
    // Show attendance if available
    if (properties.maxAttendees !== null && properties.maxAttendees > 0) {
      const current = properties.currentAttendees || 0;
      const max = properties.maxAttendees;
      const percentage = Math.round((current / max) * 100);
      const spotsLeft = max - current;
      
      let attendanceColor = "#4CAF50"; // green
      let attendanceText = `${current} / ${max} attendees`;
      let urgencyBadge = "";
      
      if (percentage >= 100) {
        attendanceColor = "#f44336"; // red
        attendanceText = "Sold Out";
        urgencyBadge = `<span style="background:#f44336;color:#fff;border-radius:6px;padding:2px 6px;font-size:10px;margin-left:6px;font-weight:600">FULL</span>`;
      } else if (percentage >= 90) {
        attendanceColor = "#ff9800"; // orange
        attendanceText = `Only ${spotsLeft} spots left!`;
        urgencyBadge = `<span style="background:#ff9800;color:#fff;border-radius:6px;padding:2px 6px;font-size:10px;margin-left:6px;font-weight:600">ALMOST FULL</span>`;
      } else if (percentage >= 75) {
        attendanceColor = "#ff9800"; // orange
        attendanceText = `${spotsLeft} spots available`;
        urgencyBadge = `<span style="background:#ffa726;color:#fff;border-radius:6px;padding:2px 6px;font-size:10px;margin-left:6px;font-weight:600">SELLING FAST</span>`;
      }
      
      ticketSection += `<div style="margin-top:8px;padding:6px;background:#f5f5f5;border-radius:6px;font-size:12px">
        <span style="color:${attendanceColor};font-weight:600">👥 ${attendanceText}</span>${urgencyBadge}
      </div>`;
    }
    
    // Show ticket price if available
    if (properties.ticketPrice) {
      ticketSection += `<div style="margin-top:6px;font-size:13px;color:#333">
        <strong>💳 ${properties.ticketPrice}</strong>
      </div>`;
    }
    
    // Show ticket button if URL available
    if (properties.ticketUrl) {
      const isSoldOut = properties.maxAttendees && properties.currentAttendees >= properties.maxAttendees;
      const buttonText = isSoldOut ? "View Event (Sold Out)" : "🎟️ Buy Tickets";
      const buttonStyle = isSoldOut 
        ? "background:#9e9e9e;color:#fff;padding:8px 16px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:8px;font-size:13px;font-weight:600;cursor:not-allowed"
        : "background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:8px 16px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:8px;font-size:13px;font-weight:600;box-shadow:0 2px 8px rgba(102,126,234,0.3);transition:transform 0.2s";
      
      ticketSection += `<a href="${properties.ticketUrl}" target="_blank" rel="noreferrer" style="${buttonStyle}" ${isSoldOut ? '' : 'onmouseover="this.style.transform=\'scale(1.05)\'" onmouseout="this.style.transform=\'scale(1)\'"'}>
        ${buttonText}
      </a>`;
    }
    
    // Show additional ticket info if available
    if (properties.ticketInfo) {
      ticketSection += `<div style="margin-top:6px;font-size:11px;color:#666;font-style:italic">
        ${properties.ticketInfo}
      </div>`;
    }
    
    // Create popup container
    const popupContainer = document.createElement("div");
    popupContainer.style.minWidth = "220px";
    
    // Make title clickable if website exists
    const titleHtml = properties.website 
      ? `<a href="${properties.website}" target="_blank" rel="noreferrer" style="color:inherit;text-decoration:none;border-bottom:2px solid #667eea;transition:color 0.2s" onmouseover="this.style.color='#667eea'" onmouseout="this.style.color='inherit'"><strong>${properties.title || "Event"}</strong></a>`
      : `<strong>${properties.title || "Event"}</strong>`;
    
    // Add static content
    popupContainer.innerHTML = `
      <div>
        ${titleHtml}${badge}
        <div style="font-size:12px;color:#666;margin-top:4px">${properties.category} • ${properties.price}${timeDisplay}</div>
        ${ticketSection}
        <button id="show-venue-details" style="margin-top:10px;padding:6px 12px;background:#f5f5f5;border:1px solid #ddd;border-radius:6px;cursor:pointer;font-size:12px;width:100%;text-align:left;transition:background 0.2s" onmouseover="this.style.background='#ebebeb'" onmouseout="this.style.background='#f5f5f5'">
          ▶ View Venue Details
        </button>
      </div>
      <div id="venue-details-container"></div>
    `;
    
    // Create popup
    const popup = new maplibregl.Popup({ closeButton: true })
      .setLngLat(coords)
      .setDOMContent(popupContainer)
      .addTo(map);
    
    popupRef.current = popup;
    
    // Add click handler for venue details button
    const venueButton = popupContainer.querySelector("#show-venue-details");
    const venueContainer = popupContainer.querySelector("#venue-details-container");
    
    if (venueButton && venueContainer && properties.title && coords[1] && coords[0]) {
      let detailsLoaded = false;
      
      venueButton.addEventListener("click", () => {
        if (!detailsLoaded) {
          detailsLoaded = true;
          venueButton.textContent = "▼ Venue Details";
          
          // Render VenueDetails component on demand
          if (!popupRootRef.current) {
            popupRootRef.current = createRoot(venueContainer);
          }
          popupRootRef.current.render(
            <VenueDetails 
              venueName={properties.title} 
              lat={coords[1]} 
              lng={coords[0]} 
            />
          );
        } else {
          // Toggle visibility
          const container = venueContainer as HTMLElement;
          if (container.style.display === "none") {
            container.style.display = "block";
            venueButton.textContent = "▼ Venue Details";
          } else {
            container.style.display = "none";
            venueButton.textContent = "▶ View Venue Details";
          }
        }
      });
    }
    
    return popup;
  };
  
  // Imperative API
  useImperativeHandle(ref, () => ({
    flyToEvent: (id: string, opts?: { zoom?: number; openPopup?: boolean }) => {
      const map = mapRef.current;
      if (!map) return;
      const ev = byId.get(id);
      if (!ev || ev.lat === null || ev.lng === null) return;
      
      const targetZoom = opts?.zoom ?? 15;
      map.easeTo({ 
        center: [ev.lng, ev.lat], 
        zoom: targetZoom, 
        duration: 800, 
        pitch: 45 
      });
      
      if (opts?.openPopup !== false) {
        createEventPopup(map, [ev.lng, ev.lat], {
          title: ev.title,
          category: ev.category,
          price: ev.price,
          time: ev.time,
          website: ev.website,
          isLive: isLiveNow(ev, Date.now()),
          ticketUrl: ev.ticketUrl,
          ticketPrice: ev.ticketPrice,
          ticketInfo: ev.ticketInfo,
          maxAttendees: ev.maxAttendees,
          currentAttendees: ev.currentAttendees
        });
      }
      
      // Sync selection state
      if (onMarkerClick) {
        onMarkerClick(id);
      }
    },
    enableCompass: enableCompassFallback,
    centerOnUserLocation: () => {
      if (geolocateRef.current) {
        geolocateRef.current.trigger();
      }
    },
    resetToHome: () => {
      const map = mapRef.current;
      if (!map) return;
      map.easeTo({
        center: initialCenterRef.current,
        zoom: 12,
        pitch: 0,
        bearing: 0,
        duration: 1000
      });
    }
  }), [byId, onMarkerClick, createEventPopup]);
  
  // Set heading and rotate the cone
  const setHeadingDeg = (deg: number | null) => {
    headingRef.current = deg;
    if (!coneElRef.current) return;
    
    // Hide cone if heading is unknown
    if (deg == null || Number.isNaN(deg)) {
      coneElRef.current.style.opacity = "0";
      return;
    }
    
    coneElRef.current.style.opacity = "1";
    // Rotate cone; heading is degrees clockwise from North
    coneElRef.current.style.transform = `translate(-50%, -60%) rotate(${deg}deg)`;
  };
  
  // Helper to create/return the pulsing location marker with cone
  const ensureGeoMarker = (map: MLMap) => {
    if (geoMarkerRef.current) return geoMarkerRef.current;
    const el = document.createElement("div");
    el.className = "pulse-pin";
    // Add cone ABOVE the dot so it points forward
    el.innerHTML = `<span class="cone"></span><span class="ring"></span><span class="dot"></span>`;
    coneElRef.current = el.querySelector(".cone") as HTMLElement;
    const marker = new maplibregl.Marker({ element: el, anchor: "center" });
    marker.addTo(map);
    geoMarkerRef.current = marker;
    return marker;
  };
  
  // Enable compass fallback via DeviceOrientationEvent (iOS Safari needs permission)
  const enableCompassFallback = () => {
    const handler = (ev: DeviceOrientationEvent) => {
      // Use webkitCompassHeading on iOS if present (0 = North, clockwise)
      const ios = (ev as any).webkitCompassHeading as number | undefined;
      if (typeof ios === "number" && !Number.isNaN(ios)) {
        setHeadingDeg(ios);
        return;
      }
      // Otherwise try alpha (0..360)
      if (typeof ev.alpha === "number" && !Number.isNaN(ev.alpha)) {
        setHeadingDeg(ev.alpha);
      }
    };

    if (typeof (DeviceOrientationEvent as any).requestPermission === "function") {
      // iOS 13+ requires permission
      (DeviceOrientationEvent as any).requestPermission().then((res: string) => {
        if (res === "granted") {
          window.addEventListener("deviceorientation", handler, true);
          console.log('Compass enabled via DeviceOrientation');
        }
      }).catch((err: any) => {
        console.warn('DeviceOrientation permission denied:', err);
      });
    } else {
      // Non-iOS or already allowed
      window.addEventListener("deviceorientation", handler, true);
      console.log('Compass enabled via DeviceOrientation (no permission needed)');
    }
  };

  // Fallback if no MapTiler key
  const apiKey = import.meta.env.VITE_MAPTILER_KEY;
  console.log('MapTiler key check:', { apiKey, hasKey: !!apiKey });
  
  if (!apiKey || apiKey === 'your_maptiler_key_here') {
    return (
      <div ref={containerRef} style={{ height: "70vh", width: "100%", borderRadius: 12, background: "#f5f5f5", display: "flex", alignItems: "center", justifyContent: "center", color: "#666" }}>
        <div style={{ textAlign: "center", padding: 20 }}>
          <div style={{ fontSize: 18, marginBottom: 8 }}>🗺️ Map Configuration Needed</div>
          <div style={{ fontSize: 14 }}>Please set VITE_MAPTILER_KEY in .env.local</div>
          <div style={{ fontSize: 12, marginTop: 8, color: "#999" }}>Current: {apiKey || 'undefined'}</div>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (!containerRef.current) return;
    
    // Prevent double initialization in React StrictMode
    if (mapRef.current || isInitializingRef.current) {
      console.log('Map already initialized or initializing, skipping');
      return;
    }
    
    isInitializingRef.current = true;
    console.log('Creating new map instance');
    
    // Detect system theme preference once on mount
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    const initialTheme = themeOverride ?? (prefersDark ? "dark" : "light");
    const initialStyle = initialTheme === "dark" ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;
    
    // Set initial theme in ref to prevent unnecessary style changes
    currentThemeRef.current = initialTheme;
    console.log('Initial theme set to:', initialTheme);
    
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: initialStyle,
      center,
      zoom,
      pitch: 45,
      bearing: -17,
      dragRotate: true,
      touchPitch: true
    } as any);
    mapRef.current = map;

    // Controls (Apple-ish minimal UI)
    map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), "top-right");
    
    // Geolocation control with ref for programmatic triggering
    const geoControl = new maplibregl.GeolocateControl({ 
      positionOptions: { enableHighAccuracy: true }, 
      trackUserLocation: true
    });
    geolocateRef.current = geoControl;
    map.addControl(geoControl, "top-right");

    // Add event listeners for debugging
    geoControl.on('geolocate', (e: any) => {
      console.log('GeolocateControl: position obtained', e.coords);
    });
    geoControl.on('error', (e: any) => {
      console.error('GeolocateControl: error', e);
    });
    geoControl.on('trackuserlocationstart', () => {
      console.log('GeolocateControl: tracking started');
    });
    geoControl.on('trackuserlocationend', () => {
      console.log('GeolocateControl: tracking ended');
    });

    // Track if we've triggered geolocation once
    let geoTriggered = false;

    map.on("load", () => {
      // Try to geolocate once on load (requires HTTPS or localhost)
      if (!geoTriggered && geolocateRef.current) {
        geoTriggered = true;
        console.log('Triggering geolocation request');
        // Delay trigger to ensure map is fully loaded
        setTimeout(() => {
          if (geolocateRef.current) {
            geolocateRef.current.trigger();
          }
        }, 500);
      }
      
      // Clustering source with better configuration
      map.addSource("events", {
        type: "geojson",
        data: geo,
        cluster: true,
        clusterRadius: 60,        // Increased for better clustering
        clusterMaxZoom: 16,       // Cluster up to zoom 16 (was 14)
        clusterProperties: {
          // Count events by category for cluster breakdown
          "music": ["+", ["case", ["==", ["get", "category"], "music"], 1, 0]],
          "food": ["+", ["case", ["==", ["get", "category"], "food"], 1, 0]],
          "arts": ["+", ["case", ["==", ["get", "category"], "arts"], 1, 0]],
          "sports": ["+", ["case", ["==", ["get", "category"], "sports"], 1, 0]],
          "nightlife": ["+", ["case", ["==", ["get", "category"], "nightlife"], 1, 0]],
          "family": ["+", ["case", ["==", ["get", "category"], "family"], 1, 0]],
          "tech": ["+", ["case", ["==", ["get", "category"], "tech"], 1, 0]]
        } as any
      });

      // HEATMAP LAYER - Shows activity density
      map.addLayer({
        id: "events-heatmap",
        type: "heatmap",
        source: "events",
        maxzoom: 15,
        paint: {
          // Increase weight for live events
          "heatmap-weight": [
            "interpolate",
            ["linear"],
            ["get", "score"],
            0, 0.5,
            1000, 2  // Live events have more weight
          ],
          // Increase intensity as zoom level increases
          "heatmap-intensity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0, 0.5,
            15, 1.5
          ],
          // Color ramp: cool (few events) to warm (many events)
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0, "rgba(33,102,172,0)",
            0.2, "rgb(103,169,207)",
            0.4, "rgb(209,229,240)",
            0.6, "rgb(253,219,199)",
            0.8, "rgb(239,138,98)",
            0.9, "rgb(255,201,101)",
            1, "rgb(178,24,43)"
          ],
          // Adjust radius by zoom level
          "heatmap-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0, 2,
            15, 20
          ],
          // Fade out heatmap at high zoom levels
          "heatmap-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            7, 0.8,
            15, 0.3
          ]
        },
        layout: {
          visibility: "none" // Hidden by default
        }
      });

      // Large clusters (200+ events) - biggest circles
      map.addLayer({
        id: "clusters-large",
        type: "circle",
        source: "events",
        filter: ["all", ["has", "point_count"], [">=", ["get", "point_count"], 200]],
        paint: {
          "circle-color": "#e8e8ee",
          "circle-radius": 38,
          "circle-stroke-color": "#cfcfda",
          "circle-stroke-width": 2
        }
      });

      // Medium clusters (50-199 events)
      map.addLayer({
        id: "clusters-medium",
        type: "circle",
        source: "events",
        filter: ["all", ["has", "point_count"], [">=", ["get", "point_count"], 50], ["<", ["get", "point_count"], 200]],
        paint: {
          "circle-color": "#e8e8ee",
          "circle-radius": 28,
          "circle-stroke-color": "#cfcfda",
          "circle-stroke-width": 2
        }
      });

      // Small clusters (10-49 events)
      map.addLayer({
        id: "clusters-small",
        type: "circle",
        source: "events",
        filter: ["all", ["has", "point_count"], [">=", ["get", "point_count"], 10], ["<", ["get", "point_count"], 50]],
        paint: {
          "circle-color": "#e8e8ee",
          "circle-radius": 22,
          "circle-stroke-color": "#cfcfda",
          "circle-stroke-width": 2
        }
      });

      // Tiny clusters (2-9 events) - show category hints with colored segments
      map.addLayer({
        id: "clusters-tiny",
        type: "circle",
        source: "events",
        filter: ["all", ["has", "point_count"], ["<", ["get", "point_count"], 10]],
        paint: {
          "circle-color": "#e8e8ee",
          "circle-radius": 18,
          "circle-stroke-color": "#cfcfda",
          "circle-stroke-width": 2
        }
      });

      // Cluster count labels
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "events",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
          "text-size": [
            "step",
            ["get", "point_count"],
            13,    // <50 events
            50, 15,  // 50-199
            200, 18  // 200+
          ]
        },
        paint: { 
          "text-color": "#333",
          "text-halo-color": "#fff",
          "text-halo-width": 1
        }
      });

      // Unclustered hotspots with category-based colors and size by distance
      map.addLayer({
        id: "unclustered",
        type: "circle",
        source: "events",
        filter: ["all", ["!", ["has", "point_count"]], ["!=", ["get", "id"], ["literal", selectedEventId ?? "___none___"]], ["!=", ["get", "isLive"], true]],
        paint: {
          "circle-color": [
            "match",
            ["get", "category"],
            "music", "#ff3b3b",      // Red for music
            "nightlife", "#ff3b3b",  // Red for nightlife
            "food", "#ffa726",       // Orange/Yellow for food
            "arts", "#42a5f5",       // Blue for arts/culture
            "sports", "#66bb6a",     // Green for sports/outdoors
            "family", "#66bb6a",     // Green for family
            "tech", "#9c27b0",       // Purple for tech
            "#999999"                // Gray for other
          ],
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["get", "score"],
            0, 5,      // Low score = smaller
            500, 7,    // Medium score
            1000, 9    // High score = bigger
          ],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.5,
          // Smooth transitions for filtering/appearance
          "circle-radius-transition": { duration: 300, delay: 0 },
          "circle-opacity-transition": { duration: 300, delay: 0 }
        }
      });

      // Selected marker (highlighted with larger stroke)
      map.addLayer({
        id: "unclustered-selected",
        type: "circle",
        source: "events",
        filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "id"], ["literal", selectedEventId ?? "___none___"]], ["!=", ["get", "isLive"], true]],
        paint: {
          "circle-color": [
            "match",
            ["get", "category"],
            "music", "#ff3b3b",
            "nightlife", "#ff3b3b",
            "food", "#ffa726",
            "arts", "#42a5f5",
            "sports", "#66bb6a",
            "family", "#66bb6a",
            "tech", "#9c27b0",
            "#999999"
          ],
          "circle-radius": 11,  // Slightly bigger for "grow" effect
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 3,
          // Smooth grow animation when selected
          "circle-radius-transition": { duration: 150, delay: 0 },
          "circle-stroke-width-transition": { duration: 150, delay: 0 }
        }
      });

      // LIVE markers: animated glow ring (always red with pulse)
      map.addLayer({
        id: "live-glow",
        type: "circle",
        source: "events",
        filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "isLive"], true]],
        paint: {
          "circle-color": "#ff3b3b",
          "circle-opacity": 0.35,
          "circle-radius": 14,
          "circle-blur": 0.6
        }
      });

      // LIVE markers: solid dot on top (category colored but brighter)
      map.addLayer({
        id: "live-dot",
        type: "circle",
        source: "events",
        filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "isLive"], true]],
        paint: {
          "circle-color": [
            "match",
            ["get", "category"],
            "music", "#ff1744",      // Bright red for music
            "nightlife", "#ff1744",  // Bright red for nightlife
            "food", "#ff9800",       // Bright orange for food
            "arts", "#2196f3",       // Bright blue for arts
            "sports", "#4caf50",     // Bright green for sports
            "family", "#4caf50",     // Bright green for family
            "tech", "#ab47bc",       // Bright purple for tech
            "#ff3b3b"                // Default bright red
          ],
          "circle-radius": 7,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
          // Smooth transitions
          "circle-radius-transition": { duration: 300, delay: 0 },
          "circle-opacity-transition": { duration: 300, delay: 0 }
        }
      });

      // Load category icons BEFORE adding icon layers
      loadMapIcons(map).then(() => {
        console.log('Category icons loaded successfully');
        
        // CATEGORY ICON LAYERS - Show emoji/icon on top of markers
        // Icon for regular (non-live, non-selected) events
        map.addLayer({
          id: "event-icons",
          type: "symbol",
          source: "events",
          filter: ["all", ["!", ["has", "point_count"]], ["!=", ["get", "id"], ["literal", selectedEventId ?? "___none___"]], ["!=", ["get", "isLive"], true]],
          layout: {
            "icon-image": ["get", "iconKey"],
            "icon-size": 0.6,
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            "icon-anchor": "bottom"
          }
        });

        // Icon for selected events
        map.addLayer({
          id: "event-icons-selected",
          type: "symbol",
          source: "events",
          filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "id"], ["literal", selectedEventId ?? "___none___"]], ["!=", ["get", "isLive"], true]],
          layout: {
            "icon-image": ["get", "iconKey"],
            "icon-size": 0.7,
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            "icon-anchor": "bottom"
          }
        });

        // Icon for LIVE events
        map.addLayer({
          id: "event-icons-live",
          type: "symbol",
          source: "events",
          filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "isLive"], true]],
          layout: {
            "icon-image": ["get", "iconKey"],
            "icon-size": 0.65,
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            "icon-anchor": "bottom"
          }
        });
      }).catch((err) => {
        console.error('Failed to load category icons:', err);
      });

      // Start glow animation
      let t = 0;
      const tick = () => {
        t += 0.04;
        const r = 12 + 6 * (0.5 + 0.5 * Math.sin(t));     // 12..18
        const a = 0.20 + 0.20 * (0.5 + 0.5 * Math.sin(t)); // 0.2..0.4
        try {
          if (map.getLayer("live-glow")) {
            map.setPaintProperty("live-glow", "circle-radius", r);
            map.setPaintProperty("live-glow", "circle-opacity", a);
          }
        } catch {}
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      // Optional: 3D buildings if vector data includes them
      if (map.getLayer("building")) {
        map.setPaintProperty("building", "fill-extrusion-color", "#e6e6ec");
        map.setPaintProperty("building", "fill-extrusion-height", ["get", "render_height"]);
        map.setPaintProperty("building", "fill-extrusion-base", ["get", "render_min_height"]);
        map.setPaintProperty("building", "fill-extrusion-opacity", 0.7);
      }

      // Click: cluster → zoom in; point → popup
      const clusterLayers = ["clusters-large", "clusters-medium", "clusters-small", "clusters-tiny"];
      
      clusterLayers.forEach(layerId => {
        map.on("click", layerId, (e:any) => {
          const features = map.queryRenderedFeatures(e.point, { layers: [layerId] });
          if (!features.length) return;
          const clusterId = features[0].properties.cluster_id;
          (map.getSource("events") as any).getClusterExpansionZoom(clusterId, (err: any, z: number) => {
            if (err) return;
            map.easeTo({ center: (features[0].geometry as any).coordinates, zoom: z + 0.5, duration: 500 });
          });
        });
      });

      map.on("click", "unclustered", (e:any) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f?.properties || {};
        const coords = (f?.geometry as any).coordinates;
        
        createEventPopup(map, coords, p);
        
        // Notify parent of marker click
        if (onMarkerClick && p.id) {
          onMarkerClick(String(p.id));
        }
      });

      // Also handle clicks on selected markers
      map.on("click", "unclustered-selected", (e:any) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f?.properties || {};
        const coords = (f?.geometry as any).coordinates;
        
        createEventPopup(map, coords, p);
        
        if (onMarkerClick && p.id) {
          onMarkerClick(String(p.id));
        }
      });

      // Handle clicks on LIVE markers - zoom in and highlight
      map.on("click", "live-dot", (e:any) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f?.properties || {};
        const coords = (f?.geometry as any).coordinates;
        
        // Smooth zoom to the live event (zoom 16.5 for detailed view)
        map.easeTo({
          center: coords,
          zoom: 16.5,
          duration: 800,
          pitch: 50,
          bearing: map.getBearing() // Keep current rotation
        });
        
        // Wait for zoom animation, then show popup
        setTimeout(() => {
          createEventPopup(map, coords, p);
        }, 400);
        
        // Notify parent to highlight the event card (triggers scroll + pulse)
        if (onMarkerClick && p.id) {
          onMarkerClick(String(p.id));
        }
      });

      // Cursor feedback
      ["clusters-large", "clusters-medium", "clusters-small", "clusters-tiny", "unclustered", "unclustered-selected", "live-dot"].forEach((layer) => {
        map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
      });

      // Hover tooltips for event markers (mini preview)
      let hoverTooltip: maplibregl.Popup | null = null;
      
      const createHoverTooltip = (e: any, layerId: string) => {
        const features = map.queryRenderedFeatures(e.point, { layers: [layerId] });
        if (!features.length || features[0].properties.point_count) return; // Skip clusters
        
        const p = features[0].properties;
        const coords = (features[0].geometry as any).coordinates.slice();
        
        // Create lightweight tooltip HTML
        const time = formatEventTime(p.time);
        const priceIcon = p.price === "free" ? "🆓" : "💳";
        const liveTag = p.isLive ? '<span style="background: #ff3b3b; color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; margin-left: 4px;">LIVE</span>' : '';
        
        const tooltipHTML = `
          <div style="font-size: 13px; max-width: 200px;">
            <div style="font-weight: 600; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
              ${p.title}${liveTag}
            </div>
            <div style="color: #666; font-size: 11px;">
              ${time || p.category} ${priceIcon}
            </div>
            <div style="color: #999; font-size: 10px; margin-top: 4px; font-style: italic;">
              Tap for details
            </div>
          </div>
        `;
        
        // Remove existing hover tooltip
        if (hoverTooltip) {
          hoverTooltip.remove();
        }
        
        // Create new hover tooltip
        hoverTooltip = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: [0, -10],
          className: 'hover-tooltip',
          maxWidth: '250px'
        })
          .setLngLat(coords)
          .setHTML(tooltipHTML)
          .addTo(map);
      };
      
      const removeHoverTooltip = () => {
        if (hoverTooltip) {
          hoverTooltip.remove();
          hoverTooltip = null;
        }
      };
      
      // Add hover handlers to marker layers
      ["unclustered", "unclustered-selected", "live-dot"].forEach((layer) => {
        map.on("mouseenter", layer, (e) => createHoverTooltip(e, layer));
        map.on("mousemove", layer, (e) => createHoverTooltip(e, layer)); // Update position on move
        map.on("mouseleave", layer, removeHoverTooltip);
        map.on("click", layer, removeHoverTooltip); // Remove on click to show full popup
      });

      // Report bounds → parent (for bbox fetch)
      const emitBounds = () => {
        const b = map.getBounds();
        const out: Bounds = { minLon: b.getWest(), minLat: b.getSouth(), maxLon: b.getEast(), maxLat: b.getNorth() };
        onBoundsChange(out);
      };
      
      // Track map movement to show "Search this area" button
      map.on("movestart", () => {
        // Check if map has moved significantly from initial position
        const currentCenter = map.getCenter();
        const distanceFromInit = Math.abs(currentCenter.lng - initialCenterRef.current[0]) + 
                                 Math.abs(currentCenter.lat - initialCenterRef.current[1]);
        if (distanceFromInit > 0.01) { // ~1km threshold
          setShowSearchButton(true);
        }
      });
      
      map.on("moveend", emitBounds);
      emitBounds();
    });

    // Handle geolocation success - recenter and zoom to user location with 2km radius
    map.on("geolocate", (e: any) => {
      const lat = e.coords.latitude;
      const lng = e.coords.longitude;
      const heading = typeof e.coords.heading === "number" ? e.coords.heading : null;
      
      console.log('Geolocation success:', { lat, lng, heading });
      
      // Update/create the pulsing marker at user location
      const marker = ensureGeoMarker(map);
      marker.setLngLat([lng, lat]);
      
      // Update heading cone if available
      setHeadingDeg(heading);
      
      // Add 2km radius circle around user location
      if (!map.getSource("user-radius")) {
        map.addSource("user-radius", {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [lng, lat]
            },
            properties: {}
          } as any
        });
        
        // Add circle layer (2km radius = ~2000m at this zoom)
        map.addLayer({
          id: "user-radius-circle",
          type: "circle",
          source: "user-radius",
          paint: {
            "circle-radius": [
              "interpolate",
              ["exponential", 2],
              ["zoom"],
              10, 5,
              14, 80,
              16, 320
            ],
            "circle-color": "#2196f3",
            "circle-opacity": 0.1,
            "circle-stroke-color": "#2196f3",
            "circle-stroke-width": 2,
            "circle-stroke-opacity": 0.4
          }
        }, "clusters"); // Add below clusters so it doesn't cover markers
      } else {
        // Update existing circle position
        (map.getSource("user-radius") as any).setData({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [lng, lat]
          },
          properties: {}
        });
      }
      
      // Zoom closer to show ~2km area (zoom 14-15 shows roughly 2-3km radius)
      map.easeTo({ 
        center: [lng, lat], 
        zoom: 14.5, 
        duration: 900, 
        pitch: 45 
      });
      
      // Emit bounds after the animation completes
      setTimeout(() => {
        const b = map.getBounds();
        onBoundsChange({ 
          minLon: b.getWest(), 
          minLat: b.getSouth(), 
          maxLon: b.getEast(), 
          maxLat: b.getNorth() 
        });
      }, 950);
    });

    // Handle geolocation errors (permission denied, etc.) - just continue with Helsinki center
    map.on("error", (err: any) => {
      if (err?.error?.code === 1) {
        console.log('Geolocation permission denied, staying at Helsinki center');
      } else if (err?.error) {
        console.warn('Geolocation error:', err.error);
      }
    });

    return () => { 
      console.log('Cleaning up map');
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      if (geoMarkerRef.current) {
        geoMarkerRef.current.remove();
        geoMarkerRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove(); 
        mapRef.current = null;
      }
      isInitializingRef.current = false;
    };
  }, []);

  // Refresh LIVE status every 60 seconds
  useEffect(() => {
    const id = setInterval(() => {
      const map = mapRef.current;
      if (!map || !map.getSource("events")) return;
      
      const now = Date.now();
      const geoLive = eventsToGeoJSON(events as any, now);
      console.log('Refreshing LIVE status');
      (map.getSource("events") as any).setData(geoLive);
    }, 60_000);
    
    return () => clearInterval(id);
  }, [events]);

  // Update layer filters when selectedEventId changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    
    const unclusteredFilter: any = ["all", 
      ["!", ["has", "point_count"]], 
      ["!=", ["get", "id"], ["literal", selectedEventId ?? "___none___"]]
    ];
    const selectedFilter: any = ["all", 
      ["!", ["has", "point_count"]], 
      ["==", ["get", "id"], ["literal", selectedEventId ?? "___none___"]]
    ];
    
    if (map.getLayer("unclustered")) {
      map.setFilter("unclustered", unclusteredFilter);
    }
    if (map.getLayer("unclustered-selected")) {
      map.setFilter("unclustered-selected", selectedFilter);
    }
  }, [selectedEventId]);

  // Update data when events change (but not style)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource("events")) return;
    (map.getSource("events") as any).setData(geo);
  }, [geo]);

  // Toggle heatmap visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer("events-heatmap")) return;
    
    map.setLayoutProperty(
      "events-heatmap",
      "visibility",
      heatmapMode ? "visible" : "none"
    );
  }, [heatmapMode]);

  // Toggle 3D buildings visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer("building")) return;
    
    if (show3DBuildings) {
      // Show buildings with extrusion
      const isDark = currentThemeRef.current === "dark";
      map.setPaintProperty("building", "fill-extrusion-height", ["get", "render_height"]);
      map.setPaintProperty("building", "fill-extrusion-base", ["get", "render_min_height"]);
      map.setPaintProperty("building", "fill-extrusion-opacity", isDark ? 0.8 : 0.7);
    } else {
      // Hide buildings by setting height to 0
      map.setPaintProperty("building", "fill-extrusion-height", 0);
      map.setPaintProperty("building", "fill-extrusion-base", 0);
      map.setPaintProperty("building", "fill-extrusion-opacity", 0);
    }
  }, [show3DBuildings]);

  // Handle manual theme override changes ONLY
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || themeOverride === undefined) return;
    
    const newTheme = themeOverride;
    
    // Skip if already on this theme
    if (currentThemeRef.current === newTheme) {
      return;
    }
    
    // Clear any pending theme change
    if (themeChangeTimeoutRef.current) {
      clearTimeout(themeChangeTimeoutRef.current);
    }
    
    // Debounce theme changes to prevent flickering in Safari
    themeChangeTimeoutRef.current = setTimeout(() => {
      console.log('Manual theme change to', newTheme);
      currentThemeRef.current = newTheme;
      
      const isDark = newTheme === "dark";
      const newStyle = isDark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;
      const data = (map.getSource("events") as any)?._data || geo;
      
      console.log('Switching style, data available:', !!data);
    
      map.setStyle(newStyle);
    
      map.once("styledata", () => {
        console.log('Style loaded, re-adding layers. Source exists:', !!map.getSource("events"), 'Data available:', !!data, 'Data features:', data?.features?.length);
        if (!map.getSource("events") && data) {
          map.addSource("events", { 
            type: "geojson", 
            data, 
            cluster: true, 
            clusterRadius: 40, 
            clusterMaxZoom: 14 
          });
          
          if (!map.getLayer("clusters")) {
            map.addLayer({ 
              id: "clusters", 
              type: "circle", 
              source: "events", 
              filter: ["has","point_count"],
              paint: { 
                "circle-color": isDark ? "#3a3a44" : "#e8e8ee", 
                "circle-radius": ["step",["get","point_count"],16,50,22,200,28],
                "circle-stroke-color": isDark ? "#555560" : "#cfcfda",
                "circle-stroke-width": 1 
              }
            });
          }
          
          if (!map.getLayer("cluster-count")) {
            map.addLayer({ 
              id: "cluster-count", 
              type: "symbol", 
              source: "events", 
              filter: ["has","point_count"],
              layout: { 
                "text-field": ["get","point_count_abbreviated"], 
                "text-size": 12 
              },
              paint: { "text-color": isDark ? "#eee" : "#333" }
            });
          }
          
          if (!map.getLayer("unclustered")) {
            console.log('Adding unclustered layer in', isDark ? 'dark' : 'light', 'mode');
            map.addLayer({ 
              id: "unclustered", 
              type: "circle", 
              source: "events", 
              filter: ["all", ["!",["has","point_count"]], ["!=", ["get", "id"], ["literal", selectedEventId ?? "___none___"]], ["!=", ["get", "isLive"], true]] as any,
              paint: { 
                "circle-color": [
                  "match",
                  ["get", "category"],
                  "music", "#ff3b3b",
                  "nightlife", "#ff3b3b",
                  "food", "#ffa726",
                  "arts", "#42a5f5",
                  "sports", "#66bb6a",
                  "family", "#66bb6a",
                  "tech", "#9c27b0",
                  "#999999"
                ] as any,
                "circle-radius": [
                  "interpolate",
                  ["linear"],
                  ["get", "score"],
                  0, 5,
                  500, 7,
                  1000, 9
                ] as any,
                "circle-stroke-color":"#ffffff",
                "circle-stroke-width":1.5 
              }
            });
          }
          
          if (!map.getLayer("unclustered-selected")) {
            map.addLayer({ 
              id: "unclustered-selected", 
              type: "circle", 
              source: "events", 
              filter: ["all", ["!",["has","point_count"]], ["==", ["get", "id"], ["literal", selectedEventId ?? "___none___"]], ["!=", ["get", "isLive"], true]] as any,
              paint: { 
                "circle-color": [
                  "match",
                  ["get", "category"],
                  "music", "#ff3b3b",
                  "nightlife", "#ff3b3b",
                  "food", "#ffa726",
                  "arts", "#42a5f5",
                  "sports", "#66bb6a",
                  "family", "#66bb6a",
                  "tech", "#9c27b0",
                  "#999999"
                ] as any,
                "circle-radius":11,
                "circle-stroke-color":"#ffffff",
                "circle-stroke-width":3 
              }
            });
          }
          
          if (!map.getLayer("live-glow")) {
            map.addLayer({
              id: "live-glow",
              type: "circle",
              source: "events",
              filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "isLive"], true]],
              paint: {
                "circle-color": "#ff3b3b",
                "circle-opacity": 0.35,
                "circle-radius": 14,
                "circle-blur": 0.6
              }
            });
          }
          
          if (!map.getLayer("live-dot")) {
            map.addLayer({
              id: "live-dot",
              type: "circle",
              source: "events",
              filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "isLive"], true]],
              paint: {
                "circle-color": [
                  "match",
                  ["get", "category"],
                  "music", "#ff1744",
                  "nightlife", "#ff1744",
                  "food", "#ff9800",
                  "arts", "#2196f3",
                  "sports", "#4caf50",
                  "family", "#4caf50",
                  "tech", "#ab47bc",
                  "#ff3b3b"
                ] as any,
                "circle-radius": 7,
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": 2
              }
            });
          }
          
          // Re-load map icons and add icon layers (async, but doesn't block)
          loadMapIcons(map).then(() => {
            if (!map.getLayer("event-icons")) {
              map.addLayer({
                id: "event-icons",
                type: "symbol",
                source: "events",
                filter: ["all", ["!", ["has", "point_count"]], ["!=", ["get", "id"], ["literal", selectedEventId ?? "___none___"]], ["!=", ["get", "isLive"], true]],
                layout: {
                  "icon-image": ["get", "iconKey"],
                  "icon-size": 0.6,
                  "icon-allow-overlap": true,
                  "icon-ignore-placement": true,
                  "icon-anchor": "bottom"
                }
              });
            }

            if (!map.getLayer("event-icons-selected")) {
              map.addLayer({
                id: "event-icons-selected",
                type: "symbol",
                source: "events",
                filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "id"], ["literal", selectedEventId ?? "___none___"]], ["!=", ["get", "isLive"], true]],
                layout: {
                  "icon-image": ["get", "iconKey"],
                  "icon-size": 0.7,
                  "icon-allow-overlap": true,
                  "icon-ignore-placement": true,
                  "icon-anchor": "bottom"
                }
              });
            }

            if (!map.getLayer("event-icons-live")) {
              map.addLayer({
                id: "event-icons-live",
                type: "symbol",
                source: "events",
                filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "isLive"], true]],
                layout: {
                  "icon-image": ["get", "iconKey"],
                  "icon-size": 0.65,
                  "icon-allow-overlap": true,
                  "icon-ignore-placement": true,
                  "icon-anchor": "bottom"
                }
              });
            }
          }).catch(err => console.error("Failed to load icons after style change:", err));
        }  // end of: if (!map.getSource("events") && data)
        
        if (map.getLayer("building")) {
          map.setPaintProperty("building", "fill-extrusion-color", isDark ? "#2a2a33" : "#e6e6ec");
          map.setPaintProperty("building", "fill-extrusion-height", ["get", "render_height"]);
          map.setPaintProperty("building", "fill-extrusion-base", ["get", "render_min_height"]);
          map.setPaintProperty("building", "fill-extrusion-opacity", isDark ? 0.8 : 0.7);
        }
        
        const clusterLayersTheme = ["clusters-large", "clusters-medium", "clusters-small", "clusters-tiny", "clusters"];
        clusterLayersTheme.forEach(layerId => {
          map.on("click", layerId, (ev:any) => {
            const features = map.queryRenderedFeatures(ev.point, { layers: [layerId] });
            if (!features.length) return;
            const clusterId = features[0].properties.cluster_id;
            (map.getSource("events") as any).getClusterExpansionZoom(clusterId, (err: any, z: number) => {
              if (err) return;
              map.easeTo({ center: (features[0].geometry as any).coordinates, zoom: z + 0.5, duration: 500 });
            });
          });
        });
        
        map.on("click", "unclustered", (ev:any) => {
          const f = ev.features?.[0];
          if (!f) return;
          const p = f?.properties || {};
          const coords = (f?.geometry as any).coordinates;
          
          createEventPopup(map, coords, p);
          
          if (onMarkerClick && p.id) {
            onMarkerClick(String(p.id));
          }
        });
        
        map.on("click", "unclustered-selected", (ev:any) => {
          const f = ev.features?.[0];
          if (!f) return;
          const p = f?.properties || {};
          const coords = (f?.geometry as any).coordinates;
          
          createEventPopup(map, coords, p);
          
          if (onMarkerClick && p.id) {
            onMarkerClick(String(p.id));
          }
        });
        
        map.on("click", "live-dot", (ev:any) => {
          const f = ev.features?.[0];
          if (!f) return;
          const p = f?.properties || {};
          const coords = (f?.geometry as any).coordinates;
          
          // Smooth zoom to the live event
          map.easeTo({
            center: coords,
            zoom: 16.5,
            duration: 800,
            pitch: 50,
            bearing: map.getBearing()
          });
          
          setTimeout(() => {
            createEventPopup(map, coords, p);
          }, 400);
          
          if (onMarkerClick && p.id) {
            onMarkerClick(String(p.id));
          }
        });
        
        ["clusters-large", "clusters-medium", "clusters-small", "clusters-tiny", "clusters", "unclustered", "unclustered-selected", "live-dot"].forEach((layer) => {
          map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
          map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
        });
      });  // closes map.once("styledata")
    }, 50); // 50ms debounce
    
    return () => {
      if (themeChangeTimeoutRef.current) {
        clearTimeout(themeChangeTimeoutRef.current);
      }
    };
  }, [themeOverride]);

  // Handle OS theme changes (only when no manual override)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || themeOverride !== undefined) return;

    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    
    const onChange = (e: MediaQueryListEvent) => {
      const newTheme = e.matches ? "dark" : "light";
      
      // Skip if already on this theme
      if (currentThemeRef.current === newTheme) return;
      
      console.log('OS theme change to', newTheme);
      currentThemeRef.current = newTheme;
      
      const isDark = e.matches;
      const newStyle = isDark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;
      const data = (map.getSource("events") as any)?._data || geo;
      
      console.log('Switching style (OS theme), data available:', !!data);
      
      map.setStyle(newStyle);
      
      map.once("styledata", () => {
        console.log('Style loaded (OS theme), re-adding layers');
        if (!map.getSource("events") && data) {
          map.addSource("events", { 
            type: "geojson", 
            data, 
            cluster: true, 
            clusterRadius: 40, 
            clusterMaxZoom: 14 
          });
          
          if (!map.getLayer("clusters")) {
            map.addLayer({ 
              id: "clusters", 
              type: "circle", 
              source: "events", 
              filter: ["has","point_count"],
              paint: { 
                "circle-color": isDark ? "#3a3a44" : "#e8e8ee", 
                "circle-radius": ["step",["get","point_count"],16,50,22,200,28],
                "circle-stroke-color": isDark ? "#555560" : "#cfcfda",
                "circle-stroke-width": 1 
              }
            });
          }
          
          if (!map.getLayer("cluster-count")) {
            map.addLayer({ 
              id: "cluster-count", 
              type: "symbol", 
              source: "events", 
              filter: ["has","point_count"],
              layout: { 
                "text-field": ["get","point_count_abbreviated"], 
                "text-size": 12 
              },
              paint: { "text-color": isDark ? "#eee" : "#333" }
            });
          }
          
          if (!map.getLayer("unclustered")) {
            map.addLayer({ 
              id: "unclustered", 
              type: "circle", 
              source: "events", 
              filter: ["all", ["!",["has","point_count"]], ["!=", ["get", "id"], ["literal", selectedEventId ?? "___none___"]]] as any,
              paint: { 
                "circle-color":"#ff3b3b",
                "circle-radius":6,
                "circle-stroke-color":"#ffffff",
                "circle-stroke-width":1.5 
              }
            });
          }
          
          if (!map.getLayer("unclustered-selected")) {
            map.addLayer({ 
              id: "unclustered-selected", 
              type: "circle", 
              source: "events", 
              filter: ["all", ["!",["has","point_count"]], ["==", ["get", "id"], ["literal", selectedEventId ?? "___none___"]]] as any,
              paint: { 
                "circle-color":"#ff3b3b",
                "circle-radius":8,
                "circle-stroke-color":"#ffffff",
                "circle-stroke-width":3 
              }
            });
          }
          
          if (!map.getLayer("live-glow")) {
            map.addLayer({
              id: "live-glow",
              type: "circle",
              source: "events",
              filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "isLive"], true]],
              paint: {
                "circle-color": "#ff3b3b",
                "circle-opacity": 0.35,
                "circle-radius": 14,
                "circle-blur": 0.6
              }
            });
          }
          
          if (!map.getLayer("live-dot")) {
            map.addLayer({
              id: "live-dot",
              type: "circle",
              source: "events",
              filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "isLive"], true]],
              paint: {
                "circle-color": "#ff3b3b",
                "circle-radius": 6,
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": 1.5
              }
            });
          }
          
          if (map.getLayer("building")) {
            map.setPaintProperty("building", "fill-extrusion-color", isDark ? "#2a2a33" : "#e6e6ec");
            map.setPaintProperty("building", "fill-extrusion-height", ["get", "render_height"]);
            map.setPaintProperty("building", "fill-extrusion-base", ["get", "render_min_height"]);
            map.setPaintProperty("building", "fill-extrusion-opacity", isDark ? 0.8 : 0.7);
          }
          
          const clusterLayersTheme2 = ["clusters-large", "clusters-medium", "clusters-small", "clusters-tiny", "clusters"];
          clusterLayersTheme2.forEach(layerId => {
            map.on("click", layerId, (ev:any) => {
              const features = map.queryRenderedFeatures(ev.point, { layers: [layerId] });
              if (!features.length) return;
              const clusterId = features[0].properties.cluster_id;
              (map.getSource("events") as any).getClusterExpansionZoom(clusterId, (err: any, z: number) => {
                if (err) return;
                map.easeTo({ center: (features[0].geometry as any).coordinates, zoom: z + 0.5, duration: 500 });
              });
            });
          });
          
          map.on("click", "unclustered", (ev:any) => {
            const f = ev.features?.[0];
            if (!f) return;
            const p = f?.properties || {};
            const coords = (f?.geometry as any).coordinates;
            
            createEventPopup(map, coords, p);
            
            if (onMarkerClick && p.id) {
              onMarkerClick(String(p.id));
            }
          });
          
          map.on("click", "unclustered-selected", (ev:any) => {
            const f = ev.features?.[0];
            if (!f) return;
            const p = f?.properties || {};
            const coords = (f?.geometry as any).coordinates;
            
            createEventPopup(map, coords, p);
            
            if (onMarkerClick && p.id) {
              onMarkerClick(String(p.id));
            }
          });
          
          map.on("click", "live-dot", (ev:any) => {
            const f = ev.features?.[0];
            if (!f) return;
            const p = f?.properties || {};
            const coords = (f?.geometry as any).coordinates;
            
            // Smooth zoom to the live event
            map.easeTo({
              center: coords,
              zoom: 16.5,
              duration: 800,
              pitch: 50,
              bearing: map.getBearing()
            });
            
            setTimeout(() => {
              createEventPopup(map, coords, p);
            }, 400);
            
            if (onMarkerClick && p.id) {
              onMarkerClick(String(p.id));
            }
          });
          
          ["clusters-large", "clusters-medium", "clusters-small", "clusters-tiny", "clusters", "unclustered", "unclustered-selected", "live-dot"].forEach((layer) => {
            map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
            map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
          });
        }
      });
    };
    
    mq?.addEventListener?.("change", onChange);
    return () => mq?.removeEventListener?.("change", onChange);
  }, [themeOverride]);

  return (
    <div style={{ position: "relative" }}>
      <div ref={containerRef} style={{ height: "70vh", width: "100%", borderRadius: 12 }} />
      
      {/* Search this area button (Airbnb-style) */}
      {showSearchButton && (
        <button
          onClick={() => {
            // Trigger bounds change which will refetch events in new area
            const b = mapRef.current?.getBounds();
            if (b) {
              const out: Bounds = { 
                minLon: b.getWest(), 
                minLat: b.getSouth(), 
                maxLon: b.getEast(), 
                maxLat: b.getNorth() 
              };
              onBoundsChange(out);
            }
            setShowSearchButton(false);
            initialCenterRef.current = mapRef.current?.getCenter().toArray() as [number, number] || center;
          }}
          style={{
            position: "absolute",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10,
            padding: "10px 20px",
            background: "#fff",
            color: "#333",
            border: "1px solid #ddd",
            borderRadius: 24,
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 14,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            animation: "slideDown 0.3s ease-out"
          }}
        >
          🔄 Search this area
        </button>
      )}
      
      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `}</style>
      
      {/* Re-center button moved to App.tsx as floating button */}
    </div>
  );
});

export default MapGL;
