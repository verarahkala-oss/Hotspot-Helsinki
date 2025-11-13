import React from "react";

export type NavTab = "map" | "explore" | "saved" | "profile";

interface BottomNavigationProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

export default function BottomNavigation({
  activeTab,
  onTabChange,
}: BottomNavigationProps) {
  const tabs: { id: NavTab; icon: string; label: string }[] = [
    { id: "map", icon: "🗺️", label: "Map" },
    { id: "explore", icon: "🔍", label: "Explore" },
    { id: "saved", icon: "💾", label: "Saved" },
    { id: "profile", icon: "👤", label: "Profile" },
  ];

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: "72px",
        backgroundColor: "#fff",
        borderTop: "1px solid #e0e0e0",
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        zIndex: 1000,
        boxShadow: "0 -2px 8px rgba(0, 0, 0, 0.1)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              flex: 1,
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              border: "none",
              background: "none",
              cursor: "pointer",
              color: isActive ? "#667eea" : "#999",
              transition: "all 0.2s ease",
              padding: "8px",
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.color = "#667eea";
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.color = "#999";
              }
            }}
          >
            <span
              style={{
                fontSize: "24px",
                transition: "transform 0.2s ease",
                transform: isActive ? "scale(1.1)" : "scale(1)",
              }}
            >
              {tab.icon}
            </span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: isActive ? 600 : 400,
                letterSpacing: "0.3px",
              }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
