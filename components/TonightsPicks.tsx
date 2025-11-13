import React from "react";

type Event = {
  id: string;
  title: string;
  category: string;
  price: "free" | "paid";
  start?: string;
  end?: string;
};

interface TonightsPicksProps {
  events: Event[];
  onEventClick: (id: string) => void;
}

function isLiveNow(e: Event, now = Date.now()) {
  const s = e.start ? Date.parse(e.start) : NaN;
  const hasEnd = !!e.end;
  const en = hasEnd ? Date.parse(e.end!) : (isFinite(s) ? s + 6*60*60*1000 : NaN);
  return isFinite(s) && isFinite(en) && s <= now && now <= en;
}

function isHappeningTonight(e: Event) {
  if (!e.start) return false;
  const eventDate = new Date(e.start);
  const now = new Date();
  
  // Check if event is today or tonight
  return eventDate.toDateString() === now.toDateString();
}

function getPopularityScore(e: Event): number {
  let score = 0;
  
  // Live events get highest priority
  if (isLiveNow(e)) score += 100;
  
  // Free events are more accessible
  if (e.price === "free") score += 30;
  
  // Popular categories
  const popular = ["music", "food", "nightlife", "arts", "festival"];
  if (popular.some(cat => e.category.toLowerCase().includes(cat))) {
    score += 20;
  }
  
  // Tonight's events
  if (isHappeningTonight(e)) score += 50;
  
  return score;
}

export default function TonightsPicks({ events, onEventClick }: TonightsPicksProps) {
  // Get top 3 picks based on popularity score
  const topPicks = events
    .map(e => ({ event: e, score: getPopularityScore(e) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(item => item.event);

  if (topPicks.length === 0) return null;

  return (
    <div style={{
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      padding: "12px 16px",
      borderRadius: "0 0 12px 12px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      marginBottom: 16,
      color: "#fff"
    }}>
      <div style={{ 
        fontSize: 13, 
        fontWeight: 600, 
        marginBottom: 8,
        display: "flex",
        alignItems: "center",
        gap: 6
      }}>
        <span>⭐</span>
        <span>Tonight's Picks</span>
      </div>
      
      <div style={{ 
        display: "flex", 
        gap: 8, 
        overflowX: "auto",
        scrollbarWidth: "none",
        msOverflowStyle: "none"
      }}>
        {topPicks.map((event) => {
          const isLive = isLiveNow(event);
          const hour = event.start ? new Date(event.start).getHours() : null;
          const timeStr = hour !== null ? `${hour}:00` : "";
          
          return (
            <button
              key={event.id}
              onClick={() => onEventClick(event.id)}
              style={{
                background: "rgba(255,255,255,0.2)",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(255,255,255,0.3)",
                borderRadius: 8,
                padding: "8px 12px",
                color: "#fff",
                cursor: "pointer",
                minWidth: 140,
                textAlign: "left",
                transition: "all 0.2s ease",
                flexShrink: 0
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.3)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.2)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <div style={{ 
                fontWeight: 600, 
                fontSize: 12,
                marginBottom: 4,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}>
                {event.title}
              </div>
              <div style={{ 
                fontSize: 10, 
                opacity: 0.9,
                display: "flex",
                alignItems: "center",
                gap: 4
              }}>
                {isLive && <span style={{ 
                  background: "#ff3b3b", 
                  padding: "1px 4px", 
                  borderRadius: 3,
                  fontWeight: 600,
                  fontSize: 9
                }}>LIVE</span>}
                {timeStr && <span>{timeStr}</span>}
                <span>{event.price === "free" ? "🆓" : "💳"}</span>
              </div>
            </button>
          );
        })}
      </div>
      
      <style>{`
        div::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
