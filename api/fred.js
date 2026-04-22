export default async function handler(req, res) {
  // Allow CORS from our own frontend
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  const { series_id } = req.query;
  if (!series_id) {
    return res.status(400).json({ error: "series_id is required" });
  }

  const apiKey = process.env.VITE_FRED_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "FRED API key not configured" });
  }

  const url = new URL("https://api.stlouisfed.org/fred/series/observations");
  url.searchParams.set("series_id", series_id);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("sort_order", "desc");
  url.searchParams.set("limit", "120");

  try {
    const response = await fetch(url.toString());
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json(data);
    }
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate"); // cache 5 min on Vercel edge
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
