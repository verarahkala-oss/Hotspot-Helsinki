import React, { useState } from "react";

interface OnboardingModalProps {
  onComplete: (interests: string[]) => void;
  initialInterests?: string[];
}

const INTEREST_OPTIONS = [
  { id: "music", label: "Music & Concerts", icon: "🎵" },
  { id: "food", label: "Food & Dining", icon: "🍔" },
  { id: "nightlife", label: "Nightlife & Bars", icon: "🍻" },
  { id: "culture", label: "Arts & Culture", icon: "🎨" },
  { id: "sports", label: "Sports & Outdoors", icon: "⚽" },
  { id: "tech", label: "Tech & Innovation", icon: "💻" },
  { id: "theater", label: "Theater & Shows", icon: "🎭" },
  { id: "family", label: "Family Events", icon: "👨‍👩‍👧" },
  { id: "festival", label: "Festivals", icon: "🎉" },
];

export default function OnboardingModal({ onComplete, initialInterests = [] }: OnboardingModalProps) {
  const [selectedInterests, setSelectedInterests] = useState<string[]>(initialInterests);
  const isReturning = initialInterests.length > 0;

  const toggleInterest = (id: string) => {
    setSelectedInterests(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const handleContinue = () => {
    if (selectedInterests.length > 0) {
      onComplete(selectedInterests);
    }
  };

  const handleSkip = () => {
    onComplete([]);
  };

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0, 0, 0, 0.7)",
      backdropFilter: "blur(8px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
      padding: 16,
      animation: "fadeIn 0.3s ease-out"
    }}>
      <div style={{
        background: "#fff",
        borderRadius: 20,
        padding: "32px 24px",
        maxWidth: 480,
        width: "100%",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        animation: "slideUp 0.4s ease-out"
      }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎯</div>
          <h2 style={{ 
            margin: 0, 
            fontSize: 24, 
            fontWeight: 700,
            marginBottom: 8,
            color: "#1a1a1a"
          }}>
            {isReturning ? "Update Your Interests" : "Welcome to Hotspot Helsinki!"}
          </h2>
          <p style={{ 
            margin: 0, 
            fontSize: 14, 
            color: "#666",
            lineHeight: 1.5
          }}>
            {isReturning 
              ? "Adjust your interests to refine your event recommendations"
              : "Tell us what you're interested in to get personalized event recommendations"
            }
          </p>
        </div>

        {/* Interest Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 10,
          marginBottom: 24
        }}>
          {INTEREST_OPTIONS.map(option => {
            const isSelected = selectedInterests.includes(option.id);
            return (
              <button
                key={option.id}
                onClick={() => toggleInterest(option.id)}
                style={{
                  padding: "14px 16px",
                  border: isSelected ? "2px solid #667eea" : "2px solid #e0e0e0",
                  borderRadius: 12,
                  background: isSelected 
                    ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" 
                    : "#fff",
                  color: isSelected ? "#fff" : "#333",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: isSelected ? 600 : 500,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  transition: "all 0.2s ease",
                  transform: isSelected ? "scale(1.02)" : "scale(1)",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = "#667eea";
                    e.currentTarget.style.transform = "scale(1.02)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = "#e0e0e0";
                    e.currentTarget.style.transform = "scale(1)";
                  }
                }}
              >
                <span style={{ fontSize: 20 }}>{option.icon}</span>
                <span style={{ flex: 1, textAlign: "left" }}>{option.label}</span>
                {isSelected && <span style={{ fontSize: 16 }}>✓</span>}
              </button>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={handleSkip}
            style={{
              flex: 1,
              padding: "14px 20px",
              border: "2px solid #e0e0e0",
              borderRadius: 12,
              background: "#fff",
              color: "#666",
              cursor: "pointer",
              fontSize: 15,
              fontWeight: 600,
              transition: "all 0.2s ease"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#f5f5f5";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#fff";
            }}
          >
            Skip for now
          </button>
          <button
            onClick={handleContinue}
            disabled={selectedInterests.length === 0}
            style={{
              flex: 2,
              padding: "14px 20px",
              border: "none",
              borderRadius: 12,
              background: selectedInterests.length > 0
                ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                : "#e0e0e0",
              color: "#fff",
              cursor: selectedInterests.length > 0 ? "pointer" : "not-allowed",
              fontSize: 15,
              fontWeight: 600,
              transition: "all 0.2s ease",
              opacity: selectedInterests.length > 0 ? 1 : 0.6
            }}
            onMouseEnter={(e) => {
              if (selectedInterests.length > 0) {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 8px 20px rgba(102, 126, 234, 0.4)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            {selectedInterests.length > 0 
              ? `Continue with ${selectedInterests.length} interest${selectedInterests.length > 1 ? 's' : ''}`
              : "Select at least 1 interest"
            }
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(20px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @media (prefers-color-scheme: dark) {
          /* Dark mode support */
        }
      `}</style>
    </div>
  );
}
