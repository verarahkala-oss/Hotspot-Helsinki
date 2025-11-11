import React from "react";
import { useEvents } from "./useEvents";

export default function App() {
  const { data, loading, error } = useEvents();

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif", maxWidth: 1200, margin: "0 auto" }}>
      <h1>Hotspot Helsinki</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>Live events from MyHelsinki Open API</p>

      {loading && <p>Loading events...</p>}
      
      {error && (
        <div style={{ 
          padding: 16, 
          backgroundColor: "#fee", 
          border: "1px solid #c33", 
          borderRadius: 4,
          color: "#c33"
        }}>
          Error: {error}
        </div>
      )}

      {data && data.length === 0 && !loading && (
        <p>No events found.</p>
      )}

      {data && data.length > 0 && (
        <div>
          <p style={{ marginBottom: 16, fontWeight: 600 }}>
            Found {data.length} events
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {data.map((event: any, index: number) => {
              // Use the simplified API structure
              const name = event.title || "Unnamed Event";
              const startDate = event.time;
              const isFree = event.price === "free";
              const eventUrl = event.website || "#";
              const category = event.category || "other";

              return (
                <div 
                  key={event.id || index}
                  style={{
                    padding: 16,
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    backgroundColor: "#fff",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
                  }}
                >
                  <h3 style={{ margin: "0 0 8px 0", fontSize: 18 }}>
                    {name}
                  </h3>
                  
                  <div style={{ fontSize: 14, color: "#666", marginBottom: 8 }}>
                    {startDate && (
                      <div style={{ marginBottom: 4 }}>
                        📅 <strong>Date:</strong> {startDate}
                      </div>
                    )}
                    <div style={{ marginBottom: 4 }}>
                      💰 <strong>Entry:</strong> {isFree ? "Free" : "Paid"}
                    </div>
                    <div style={{ marginBottom: 4 }}>
                      🏷️ <strong>Category:</strong> {category}
                    </div>
                  </div>

                  {eventUrl && eventUrl !== "#" && (
                    <a 
                      href={eventUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-block",
                        padding: "6px 12px",
                        backgroundColor: "#0066cc",
                        color: "#fff",
                        textDecoration: "none",
                        borderRadius: 4,
                        fontSize: 14,
                        marginTop: 8
                      }}
                    >
                      View Details →
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}