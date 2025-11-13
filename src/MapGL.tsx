import React, { useEffect, useMemo, useRef, useImperativeHandle, forwardRef } from "react";
import { createRoot, Root } from "react-dom/client";
import maplibregl, { Map as MLMap, LngLatBoundsLike } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_STYLE_LIGHT, MAP_STYLE_DARK } from "./mapStyle";
import { VenueDetails } from "../components/VenueDetails";

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
};
type Bounds = { minLon:number; minLat:number; maxLon:number; maxLat:number };

function isLiveNow(e: Ev, now = Date.now()) {
  const s = e.start ? Date.parse(e.start) : NaN;
  const hasEnd = !!e.end;
  const en = hasEnd ? Date.parse(e.end!) : (isFinite(s) ? s + 6*60*60*1000 : NaN); // +6h fallback
  return isFinite(s) && isFinite(en) && s <= now && now <= en;
}

function eventsToGeoJSON(events: Ev[], now = Date.now()) {
  return {
    type: "FeatureCollection",
    features: (events || [])
      .filter((e) => e.lat !== null && e.lng !== null)
      .map((e: Ev) => ({
        type: "Feature",
        properties: { 
          id: e.id, 
          title: e.title, 
          category: e.category, 
          price: e.price, 
          time: e.time || "", 
          website: e.website || "",
          isLive: isLiveNow(e, now)
        },
        geometry: { type: "Point", coordinates: [e.lng!, e.lat!] }
      }))
  } as any;
}

export type MapGLHandle = {
  flyToEvent: (id: string, opts?: { zoom?: number; openPopup?: boolean }) => void;
};

