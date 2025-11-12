import React, { useEffect, useMemo, useRef } from "react";
import maplibregl, { Map as MLMap, LngLatBoundsLike } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_STYLE_LIGHT, MAP_STYLE_DARK } from "./mapStyle";

type Ev = { id:string; title:string; lat:number | null; lng:number | null; category:string; price:"free"|"paid"; time?:string; website?:string|null; };
type Bounds = { minLon:number; minLat:number; maxLon:number; maxLat:number };

function eventsToGeoJSON(events: Ev[]) {
  return {
    type: "FeatureCollection",
    features: (events || [])
      .filter((e) => e.lat !== null && e.lng !== null)
      .map((e: Ev) => ({
        type: "Feature",
        properties: { id: e.id, title: e.title, category: e.category, price: e.price, time: e.time || "", website: e.website || "" },
        geometry: { type: "Point", coordinates: [e.lng!, e.lat!] }
      }))
  } as any;
}

export default function MapGL({ events, onBoundsChange, center = [24.9384, 60.1699], zoom = 12, themeOverride }:{
  events: Ev[];
  onBoundsChange: (b: Bounds) => void;
  center?: [number, number]; // [lng, lat]
  zoom?: number;
  themeOverride?: "light" | "dark";
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);

  const geo = useMemo(() => eventsToGeoJSON(events as any), [events]);

  // Fallback if no MapTiler key
  if (!import.meta.env.VITE_MAPTILER_KEY || import.meta.env.VITE_MAPTILER_KEY === 'your_maptiler_key_here') {
    return (
      <div ref={ref} style={{ height: "70vh", width: "100%", borderRadius: 12, background: "#f5f5f5", display: "flex", alignItems: "center", justifyContent: "center", color: "#666" }}>
        <div style={{ textAlign: "center", padding: 20 }}>
          <div style={{ fontSize: 18, marginBottom: 8 }}>🗺️ Map Configuration Needed</div>
          <div style={{ fontSize: 14 }}>Please set VITE_MAPTILER_KEY in .env.local</div>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    
    // Detect system theme preference once on mount
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    const initialTheme = themeOverride ?? (prefersDark ? "dark" : "light");
    const initialStyle = initialTheme === "dark" ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;
    
    const map = new maplibregl.Map({
      container: ref.current,
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
    map.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true }), "top-right");

    map.on("load", () => {
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

      // Unclustered hotspots (Apple-like red)
      map.addLayer({
        id: "unclustered",
        type: "circle",
        source: "events",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#ff3b3b",
          "circle-radius": 6,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.5
        }
      });

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
        const p = f?.properties || {};
        const coords = (f?.geometry as any).coordinates;
        const html = `
          <div style="min-width:200px">
            <strong>${p.title || "Event"}</strong>
            <div style="font-size:12px;color:#666;margin-top:4px">${p.category} • ${p.price}${p.time ? " • " + String(p.time).slice(0,16) : ""}</div>
            ${p.website ? `<div style="margin-top:6px"><a href="${p.website}" target="_blank" rel="noreferrer">Open</a></div>` : ""}
          </div>`;
        new maplibregl.Popup({ closeButton: true }).setLngLat(coords).setHTML(html).addTo(map);
      });

      // Cursor feedback
      ["clusters", "unclustered"].forEach((layer) => {
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

    return () => { map.remove(); mapRef.current = null; };
  }, [center, zoom]);

  // Update data when events change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource("events")) return;
    (map.getSource("events") as any).setData(geo);
  }, [geo]);

  // Listen for OS theme changes and swap style dynamically
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    
    const onChange = (e: MediaQueryListEvent) => {
      if (themeOverride) return; // respect manual override
      const style = e.matches ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;
      const map = mapRef.current;
      if (!map) return;
      
      // Save our event data before style swap
      const data = (map.getSource("events") as any)?._data;
      map.setStyle(style);
      
      map.once("styledata", () => {
        // Re-add our custom source and layers after style loads
        if (!map.getSource("events")) {
          map.addSource("events", { 
            type: "geojson", 
            data, 
            cluster: true, 
            clusterRadius: 40, 
            clusterMaxZoom: 14 
          });
          
          // Cluster circles
          map.addLayer({ 
            id: "clusters", 
            type: "circle", 
            source: "events", 
            filter: ["has","point_count"],
            paint: { 
              "circle-color": e.matches ? "#3a3a44" : "#e8e8ee", 
              "circle-radius": ["step",["get","point_count"],16,50,22,200,28],
              "circle-stroke-color": e.matches ? "#555560" : "#cfcfda",
              "circle-stroke-width": 1 
            }
          });
          
          // Cluster labels
          map.addLayer({ 
            id: "cluster-count", 
            type: "symbol", 
            source: "events", 
            filter: ["has","point_count"],
            layout: { 
              "text-field": ["get","point_count_abbreviated"], 
              "text-size": 12 
            },
            paint: { "text-color": e.matches ? "#eee" : "#333" }
          });
          
          // Unclustered hotspots
          map.addLayer({ 
            id: "unclustered", 
            type: "circle", 
            source: "events", 
            filter: ["!",["has","point_count"]],
            paint: { 
              "circle-color":"#ff3b3b",
              "circle-radius":6,
              "circle-stroke-color":"#ffffff",
              "circle-stroke-width":1.5 
            }
          });
          
          // Optional: 3D buildings
          if (map.getLayer("building")) {
            map.setPaintProperty("building", "fill-extrusion-color", e.matches ? "#2a2a33" : "#e6e6ec");
            map.setPaintProperty("building", "fill-extrusion-height", ["get", "render_height"]);
            map.setPaintProperty("building", "fill-extrusion-base", ["get", "render_min_height"]);
            map.setPaintProperty("building", "fill-extrusion-opacity", e.matches ? 0.8 : 0.7);
          }
          
          // Re-attach click handlers
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
            const p = f?.properties || {};
            const coords = (f?.geometry as any).coordinates;
            const html = `
              <div style="min-width:200px">
                <strong>${p.title || "Event"}</strong>
                <div style="font-size:12px;color:#666;margin-top:4px">${p.category} • ${p.price}${p.time ? " • " + String(p.time).slice(0,16) : ""}</div>
                ${p.website ? `<div style="margin-top:6px"><a href="${p.website}" target="_blank" rel="noreferrer">Open</a></div>` : ""}
              </div>`;
            new maplibregl.Popup({ closeButton: true }).setLngLat(coords).setHTML(html).addTo(map);
          });
          
          // Cursor feedback
          ["clusters", "unclustered"].forEach((layer) => {
            map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
            map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
          });
        }
      });
    };
    
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [themeOverride]);

  // Handle manual theme override changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || themeOverride === undefined) return;
    
    const isDark = themeOverride === "dark";
    const newStyle = isDark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;
    const currentStyle = map.getStyle();
    
    // Only change if style is actually different
    if (currentStyle && (
      (isDark && !currentStyle.name?.toLowerCase().includes('dark')) ||
      (!isDark && currentStyle.name?.toLowerCase().includes('dark'))
    )) {
      const data = (map.getSource("events") as any)?._data;
      map.setStyle(newStyle);
      
      map.once("styledata", () => {
        if (!map.getSource("events")) {
          map.addSource("events", { 
            type: "geojson", 
            data, 
            cluster: true, 
            clusterRadius: 40, 
            clusterMaxZoom: 14 
          });
          
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
          
          map.addLayer({ 
            id: "unclustered", 
            type: "circle", 
            source: "events", 
            filter: ["!",["has","point_count"]],
            paint: { 
              "circle-color":"#ff3b3b",
              "circle-radius":6,
              "circle-stroke-color":"#ffffff",
              "circle-stroke-width":1.5 
            }
          });
          
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
            const p = f?.properties || {};
            const coords = (f?.geometry as any).coordinates;
            const html = `
              <div style="min-width:200px">
                <strong>${p.title || "Event"}</strong>
                <div style="font-size:12px;color:#666;margin-top:4px">${p.category} • ${p.price}${p.time ? " • " + String(p.time).slice(0,16) : ""}</div>
                ${p.website ? `<div style="margin-top:6px"><a href="${p.website}" target="_blank" rel="noreferrer">Open</a></div>` : ""}
              </div>`;
            new maplibregl.Popup({ closeButton: true }).setLngLat(coords).setHTML(html).addTo(map);
          });
          
          ["clusters", "unclustered"].forEach((layer) => {
            map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
            map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
          });
        }
      });
    }
  }, [themeOverride]);

  return <div ref={ref} style={{ height: "70vh", width: "100%", borderRadius: 12 }} />;
}
