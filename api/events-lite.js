export const config = { runtime: "edge" };

export default async function handler(req) {
  try {
    const limit = new URL(req.url).searchParams.get("limit") ?? "500";
    const url = `https://open-api.myhelsinki.fi/v2/events/?limit=${encodeURIComponent(limit)}`;

    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) {
      return new Response(JSON.stringify({ error: "upstream " + r.status }), {
        status: 502,
        headers: { "content-type": "application/json", "access-control-allow-origin": "*" }
      });
    }
    const data = await r.json();

    // normalize for the UI
    const list = (data?.data ?? [])
      .map(it => {
        const title = it?.name?.fi || it?.name?.en || "Event";
        const loc = it?.location ?? {};
        const offers = it?.offers ?? [];
        const isFree = offers[0]?.is_free ? "free" : "paid";
        const start = it?.event_dates?.starting_day || "";
        const website = it?.info_url || (offers[0]?.url ?? null);

        // very basic tag-based category
        const tagText = (it?.tags ?? []).map(t => (t?.name || "").toLowerCase()).join(" ");
        let category = "other";
        if (/music|musiikki/.test(tagText)) category = "music";
        else if (/food|ruoka|restaurant|ravintola/.test(tagText)) category = "food";
        else if (/sport|urheilu|juoksu|marathon|ottelu/.test(tagText)) category = "sports";
        else if (/family|perhe|kids|lapset/.test(tagText)) category = "family";

        return { id: "myh_" + it.id, title, time: start, lat: loc.lat, lng: loc.lon, category, price: isFree, website };
      })
      .filter(e => typeof e.lat === "number" && typeof e.lng === "number");

    return new Response(JSON.stringify({ data: list }), {
      headers: { "content-type": "application/json", "access-control-allow-origin": "*" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { "content-type": "application/json", "access-control-allow-origin": "*" }
    });
  }
}