import React, { useState } from "react";

export type FilterOption = {
  id: string;
  label: string;
  icon: string;
  keywords: string[]; // Keywords to search for in category/title
};

const FILTER_OPTIONS: FilterOption[] = [
  { id: "music", label: "Music", icon: "🎵", keywords: ["music", "concert", "musiik", "konsertti"] },
  { id: "food", label: "Food & Drink", icon: "🍔", keywords: ["food", "drink", "restaurant", "ruoka", "ravintola", "kahvila", "cafe"] },
  { id: "nightlife", label: "Nightlife", icon: "🕺", keywords: ["nightlife", "club", "bar", "party", "yöelämä"] },
  { id: "outdoors", label: "Outdoors", icon: "🌿", keywords: ["outdoor", "nature", "park", "luonto", "ulko"] },
  { id: "culture", label: "Culture", icon: "🎨", keywords: ["art", "culture", "museum", "gallery", "taide", "kulttuuri", "museo"] },
  { id: "free", label: "Free", icon: "🆓", keywords: ["free"] },
];

interface RadialFilterMenuProps {
  activeFilters: Set<string>;
  onFilterToggle: (filterId: string) => void;
}

export default function RadialFilterMenu({ activeFilters, onFilterToggle }: RadialFilterMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen(prev => !prev);

  // Calculate circular positions for filter buttons
  const getPosition = (index: number, total: number) => {
    const radius = 100; // Distance from center
    const startAngle = -90; // Start from top (-90 degrees)
    const angleStep = 360 / total;
    const angle = (startAngle + angleStep * index) * (Math.PI / 180);
    
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
  };

  return (
    <div style={{
      position: "fixed",
      bottom: 24,
      right: 24,
      zIndex: 1000,
    }}>
      {/* Filter option buttons */}
      {FILTER_OPTIONS.map((option, index) => {
        const pos = getPosition(index, FILTER_OPTIONS.length);
        const isActive = activeFilters.has(option.id);
        
        return (
          <button
            key={option.id}
            onClick={() => onFilterToggle(option.id)}
            style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              width: 56,
              height: 56,
              borderRadius: "50%",
              border: "none",
              backgroundColor: isActive ? "#1e90ff" : "#fff",
              color: isActive ? "#fff" : "#333",
              fontSize: 24,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)",
              transform: isOpen 
                ? `translate(${pos.x}px, ${pos.y}px) scale(1)` 
                : "translate(0, 0) scale(0)",
              opacity: isOpen ? 1 : 0,
              pointerEvents: isOpen ? "auto" : "none",
            }}
            aria-label={option.label}
            title={option.label}
          >
            <span style={{ fontSize: 24 }}>{option.icon}</span>
            <span style={{ 
              fontSize: 9, 
              fontWeight: 600, 
              marginTop: 2,
              textAlign: "center",
              lineHeight: "10px"
            }}>
              {option.label.split(" ")[0]}
            </span>
          </button>
        );
      })}

      {/* Main toggle button */}
      <button
        onClick={toggleMenu}
        style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          border: "none",
          backgroundColor: isOpen ? "#ff3b3b" : "#1e90ff",
          color: "#fff",
          fontSize: 32,
          cursor: "pointer",
          boxShadow: "0 6px 16px rgba(0,0,0,0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.3s ease",
          transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
          zIndex: 1001,
          position: "relative",
        }}
        aria-label={isOpen ? "Close filters" : "Open filters"}
      >
        {isOpen ? "✕" : "+"}
      </button>

      {/* Active filter count badge */}
      {activeFilters.size > 0 && !isOpen && (
        <div style={{
          position: "absolute",
          top: -4,
          right: -4,
          width: 24,
          height: 24,
          borderRadius: "50%",
          backgroundColor: "#ff3b3b",
          color: "#fff",
          fontSize: 12,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          zIndex: 1002,
        }}>
          {activeFilters.size}
        </div>
      )}
    </div>
  );
}

export { FILTER_OPTIONS };
