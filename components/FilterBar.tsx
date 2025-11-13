import React, { useState } from "react";

export type QuickFilter = "now" | "tonight" | "weekend" | "free" | "popular";

interface FilterBarProps {
  activeQuickFilters: Set<QuickFilter>;
  onQuickFilterToggle: (filter: QuickFilter) => void;
  activeCategoryFilters: Set<string>;
  onCategoryFilterToggle: (category: string) => void;
  maxDistance: number;
  onMaxDistanceChange: (distance: number) => void;
  userLocation: { lat: number; lng: number } | null;
}

const QUICK_FILTERS: { id: QuickFilter; icon: string; label: string }[] = [
  { id: "now", icon: "🔴", label: "Now" },
  { id: "tonight", icon: "🌙", label: "Tonight" },
  { id: "weekend", icon: "🎉", label: "Weekend" },
  { id: "free", icon: "💸", label: "Free" },
  { id: "popular", icon: "⭐", label: "Popular" },
];

const CATEGORY_FILTERS = [
  { id: "music", icon: "🎵", label: "Music" },
  { id: "nightlife", icon: "🍻", label: "Nightlife" },
  { id: "food", icon: "🍔", label: "Food" },
  { id: "arts", icon: "🎨", label: "Arts" },
  { id: "sports", icon: "⚽", label: "Sports" },
  { id: "family", icon: "👨‍👩‍👧", label: "Family" },
];

export default function FilterBar({
  activeQuickFilters,
  onQuickFilterToggle,
  activeCategoryFilters,
  onCategoryFilterToggle,
  maxDistance,
  onMaxDistanceChange,
  userLocation,
}: FilterBarProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 999,
        backgroundColor: "rgba(255, 255, 255, 0.98)",
        backdropFilter: "blur(10px)",
        boxShadow: expanded ? "0 4px 12px rgba(0, 0, 0, 0.15)" : "0 2px 8px rgba(0, 0, 0, 0.1)",
        transition: "all 0.3s ease",
      }}
    >
      {/* Toggle Button */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%",
          padding: "12px 16px",
          background: "none",
          border: "none",
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "18px" }}>🔍</span>
          <span style={{ fontSize: "14px", fontWeight: 600, color: "#333" }}>
            Filters {(activeQuickFilters.size + activeCategoryFilters.size) > 0 && 
              `(${activeQuickFilters.size + activeCategoryFilters.size})`}
          </span>
        </div>
        <span
          style={{
            fontSize: "18px",
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.3s ease",
          }}
        >
          ▼
        </span>
      </button>

      {/* Expanded Filter Content */}
      {expanded && (
        <div
          style={{
            padding: "0 16px 16px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {/* Quick Filters */}
          <div>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "#666", marginBottom: 8 }}>
              QUICK FILTERS
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {QUICK_FILTERS.map((filter) => {
                const isActive = activeQuickFilters.has(filter.id);
                return (
                  <button
                    key={filter.id}
                    onClick={() => onQuickFilterToggle(filter.id)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 20,
                      border: `2px solid ${isActive ? "#667eea" : "#ddd"}`,
                      background: isActive ? "#667eea" : "#fff",
                      color: isActive ? "#fff" : "#666",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: 500,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      transition: "all 0.2s ease",
                    }}
                  >
                    <span>{filter.icon}</span>
                    <span>{filter.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Category Filters */}
          <div>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "#666", marginBottom: 8 }}>
              CATEGORIES
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {CATEGORY_FILTERS.map((category) => {
                const isActive = activeCategoryFilters.has(category.id);
                return (
                  <button
                    key={category.id}
                    onClick={() => onCategoryFilterToggle(category.id)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 20,
                      border: `2px solid ${isActive ? "#667eea" : "#ddd"}`,
                      background: isActive ? "#667eea" : "#fff",
                      color: isActive ? "#fff" : "#666",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: 500,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      transition: "all 0.2s ease",
                    }}
                  >
                    <span>{category.icon}</span>
                    <span>{category.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Distance Slider */}
          {userLocation && (
            <div>
              <div style={{ 
                fontSize: "12px", 
                fontWeight: 600, 
                color: "#666", 
                marginBottom: 8,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <span>DISTANCE</span>
                <span style={{ color: "#667eea", fontWeight: 700 }}>
                  {maxDistance === 100 ? "Any" : `${maxDistance} km`}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="100"
                value={maxDistance}
                onChange={(e) => onMaxDistanceChange(Number(e.target.value))}
                style={{
                  width: "100%",
                  height: 6,
                  borderRadius: 3,
                  outline: "none",
                  cursor: "pointer",
                }}
              />
              <div style={{ 
                display: "flex", 
                justifyContent: "space-between", 
                fontSize: "10px", 
                color: "#999",
                marginTop: 4
              }}>
                <span>1 km</span>
                <span>Any distance</span>
              </div>
            </div>
          )}

          {/* Clear All Filters */}
          {(activeQuickFilters.size > 0 || activeCategoryFilters.size > 0 || maxDistance < 100) && (
            <button
              onClick={() => {
                activeQuickFilters.forEach(f => onQuickFilterToggle(f));
                activeCategoryFilters.forEach(c => onCategoryFilterToggle(c));
                if (maxDistance < 100) onMaxDistanceChange(100);
              }}
              style={{
                padding: "10px",
                borderRadius: 8,
                border: "1px solid #ddd",
                background: "#fff",
                color: "#666",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: 500,
                transition: "all 0.2s ease",
              }}
            >
              Clear All Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
