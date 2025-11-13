import React from "react";

export default function DataAttribution() {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 80, // Above bottom navigation
        left: 8,
        backgroundColor: "rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(10px)",
        borderRadius: 8,
        padding: "6px 12px",
        fontSize: 11,
        color: "#666",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        gap: 6,
        maxWidth: "calc(100% - 16px)",
      }}
    >
      <span style={{ opacity: 0.7 }}>ℹ️</span>
      <span>
        Data from{" "}
        <a
          href="https://api.hel.fi/linkedevents/v1/"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "#667eea",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Helsinki LinkedEvents
        </a>
        {" · "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "#667eea",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          OpenStreetMap
        </a>
      </span>
    </div>
  );
}
