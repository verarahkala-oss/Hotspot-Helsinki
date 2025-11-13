import maplibregl from "maplibre-gl";

// Category-specific marker icons as SVG data URIs
export const CATEGORY_ICONS: Record<string, string> = {
  music: createIconSVG("🎵", "#ff3b3b"),
  nightlife: createIconSVG("🍻", "#ff3b3b"),
  food: createIconSVG("🍔", "#ffa726"),
  arts: createIconSVG("🎨", "#42a5f5"),
  culture: createIconSVG("🎨", "#42a5f5"),
  sports: createIconSVG("⚽", "#66bb6a"),
  family: createIconSVG("👨‍👩‍👧", "#66bb6a"),
  tech: createIconSVG("💻", "#9c27b0"),
  theater: createIconSVG("🎭", "#42a5f5"),
  gaming: createIconSVG("🎮", "#9c27b0"),
  festival: createIconSVG("🎉", "#ff3b3b"),
  default: createIconSVG("⭐", "#999999"),
};

function createIconSVG(emoji: string, color: string): string {
  const svg = `
    <svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
      <!-- Pin shape -->
      <path d="M20 0 C9 0, 0 9, 0 20 C0 27, 20 50, 20 50 C20 50, 40 27, 40 20 C40 9, 31 0, 20 0 Z" 
            fill="${color}" 
            stroke="white" 
            stroke-width="2"/>
      <!-- Emoji in center -->
      <text x="20" y="23" font-size="18" text-anchor="middle" dominant-baseline="middle">
        ${emoji}
      </text>
    </svg>
  `;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function getCategoryIcon(category: string): string {
  const normalized = category.toLowerCase();
  
  // Match category to icon
  if (normalized.includes("music") || normalized.includes("concert")) return CATEGORY_ICONS.music;
  if (normalized.includes("night") || normalized.includes("club") || normalized.includes("bar")) return CATEGORY_ICONS.nightlife;
  if (normalized.includes("food") || normalized.includes("restaurant") || normalized.includes("cafe")) return CATEGORY_ICONS.food;
  if (normalized.includes("art") || normalized.includes("museum") || normalized.includes("gallery")) return CATEGORY_ICONS.arts;
  if (normalized.includes("theater") || normalized.includes("theatre") || normalized.includes("show")) return CATEGORY_ICONS.theater;
  if (normalized.includes("sport") || normalized.includes("outdoor")) return CATEGORY_ICONS.sports;
  if (normalized.includes("family") || normalized.includes("kids")) return CATEGORY_ICONS.family;
  if (normalized.includes("tech") || normalized.includes("coding") || normalized.includes("digital")) return CATEGORY_ICONS.tech;
  if (normalized.includes("gaming") || normalized.includes("game")) return CATEGORY_ICONS.gaming;
  if (normalized.includes("festival") || normalized.includes("fair")) return CATEGORY_ICONS.festival;
  
  return CATEGORY_ICONS.default;
}

export function loadMapIcons(map: maplibregl.Map): Promise<void> {
  const promises = Object.entries(CATEGORY_ICONS).map(([key, dataUrl]) => {
    return new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        if (!map.hasImage(key)) {
          map.addImage(key, img);
        }
        resolve();
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  });
  
  return Promise.all(promises).then(() => undefined);
}
