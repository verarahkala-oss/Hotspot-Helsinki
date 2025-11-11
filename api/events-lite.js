// api/events-lite.js
export const config = { runtime: "edge" }; // Vercel Edge function

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const limit = searchParams.get("limit") || "200";

  // Use the working Helsinki Linked Events API
  const direct = `https://api.hel.fi/linkedevents/v1/event/?page_size=${limit}`;
  const fallback = `https://open-api.myhelsinki.fi/v2/events/?limit=${limit}`;

  // Some mirrors return text; we’ll parse safely.
  const tryParse = (t) => {
    try { return JSON.parse(t); } catch {}
    const a = t.indexOf("{"), b = t.lastIndexOf("}");
    if (a !== -1 && b !== -1 && b > a) {
      try { return JSON.parse(t.slice(a, b + 1)); } catch {}
    }
    return null;
  };

  const candidates = [
    { url: direct, expectsJson: true },
    { url: fallback, expectsJson: true },
  ];

  let json = null, used = null, status = 200;

  for (const c of candidates) {
    try {
      const r = await fetch(c.url, { headers: { Accept: "application/json" } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      json = await r.json();
      used = c.url;
      break;
    } catch (e) {
      // try next candidate
    }
  }

  if (!json) {
    status = 502;
    json = { error: "All sources failed" };
  } else {
    // optional: annotate which source we used
    json._meta = { via: used };
  }

  return new Response(JSON.stringify(json), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
    },
  });
}