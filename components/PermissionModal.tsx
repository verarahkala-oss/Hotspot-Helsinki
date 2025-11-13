import React from "react";

interface PermissionModalProps {
  isOpen: boolean;
  onAllow: () => void;
  onDeny: () => void;
}

export default function PermissionModal({
  isOpen,
  onAllow,
  onDeny,
}: PermissionModalProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          backdropFilter: "blur(4px)",
          zIndex: 10000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
        }}
      >
        {/* Modal */}
        <div
          style={{
            backgroundColor: "#fff",
            borderRadius: 20,
            padding: "32px",
            maxWidth: "480px",
            width: "100%",
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
            animation: "fadeInUp 0.3s ease-out",
          }}
        >
          {/* Icon */}
          <div
            style={{
              width: 64,
              height: 64,
              backgroundColor: "#e8f5e9",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
              fontSize: 32,
            }}
          >
            📍
          </div>

          {/* Title */}
          <h2
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: "#1a1a1a",
              marginBottom: 12,
              textAlign: "center",
            }}
          >
            Location Permission
          </h2>

          {/* Explanation */}
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.6,
              color: "#666",
              marginBottom: 24,
              textAlign: "center",
            }}
          >
            Helsinki Hotspots uses your location to show you nearby events and help you discover what's happening around you.
          </p>

          {/* Benefits List */}
          <div
            style={{
              backgroundColor: "#f8f9fa",
              borderRadius: 12,
              padding: "20px",
              marginBottom: 24,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a", marginBottom: 12 }}>
              Why we need this:
            </div>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "grid",
                gap: 12,
              }}
            >
              <li style={{ display: "flex", gap: 12, fontSize: 14, color: "#666" }}>
                <span>🎯</span>
                <span>Show events closest to you first</span>
              </li>
              <li style={{ display: "flex", gap: 12, fontSize: 14, color: "#666" }}>
                <span>🗺️</span>
                <span>Center the map on your current location</span>
              </li>
              <li style={{ display: "flex", gap: 12, fontSize: 14, color: "#666" }}>
                <span>🚶</span>
                <span>Calculate walking distances to events</span>
              </li>
              <li style={{ display: "flex", gap: 12, fontSize: 14, color: "#666" }}>
                <span>⭐</span>
                <span>Personalize recommendations based on proximity</span>
              </li>
            </ul>
          </div>

          {/* Privacy Note */}
          <div
            style={{
              backgroundColor: "#fff3cd",
              border: "1px solid #ffc107",
              borderRadius: 8,
              padding: "12px 16px",
              marginBottom: 24,
              fontSize: 13,
              color: "#856404",
            }}
          >
            <strong>🔒 Your privacy matters:</strong> Your location is only used in your browser and never stored or shared with third parties.
          </div>

          {/* Buttons */}
          <div
            style={{
              display: "flex",
              gap: 12,
              flexDirection: "column",
            }}
          >
            <button
              onClick={onAllow}
              style={{
                padding: "14px 24px",
                backgroundColor: "#667eea",
                color: "#fff",
                border: "none",
                borderRadius: 12,
                fontSize: 16,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#5568d3";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#667eea";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              Allow Location Access
            </button>
            <button
              onClick={onDeny}
              style={{
                padding: "14px 24px",
                backgroundColor: "transparent",
                color: "#666",
                border: "1px solid #e0e0e0",
                borderRadius: 12,
                fontSize: 16,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#f5f5f5";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              Not Now
            </button>
          </div>

          {/* Footer note */}
          <p
            style={{
              fontSize: 12,
              color: "#999",
              textAlign: "center",
              marginTop: 16,
              marginBottom: 0,
            }}
          >
            You can change this in Settings anytime
          </p>
        </div>
      </div>
    </>
  );
}
