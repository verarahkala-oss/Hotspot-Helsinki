// src/mapStyle.ts
const KEY = import.meta.env.VITE_MAPTILER_KEY;
export const MAP_STYLE_LIGHT = `https://api.maptiler.com/maps/basic/style.json?key=${KEY}`;
export const MAP_STYLE_DARK  = `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${KEY}`;
// Other good dark options: "streets-v2-dark" or "toner-v2"
