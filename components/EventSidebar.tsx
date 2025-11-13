import React, { useRef, useEffect, useState } from "react";
import { SkeletonLoader } from "./SkeletonLoader";
import { isEventLiked, toggleLikeEvent, getSmartSuggestions, getLikedEvents } from "../src/utils/personalization";

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
  view: "events" | "settings";
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
  themeOverride?: "light" | "dark" | undefined;
  onThemeChange: (theme: "light" | "dark" | undefined) => void;
  heatmapMode: boolean;
  onHeatmapModeChange: (enabled: boolean) => void;
  show3DBuildings: boolean;
  onShow3DBuildingsChange: (enabled: boolean) => void;
  distanceUnit: "km" | "miles";
  onDistanceUnitChange: (unit: "km" | "miles") => void;
  onApplyPreset: (preset: "tonight" | "weekend" | "free" | "near-me") => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export default function EventSidebar({
  isOpen,
  view,
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
  themeOverride,
  onThemeChange,
  heatmapMode,
  onHeatmapModeChange,
  show3DBuildings,
  onShow3DBuildingsChange,
  distanceUnit,
  onDistanceUnitChange,
  onApplyPreset,
  loading = false,
  error = null,
  onRetry,
}: EventSidebarProps) {
  const cardRefs = useRef<Record<string, HTMLLIElement | null>>({});
  
  // Track liked events for UI updates
  const [likedEvents, setLikedEvents] = useState<Set<string>>(() => {
    const liked = require("../src/utils/personalization").getLikedEvents();
    return new Set(liked.map((e: any) => e.id));
  });

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
          width: "min(420px, 92vw)",
          backgroundColor: "#fff",
          boxShadow: "-4px 0 24px rgba(0, 0, 0, 0.15)",
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderTopLeftRadius: 24,
          borderBottomLeftRadius: 24,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px 16px 24px",
            borderBottom: "1px solid #f0f0f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "#fff",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "#1a1a1a" }}>
            {view === "events" ? `Events (${events.length})` : "Settings"}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "#f5f5f5",
              border: "none",
              fontSize: "20px",
              cursor: "pointer",
              padding: "8px",
              lineHeight: 1,
              borderRadius: "50%",
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#e5e5e5";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#f5f5f5";
            }}
            title="Close sidebar"
          >
            ×
          </button>
        </div>

        {view === "events" ? (
          <>
            {/* Filters */}
        <div
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid #f0f0f0",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            backgroundColor: "#fafafa",
          }}
        >
          <input
            placeholder="🔍 Search events…"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            style={{
              padding: "12px 16px",
              borderRadius: 12,
              border: "1px solid #e0e0e0",
              fontSize: "14px",
              outline: "none",
              transition: "all 0.2s ease",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "#667eea";
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(102, 126, 234, 0.1)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "#e0e0e0";
              e.currentTarget.style.boxShadow = "none";
            }}
          />

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <select
              value={price}
              onChange={(e) => onPriceChange(e.target.value as any)}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #e0e0e0",
                fontSize: "13px",
                flex: 1,
                minWidth: "100px",
                cursor: "pointer",
                outline: "none",
              }}
            >
              <option value="">All prices</option>
              <option value="free">Free</option>
              <option value="paid">Paid</option>
            </select>

            <button
              onClick={() => onOnlyLiveChange(!onlyLive)}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                background: onlyLive ? "linear-gradient(135deg, #ff3b3b 0%, #ff6b6b 100%)" : "transparent",
                color: onlyLive ? "#fff" : "#666",
                border: onlyLive ? "none" : "1px solid #e0e0e0",
                fontWeight: onlyLive ? 600 : 500,
                cursor: "pointer",
                fontSize: "13px",
                flex: 1,
                minWidth: "100px",
                transition: "all 0.2s ease",
                boxShadow: onlyLive ? "0 2px 8px rgba(255, 59, 59, 0.3)" : "none",
              }}
            >
              {onlyLive ? "🔴 LIVE" : "Show LIVE"}
            </button>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={onShowInterests}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                background:
                  activeFilters.size > 0
                    ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                    : "transparent",
                color: activeFilters.size > 0 ? "#fff" : "#666",
                border: activeFilters.size > 0 ? "none" : "1px solid #e0e0e0",
                cursor: "pointer",
                fontWeight: 500,
                fontSize: "13px",
                flex: 1,
                transition: "all 0.2s ease",
                boxShadow: activeFilters.size > 0 ? "0 2px 8px rgba(102, 126, 234, 0.3)" : "none",
              }}
              title="Edit your interests"
            >
              🎯 {activeFilters.size > 0 ? `${activeFilters.size} interests` : "Interests"}
            </button>

            <button
              onClick={onReset}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #e0e0e0",
                background: "transparent",
                color: "#666",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: 500,
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#f5f5f5";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              Reset
            </button>
          </div>
        </div>

        {/* Event List */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px",
          }}
        >
          {/* Error message with retry button */}
          {error && (
            <div
              style={{
                backgroundColor: "#fff3cd",
                border: "1px solid #ffc107",
                borderRadius: 12,
                padding: "16px",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: "#856404", marginBottom: 4 }}>
                  ⚠️ Connection Issue
                </div>
                <div style={{ fontSize: 14, color: "#856404" }}>
                  {error}
                </div>
              </div>
              {onRetry && (
                <button
                  onClick={onRetry}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#667eea",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: 14,
                    whiteSpace: "nowrap",
                  }}
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {/* Smart Suggestions - only show when not loading and have liked events */}
          {!loading && getLikedEvents().length > 0 && events.length > 0 && (
            <div
              style={{
                backgroundColor: "#f8f9ff",
                border: "1px solid #e0e7ff",
                borderRadius: 12,
                padding: "12px 16px",
                marginBottom: "16px",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: "#667eea", marginBottom: 8 }}>
                💡 Because you liked {getLikedEvents()[0]?.category || "similar"} events
              </div>
              <div style={{ fontSize: 13, color: "#666" }}>
                {getSmartSuggestions()[0]}
              </div>
            </div>
          )}

          {/* Show skeleton loader when loading and no events */}
          {loading && events.length === 0 ? (
            <div style={{ display: "grid", gap: 12 }}>
              <SkeletonLoader count={5} />
            </div>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
              {/* OPTIMIZATION: Render first 50 events for better performance */}
              {events.slice(0, 50).map((ev, index) => {
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
                    border: isSelected ? "2px solid #667eea" : "none",
                    borderRadius: 16,
                    padding: 16,
                    cursor: "pointer",
                    backgroundColor: isSelected ? "#f0f4ff" : "#fff",
                    transition: "all 0.2s ease",
                    boxShadow: isSelected 
                      ? "0 8px 24px rgba(102, 126, 234, 0.25)" 
                      : "0 2px 8px rgba(0, 0, 0, 0.08)",
                    animation: "fadeInUp 0.5s ease-out forwards",
                    animationDelay: `${index * 0.03}s`,
                    opacity: 0,
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.boxShadow = "0 4px 16px rgba(0, 0, 0, 0.12)";
                      e.currentTarget.style.transform = "translateY(-2px)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.08)";
                      e.currentTarget.style.transform = "translateY(0)";
                    }
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                    <strong style={{ fontSize: "15px", flex: 1, lineHeight: 1.4, color: "#1a1a1a" }}>
                      {ev.title}
                    </strong>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {/* Like button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const nowLiked = toggleLikeEvent({
                            id: ev.id,
                            title: ev.title,
                            category: ev.category
                          });
                          // Force re-render by updating a state
                          setLikedEvents(prev => {
                            const next = new Set(prev);
                            if (nowLiked) {
                              next.add(ev.id);
                            } else {
                              next.delete(ev.id);
                            }
                            return next;
                          });
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: 18,
                          padding: 4,
                          display: "flex",
                          alignItems: "center",
                          transition: "transform 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "scale(1.2)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "scale(1)";
                        }}
                        title={likedEvents.has(ev.id) ? "Unlike event" : "Like event"}
                      >
                        {likedEvents.has(ev.id) ? "❤️" : "🤍"}
                      </button>
                      {live && (
                        <span
                          style={{
                            background: "linear-gradient(135deg, #ff3b3b 0%, #ff6b6b 100%)",
                            color: "#fff",
                            borderRadius: 8,
                            padding: "4px 8px",
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: "0.5px",
                            boxShadow: "0 2px 8px rgba(255, 59, 59, 0.3)",
                          }}
                        >
                          🔴 LIVE
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ 
                    color: "#666", 
                    fontSize: 13, 
                    marginBottom: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap"
                  }}>
                    <span style={{ 
                      background: "#f5f5f5", 
                      padding: "4px 8px", 
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 500
                    }}>
                      {ev.category}
                    </span>
                    <span style={{ 
                      background: ev.price === "free" ? "#e8f5e9" : "#fff3e0", 
                      color: ev.price === "free" ? "#2e7d32" : "#e65100",
                      padding: "4px 8px", 
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600
                    }}>
                      {ev.price === "free" ? "FREE" : "PAID"}
                    </span>
                    {ev.time && (
                      <span style={{ fontSize: 12, color: "#999" }}>
                        {String(ev.time).slice(0, 16)}
                      </span>
                    )}
                  </div>
                  {ev.website && (
                    <a
                      href={ev.website}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        color: "#667eea",
                        fontSize: 13,
                        fontWeight: 500,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        textDecoration: "none",
                      }}
                    >
                      View details
                      <span style={{ fontSize: 10 }}>→</span>
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
          )}

          {!loading && events.length === 0 && (
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
          </>
        ) : (
          /* Settings View */
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            {/* Map Style */}
            <div>
              <label style={{ fontSize: "12px", color: "#666", marginBottom: "6px", display: "block", fontWeight: 600 }}>
                Map Style
              </label>
              <select
                value={themeOverride ?? ""}
                onChange={(e) => {
                  const v = e.target.value as "" | "light" | "dark";
                  onThemeChange(v || undefined);
                }}
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  fontSize: "14px",
                  background: "#fff",
                  width: "100%",
                  cursor: "pointer",
                }}
              >
                <option value="">🌓 Auto</option>
                <option value="light">☀️ Light</option>
                <option value="dark">🌙 Dark</option>
              </select>
            </div>

            {/* Heatmap Mode Toggle */}
            <div>
              <label style={{ fontSize: "12px", color: "#666", marginBottom: "6px", display: "block", fontWeight: 600 }}>
                Activity Heatmap
              </label>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "#f9f9f9", borderRadius: 8 }}>
                <span style={{ fontSize: "14px", color: "#333" }}>🔥 Show heatmap</span>
                <button
                  onClick={() => onHeatmapModeChange(!heatmapMode)}
                  style={{
                    padding: "6px 16px",
                    borderRadius: 6,
                    border: "none",
                    background: heatmapMode ? "#ff6b35" : "#ddd",
                    color: heatmapMode ? "#fff" : "#666",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: 600,
                    transition: "all 0.2s",
                  }}
                >
                  {heatmapMode ? "ON" : "OFF"}
                </button>
              </div>
            </div>

            {/* 3D Buildings Toggle */}
            <div>
              <label style={{ fontSize: "12px", color: "#666", marginBottom: "6px", display: "block", fontWeight: 600 }}>
                3D Buildings
              </label>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "#f9f9f9", borderRadius: 8 }}>
                <span style={{ fontSize: "14px", color: "#333" }}>🏢 Show building extrusions</span>
                <button
                  onClick={() => onShow3DBuildingsChange(!show3DBuildings)}
                  style={{
                    padding: "6px 16px",
                    borderRadius: 6,
                    border: "none",
                    background: show3DBuildings ? "#667eea" : "#ddd",
                    color: show3DBuildings ? "#fff" : "#666",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: 600,
                    transition: "all 0.2s",
                  }}
                >
                  {show3DBuildings ? "ON" : "OFF"}
                </button>
              </div>
            </div>

            {/* Distance Unit */}
            <div>
              <label style={{ fontSize: "12px", color: "#666", marginBottom: "6px", display: "block", fontWeight: 600 }}>
                Distance Unit
              </label>
              <select
                value={distanceUnit}
                onChange={(e) => onDistanceUnitChange(e.target.value as "km" | "miles")}
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  fontSize: "14px",
                  background: "#fff",
                  width: "100%",
                  cursor: "pointer",
                }}
              >
                <option value="km">🇪🇺 Kilometers (km)</option>
                <option value="miles">🇺🇸 Miles (mi)</option>
              </select>
            </div>

            {/* Compass Mode */}
            {onEnableCompass && (
              <div>
                <label style={{ fontSize: "12px", color: "#666", marginBottom: "6px", display: "block", fontWeight: 600 }}>
                  Compass Navigation
                </label>
                <button
                  onClick={onEnableCompass}
                  style={{
                    padding: "12px 16px",
                    borderRadius: 8,
                    border: "2px solid #0b74ff",
                    background: "#fff",
                    color: "#0b74ff",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: 600,
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
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
                  <span style={{ fontSize: "20px" }}>🧭</span>
                  Enable Compass Mode
                </button>
              </div>
            )}

            {/* Filter Presets */}
            <div>
              <label style={{ fontSize: "12px", color: "#666", marginBottom: "6px", display: "block", fontWeight: 600 }}>
                Quick Presets
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <button
                  onClick={() => onApplyPreset("tonight")}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid #ddd",
                    background: "#fff",
                    color: "#333",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: 500,
                    transition: "all 0.2s",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "4px",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#f0f4ff";
                    e.currentTarget.style.borderColor = "#667eea";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#fff";
                    e.currentTarget.style.borderColor = "#ddd";
                  }}
                >
                  <span style={{ fontSize: "20px" }}>🌙</span>
                  Tonight
                </button>
                <button
                  onClick={() => onApplyPreset("weekend")}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid #ddd",
                    background: "#fff",
                    color: "#333",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: 500,
                    transition: "all 0.2s",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "4px",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#f0f4ff";
                    e.currentTarget.style.borderColor = "#667eea";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#fff";
                    e.currentTarget.style.borderColor = "#ddd";
                  }}
                >
                  <span style={{ fontSize: "20px" }}>🎉</span>
                  Weekend
                </button>
                <button
                  onClick={() => onApplyPreset("free")}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid #ddd",
                    background: "#fff",
                    color: "#333",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: 500,
                    transition: "all 0.2s",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "4px",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#f0f4ff";
                    e.currentTarget.style.borderColor = "#667eea";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#fff";
                    e.currentTarget.style.borderColor = "#ddd";
                  }}
                >
                  <span style={{ fontSize: "20px" }}>💸</span>
                  Free
                </button>
                <button
                  onClick={() => onApplyPreset("near-me")}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid #ddd",
                    background: "#fff",
                    color: "#333",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: 500,
                    transition: "all 0.2s",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "4px",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#f0f4ff";
                    e.currentTarget.style.borderColor = "#667eea";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#fff";
                    e.currentTarget.style.borderColor = "#ddd";
                  }}
                >
                  <span style={{ fontSize: "20px" }}>📍</span>
                  Near Me
                </button>
              </div>
            </div>

            {/* Privacy & Data Section */}
            <div
              style={{
                marginTop: "24px",
                padding: "16px",
                background: "#f8f9fa",
                borderRadius: 12,
                border: "1px solid #e0e0e0",
              }}
            >
              <div style={{ fontSize: "14px", fontWeight: 600, color: "#1a1a1a", marginBottom: 12 }}>
                🔒 Privacy & Data
              </div>
              <div style={{ fontSize: 13, color: "#666", lineHeight: 1.6, marginBottom: 12 }}>
                <strong>Your location</strong> is only used in your browser to show nearby events. We never store or share your location data.
              </div>
              <div style={{ fontSize: 13, color: "#666", lineHeight: 1.6, marginBottom: 12 }}>
                <strong>Event data</strong> is sourced from{" "}
                <a
                  href="https://api.hel.fi/linkedevents/v1/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#667eea", textDecoration: "none", fontWeight: 600 }}
                >
                  Helsinki LinkedEvents API
                </a>
                {" and "}
                <a
                  href="https://www.openstreetmap.org/copyright"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#667eea", textDecoration: "none", fontWeight: 600 }}
                >
                  OpenStreetMap
                </a>
                .
              </div>
              <div style={{ fontSize: 12, color: "#999", lineHeight: 1.5 }}>
                Your preferences and saved events are stored locally on your device.
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
