import React from "react";

type EventItem = {
  id: string;
  title: string;
  time: string;
  lat: number;
  lng: number;
  price: "free" | "paid";
  category?: "music" | "food" | "sports" | "family" | "other";
  website?: string | null;
};

export default function App() {
  // core state
  const [events, setEvents] = React.useState<EventItem[]>([]);
  const [filtered, setFiltered] = React.useState<EventItem[]>([]);
  const [price, setPrice] = React.useState<"free" | "paid" | null>(null);
  const [cats, setCats] = React.useState<Set<string>>(new Set());
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  // demo fallback (so the app never looks empty)
  const DEMO: EventItem[] = [
    { id: "t1", title: "DJ Night @ Kamppi", time: new Date().toISOString(), lat: 60.1693, lng: 24.9333, category: "music", price: "free", website: "https://example.com" },
    { id: "t2", title: "Street Food Fest – Kaivopuisto", time: new Date().toISOString(), lat: 60.1556, lng: 24.9509, category: "food",  price: "paid", website: "https://example.com" },
    { id: "t3", title: "Morning Run – Töölönlahti", time: new Date().toISOString(), lat: 60.1802, lng: 24.9311, category: "sports", price: "free", website: "https://example.com" },
    { id: "t4", title: "Kids Crafts – Oodi",       time: new Date().toISOString(), lat: 60.1733, lng: 24.9381, category: "family", price: "free", website: "https://example.com" },
  ];

  const openSite = (url?: string | null) => {
    if (!url) return;
    let u = String(url).trim();
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    window.open(u, "_blank", "noopener,noreferrer");
  };

  const loadEvents = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      // Once deployed on Vercel, this hits your serverless route
      const r = await fetch("/api/events-lite?limit=200", { headers: { Accept: "application/json" } });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const json = await r.json();

      // Accept either {data: [...]} (from our serverless) or raw array (future)
      const list: EventItem[] = Array.isArray(json) ? json : json?.data ?? [];
      if (!Array.isArray(list) || list.length === 0) {
        setLoadError("No events returned. Showing demo events.");
        setEvents(DEMO);
      } else {
        setEvents(list);
      }
    } catch (e: any) {
      setLoadError(`Could not load events (${e?.message || "network"}). Showing demo events.`);
      setEvents(DEMO);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { loadEvents(); }, [loadEvents]);

  // filter + sort
  React.useEffect(() => {
    let out = events.filter(e => (price ? e.price === price : true) && (cats.size ? cats.has(e.category || "other") : true));
    // default sort: by time (newest first if possible)
    out = out.sort((a, b) => String(b.time).localeCompare(String(a.time)));
    setFiltered(out);
  }, [events, price, cats]);

  const toggleCat = (c: string) =>
    setCats(prev => {
      const n = new Set(prev);
      n.has(c) ? n.delete(c) : n.add(c);
      return n;
    });

  return (
    <div style={styles.page}>
      <h1 style={{ margin: 0 }}>Helsinki Hotspots</h1>
      <p style={{ marginTop: 6, color: "#9aa0a6" }}>
        {loading ? "Loading events…" : loadError ? loadError : `Loaded ${filtered.length} events`}
      </p>

      {/* Filters */}
      <div style={styles.chips}>
        <Chip label="Free"   active={price === "free"} onClick={() => setPrice(price === "free" ? null : "free")} />
        <Chip label="Paid"   active={price === "paid"} onClick={() => setPrice(price === "paid" ? null : "paid")} />
        <Chip label="Music"  active={cats.has("music")} onClick={() => toggleCat("music")} />
        <Chip label="Food"   active={cats.has("food")}  onClick={() => toggleCat("food")} />
        <Chip label="Sports" active={cats.has("sports")} onClick={() => toggleCat("sports")} />
        <Chip label="Family" active={cats.has("family")} onClick={() => toggleCat("family")} />
        <Chip label="Reset"  onClick={() => { setPrice(null); setCats(new Set()); }} />
        <Chip label="Reload" onClick={loadEvents} />
      </div>

      {/* List */}
      <div style={styles.list}>
        {filtered.map(item => (
          <div key={item.id} style={styles.row}>
            <div style={styles.dot} />
            <div style={{ flex: 1 }}>
              <div style={styles.title}>{item.title}</div>
              <div style={styles.sub}>
                {(item.category || "other")} · {item.price} · {String(item.time).slice(0, 16)}
              </div>
            </div>
            <button style={styles.btn} onClick={() => openSite(item.website)}>Open</button>
          </div>
        ))}
        {!filtered.length && !loading && (
          <div style={{ color: "#9aa0a6", padding: 12 }}>No events match your filters.</div>
        )}
      </div>

      {/* (Later) we’ll add a map here */}
    </div>
  );
}

/** Small pill button */
function Chip({ label, active, onClick }: { label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 10px",
        borderRadius: 999,
        border: "1px solid",
        borderColor: active ? "#ff3b3b" : "#2a2a33",
        background: active ? "#291416" : "#111318",
        color: active ? "#ffe3e3" : "#c8cdd4",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto",
    color: "#e8eaed",
    background: "#0b0b0f",
    minHeight: "100vh",
    padding: 16,
  },
  chips: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    margin: "8px 0 12px",
  },
  list: {
    borderTop: "1px solid #1e1e27",
  },
  row: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    padding: 10,
    borderBottom: "1px solid #171720",
    background: "#0c0c0c",
  },
  dot: { width: 10, height: 10, borderRadius: 5, background: "#ff3b3b" },
  title: { fontWeight: 700 },
  sub: { color: "#9aa0a6", fontSize: 12, marginTop: 2 },
  btn: {
    background: "#ff3b3b",
    color: "#fff",
    padding: "8px 12px",
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
    fontWeight: 700,
  },
};