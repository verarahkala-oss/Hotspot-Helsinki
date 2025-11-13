import React, { useRef, useEffect } from "react";

type EventLite = {
  id: string;
  title: string;
  start: string;
  end?: string;
  lat: number;
  lng: number;
  category: string;
  price: "free" | "paid";
  time?: string;
  website?: string;
};

interface EventSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  events: EventLite[];
  selectedId?: string;
  onEventClick: (id: string) => void;
  // Filters
  query: string;
  onQueryChange: (query: string) => void;
  price: "" | "free" | "paid";
  onPriceChange: (price: "" | "free" | "paid") => void;
  onlyLive: boolean;
  onOnlyLiveChange: (onlyLive: boolean) => void;
  onReset: () => void;
  activeFilters: Set<string>;
  onShowInterests: () => void;
  isLiveNow: (event: EventLite) => boolean;
  // Settings
  onEnableCompass?: () => void;
}

export default function EventSidebar({
  isOpen,
  onClose,
  events,
  selectedId,
  onEventClick,
  query,
  onQueryChange,
  price,
  onPriceChange,
  onlyLive,
  onOnlyLiveChange,
  onReset,
  activeFilters,
  onShowInterests,
  isLiveNow,
  onEnableCompass,
}: EventSidebarProps) {
  const cardRefs = useRef<Record<string, HTMLLIElement | null>>({});

  // Scroll to selected card
  useEffect(() => {
    if (selectedId && cardRefs.current[selectedId]) {
      const card = cardRefs.current[selectedId];
      card?.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center'
      });
    }
  }, [selectedId]);

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.3)",
            zIndex: 999,
            transition: "opacity 0.3s ease",
          }}
        />
      )}

      {/* Sidebar */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(400px, 90vw)",
          backgroundColor: "#fff",
          boxShadow: "-2px 0 8px rgba(0, 0, 0, 0.1)",
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.3s ease",
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px",
            borderBottom: "1px solid #eee",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "#f9f9f9",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>
            Events ({events.length})
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "24px",
              cursor: "pointer",
              padding: "4px 8px",
              lineHeight: 1,
            }}
            title="Close sidebar"
          >
            ×
          </button>
        </div>

        {/* Filters */}
        <div
          style={{
            padding: "16px",
            borderBottom: "1px solid #eee",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            backgroundColor: "#fafafa",
          }}
        >
          <input
            placeholder="🔍 Search events…"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #ddd",
              fontSize: "14px",
            }}
          />

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <select
              value={price}
              onChange={(e) => onPriceChange(e.target.value as any)}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #ddd",
                fontSize: "13px",
                flex: 1,
                minWidth: "100px",
              }}
            >
              <option value="">All prices</option>
              <option value="free">Free</option>
              <option value="paid">Paid</option>
            </select>

            <button
              onClick={() => onOnlyLiveChange(!onlyLive)}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                background: onlyLive ? "#ff3b3b" : "transparent",
                color: onlyLive ? "#fff" : "inherit",
                border: onlyLive ? "none" : "1px solid #ddd",
                fontWeight: onlyLive ? 600 : 400,
                cursor: "pointer",
                fontSize: "13px",
                flex: 1,
                minWidth: "100px",
              }}
            >
              {onlyLive ? "🔴 LIVE" : "Show LIVE"}
            </button>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={onShowInterests}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                background:
                  activeFilters.size > 0
                    ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                    : "transparent",
                color: activeFilters.size > 0 ? "#fff" : "inherit",
                border: activeFilters.size > 0 ? "none" : "1px solid #ddd",
                cursor: "pointer",
                fontWeight: 500,
                fontSize: "13px",
                flex: 1,
              }}
              title="Edit your interests"
            >
              🎯 {activeFilters.size > 0 ? `${activeFilters.size} interests` : "Interests"}
            </button>

            <button
              onClick={onReset}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #ddd",
                background: "transparent",
                cursor: "pointer",
                fontSize: "13px",
              }}
            >
              Reset
            </button>
          </div>
        </div>

        {/* Settings Section */}
        {onEnableCompass && (
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid #eee",
              backgroundColor: "#f9f9f9",
            }}
          >
            <div style={{ fontSize: "12px", fontWeight: 600, color: "#666", marginBottom: "8px" }}>
              SETTINGS
            </div>
            <button
              onClick={onEnableCompass}
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #0b74ff",
                background: "#fff",
                color: "#0b74ff",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: 500,
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                justifyContent: "center",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#0b74ff";
                e.currentTarget.style.color = "#fff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#fff";
                e.currentTarget.style.color = "#0b74ff";
              }}
              title="Enable device compass for navigation"
            >
              🧭 Enable Compass Mode
            </button>
          </div>
        )}

        {/* Event List */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "8px",
          }}
        >
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
            {events.slice(0, 50).map((ev) => {
              const live = isLiveNow(ev);
              const isSelected = selectedId === ev.id;
              return (
                <li
                  key={ev.id}
                  ref={(el) => {
                    cardRefs.current[ev.id] = el;
                  }}
                  onClick={() => onEventClick(ev.id)}
                  style={{
                    border: isSelected ? "2px solid #667eea" : "1px solid #eee",
                    borderRadius: 10,
                    padding: 12,
                    cursor: "pointer",
                    backgroundColor: isSelected ? "#f0f4ff" : "#fff",
                    transition: "all 0.2s ease",
                    boxShadow: isSelected ? "0 2px 8px rgba(102, 126, 234, 0.2)" : "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <strong style={{ fontSize: "14px", flex: 1 }}>{ev.title}</strong>
                    {live && (
                      <span
                        style={{
                          background: "#ff3b3b",
                          color: "#fff",
                          borderRadius: 6,
                          padding: "2px 6px",
                          fontSize: 10,
                          fontWeight: 600,
                        }}
                      >
                        LIVE
                      </span>
                    )}
                  </div>
                  <div style={{ color: "#666", fontSize: 12 }}>
                    {ev.category} • {ev.price}
                    {ev.time ? ` • ${String(ev.time).slice(0, 16)}` : ""}
                  </div>
                  {ev.website && (
                    <a
                      href={ev.website}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        color: "#667eea",
                        fontSize: 12,
                        marginTop: 4,
                        display: "inline-block",
                      }}
                    >
                      View details →
                    </a>
                  )}
                </li>
              );
            })}
          </ul>

          {events.length === 0 && (
            <div
              style={{
                textAlign: "center",
                color: "#999",
                padding: "40px 20px",
                fontSize: "14px",
              }}
            >
              No events found. Try adjusting your filters.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
