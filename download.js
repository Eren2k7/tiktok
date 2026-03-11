const API_ENDPOINT = "https://www.tikwm.com/api/";

function json(status, body) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(body)
  };
}

function isTikTokUrl(value) {
  try {
    const parsed = new URL(value);
    return /(^|\.)tiktok\.com$/i.test(parsed.hostname) || /(^|\.)vt\.tiktok\.com$/i.test(parsed.hostname);
  } catch {
    return false;
  }
}

function formatDuration(totalSeconds) {
  if (!Number.isFinite(totalSeconds)) {
    return null;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    const response = json(405, { error: "Method not allowed." });
    res.status(response.statusCode).setHeader("Content-Type", "application/json; charset=utf-8").send(response.body);
    return;
  }

  const rawUrl = typeof req.query.url === "string" ? req.query.url.trim() : "";

  if (!rawUrl || !isTikTokUrl(rawUrl)) {
    const response = json(400, { error: "Enter a valid TikTok link." });
    res.status(response.statusCode).setHeader("Content-Type", "application/json; charset=utf-8").send(response.body);
    return;
  }

  try {
    const upstream = await fetch(`${API_ENDPOINT}?url=${encodeURIComponent(rawUrl)}`, {
      headers: {
        Accept: "application/json"
      }
    });

    if (!upstream.ok) {
      const response = json(502, { error: "The download service is unavailable right now." });
      res.status(response.statusCode).setHeader("Content-Type", "application/json; charset=utf-8").send(response.body);
      return;
    }

    const payload = await upstream.json();
    const data = payload?.data;

    if (!data) {
      const response = json(404, { error: "No downloadable media was found for that TikTok URL." });
      res.status(response.statusCode).setHeader("Content-Type", "application/json; charset=utf-8").send(response.body);
      return;
    }

    const isGallery = Array.isArray(data.images) && data.images.length > 0;
    const sanitized = {
      sourceUrl: rawUrl,
      type: isGallery ? "gallery" : "video",
      title: data.title || "Untitled TikTok",
      cover: data.cover || data.origin_cover || null,
      duration: data.duration ?? null,
      durationLabel: formatDuration(Number(data.duration)),
      author: {
        nickname: data.author?.nickname || "Unknown creator",
        username: data.author?.unique_id || null,
        avatar: data.author?.avatar || null
      },
      stats: {
        plays: data.play_count ?? 0,
        likes: data.digg_count ?? 0,
        comments: data.comment_count ?? 0,
        shares: data.share_count ?? 0
      },
      downloads: {
        video: data.play || null,
        hdVideo: data.hdplay || null,
        watermarkedVideo: data.wmplay || null,
        audio: data.music || data.music_info?.play || null,
        images: isGallery ? data.images.filter(Boolean) : []
      }
    };

    const response = json(200, sanitized);
    res.status(response.statusCode).setHeader("Content-Type", "application/json; charset=utf-8").send(response.body);
  } catch (error) {
    const response = json(500, { error: "Something went wrong while fetching this TikTok." });
    res.status(response.statusCode).setHeader("Content-Type", "application/json; charset=utf-8").send(response.body);
  }
};
