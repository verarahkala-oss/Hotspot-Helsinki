import React from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMapEvents } from "react-leaflet";
import type { LeafletEvent } from "leaflet";

type Ev = {
  id: string;
  title: string;
  lat: number | null;
  lng: number | null;
  category: string;
  price: "free" | "paid";
  time?: string;
  website?: string | null;
};

type Bounds = { minLon: number; minLat: number; maxLon: number; maxLat: number };

function BoundsWatcher({ onChange }: { onChange: (b: Bounds) => void }) {
  useMapEvents({
    moveend: (e: LeafletEvent) => {
      const map = e.target;
      const b = map.getBounds();
      const sw = b.getSouthWest();
      const ne = b.getNorthEast();
      onChange({ minLon: sw.lng, minLat: sw.lat, maxLon: ne.lng, maxLat: ne.lat });
    },
  });
  return null;
}

export default function MapView({
  events,
  onBoundsChange,
  center = [60.1699, 24.9384],
  zoom = 12,
}: {
  events: Ev[];
  onBoundsChange: (b: Bounds) => void;
  center?: [number, number];
  zoom?: number;
}) {
  return (
    <MapContainer center={center as any} zoom={zoom} style={{ height: "70vh", width: "100%", borderRadius: 12 }} scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <BoundsWatcher onChange={onBoundsChange} />
      {events
        .filter((ev) => ev.lat !== null && ev.lng !== null)
        .map((ev) => (
          <CircleMarker
            key={ev.id}
            center={[ev.lat!, ev.lng!] as any}
            radius={6}
            pathOptions={{ color: "#ff3b3b", fillColor: "#ff3b3b", fillOpacity: 0.9 }}
          >
            <Popup>
              <div style={{ minWidth: 180 }}>
                <strong>{ev.title}</strong>
                <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                  {ev.category} • {ev.price}
                  {ev.time ? <> • {String(ev.time).slice(0, 16)}</> : null}
                </div>
                {ev.website && (
                  <div style={{ marginTop: 6 }}>
                    <a href={ev.website} target="_blank" rel="noreferrer">Open</a>
                  </div>
                )}
              </div>
            </Popup>
          </CircleMarker>
        ))}
    </MapContainer>
  );
}