const MapGL = forwardRef<MapGLHandle, {
  events: Ev[];
  onBoundsChange: (b: Bounds) => void;
  onMarkerClick?: (id: string) => void;
  selectedEventId?: string;
  center?: [number, number];
  zoom?: number;
  themeOverride?: "light" | "dark";
}>(function MapGL({ events, onBoundsChange, onMarkerClick, selectedEventId, center = [24.9384, 60.1699], zoom = 12, themeOverride }, ref) {
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

  const geo = useMemo(() => eventsToGeoJSON(events as any, Date.now()), [events]);
  
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
    
    // Create popup container
    const popupContainer = document.createElement("div");
    popupContainer.style.minWidth = "220px";
    
    // Add static content
    popupContainer.innerHTML = `
      <div>
        <strong>${properties.title || "Event"}</strong>${badge}
        <div style="font-size:12px;color:#666;margin-top:4px">${properties.category} • ${properties.price}${properties.time ? " • " + String(properties.time).slice(0,16) : ""}</div>
        ${properties.website ? `<div style="margin-top:6px"><a href="${properties.website}" target="_blank" rel="noreferrer" style="color:#007aff">More Info</a></div>` : ""}
      </div>
      <div id="venue-details-container"></div>
    `;
    
    // Create popup
    const popup = new maplibregl.Popup({ closeButton: true })
      .setLngLat(coords)
      .setDOMContent(popupContainer)
      .addTo(map);
    
    popupRef.current = popup;
    
    // Render VenueDetails component
    const venueContainer = popupContainer.querySelector("#venue-details-container");
    if (venueContainer && properties.title && coords[1] && coords[0]) {
      popupRootRef.current = createRoot(venueContainer);
      popupRootRef.current.render(
        <VenueDetails 
          venueName={properties.title} 
          lat={coords[1]} 
          lng={coords[0]} 
        />
      );
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
          isLive: isLiveNow(ev, Date.now())
        });
      }
      
      // Sync selection state
      if (onMarkerClick) {
        onMarkerClick(id);
      }
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
      
      // Clustering source
      map.addSource("events", {
        type: "geojson",
        data: geo,
        cluster: true,
        clusterRadius: 40,
        clusterMaxZoom: 14
      });

      // Cluster circles (soft gray)
      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "events",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#e8e8ee",
          "circle-radius": ["step", ["get", "point_count"], 16, 50, 22, 200, 28],
          "circle-stroke-color": "#cfcfda",
          "circle-stroke-width": 1
        }
      });

      // Cluster labels
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "events",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 12
        },
        paint: { "text-color": "#333" }
      });

      // Unclustered hotspots (Apple-like red) - non-selected
      map.addLayer({
        id: "unclustered",
        type: "circle",
        source: "events",
        filter: ["all", ["!", ["has", "point_count"]], ["!=", ["get", "id"], ["literal", selectedEventId ?? "___none___"]]],
        paint: {
          "circle-color": "#ff3b3b",
          "circle-radius": 6,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.5
        }
      });

      // Selected marker (highlighted with larger stroke)
      map.addLayer({
        id: "unclustered-selected",
        type: "circle",
        source: "events",
        filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "id"], ["literal", selectedEventId ?? "___none___"]]],
        paint: {
          "circle-color": "#ff3b3b",
          "circle-radius": 8,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 3
        }
      });

      // LIVE markers: animated glow ring
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

      // LIVE markers: solid dot on top
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
      map.on("click", "clusters", (e:any) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ["clusters"] });
        const clusterId = features[0].properties.cluster_id;
        (map.getSource("events") as any).getClusterExpansionZoom(clusterId, (err: any, z: number) => {
          if (err) return;
          map.easeTo({ center: (features[0].geometry as any).coordinates, zoom: z });
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

      // Handle clicks on LIVE markers
      map.on("click", "live-dot", (e:any) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f?.properties || {};
        const coords = (f?.geometry as any).coordinates;
        
        createEventPopup(map, coords, p);
        
        if (onMarkerClick && p.id) {
          onMarkerClick(String(p.id));
        }
      });

      // Cursor feedback
      ["clusters", "unclustered", "unclustered-selected", "live-dot"].forEach((layer) => {
        map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
      });

      // Report bounds → parent (for bbox fetch)
      const emitBounds = () => {
        const b = map.getBounds();
        const out: Bounds = { minLon: b.getWest(), minLat: b.getSouth(), maxLon: b.getEast(), maxLat: b.getNorth() };
        onBoundsChange(out);
      };
      map.on("moveend", emitBounds);
      emitBounds();
    });

    // Handle geolocation success - recenter and zoom to user location
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
      
      // Smoothly recenter to user location with zoom 15
      map.easeTo({ 
        center: [lng, lat], 
        zoom: 15, 
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
        
        map.on("click", "clusters", (ev:any) => {
          const features = map.queryRenderedFeatures(ev.point, { layers: ["clusters"] });
          const clusterId = features[0].properties.cluster_id;
          (map.getSource("events") as any).getClusterExpansionZoom(clusterId, (err: any, z: number) => {
            if (err) return;
            map.easeTo({ center: (features[0].geometry as any).coordinates, zoom: z });
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
          
          createEventPopup(map, coords, p);
          
          if (onMarkerClick && p.id) {
            onMarkerClick(String(p.id));
          }
        });
        
        ["clusters", "unclustered", "unclustered-selected", "live-dot"].forEach((layer) => {
          map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
          map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
        });
      }
    });
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
          
          map.on("click", "clusters", (ev:any) => {
            const features = map.queryRenderedFeatures(ev.point, { layers: ["clusters"] });
            const clusterId = features[0].properties.cluster_id;
            (map.getSource("events") as any).getClusterExpansionZoom(clusterId, (err: any, z: number) => {
              if (err) return;
              map.easeTo({ center: (features[0].geometry as any).coordinates, zoom: z });
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
            
            createEventPopup(map, coords, p);
            
            if (onMarkerClick && p.id) {
              onMarkerClick(String(p.id));
            }
          });
          
          ["clusters", "unclustered", "unclustered-selected", "live-dot"].forEach((layer) => {
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
      <button
        onClick={enableCompassFallback}
        style={{
          position: "absolute", 
          right: 16, 
          bottom: 16, 
          zIndex: 10,
          padding: "10px 12px",
          background: "#0b74ff", 
          color: "#fff",
          border: "none", 
          borderRadius: 10, 
          cursor: "pointer", 
          fontWeight: 600,
          fontSize: 14,
          boxShadow: "0 2px 8px rgba(0,0,0,0.2)"
        }}
        title="Enable device compass for heading direction"
      >
        🧭 Enable Compass
      </button>
    </div>
  );
});

export default MapGL;
