const ALLOWED_HOSTS = [
  "tiktokcdn.com",
  "tikwm.com",
  "akamaized.net",
  "muscdn.com"
];

function isAllowedTarget(target) {
  try {
    const parsed = new URL(target);
    return ["http:", "https:"].includes(parsed.protocol) &&
      ALLOWED_HOSTS.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

function safeFileName(value) {
  return value.replace(/[^a-z0-9-_]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "download";
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const target = typeof req.query.target === "string" ? req.query.target : "";
  const name = typeof req.query.name === "string" ? req.query.name : "download";
  const extension = typeof req.query.ext === "string" ? req.query.ext : "mp4";

  if (!target || !isAllowedTarget(target)) {
    res.status(400).json({ error: "Invalid download target." });
    return;
  }

  try {
    const upstream = await fetch(target, {
      headers: {
        Accept: "*/*"
      }
    });

    if (!upstream.ok) {
      res.status(502).json({ error: "Unable to fetch the media file." });
      return;
    }

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    const buffer = Buffer.from(await upstream.arrayBuffer());
    const filename = `${safeFileName(name)}.${safeFileName(extension)}`;

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.status(200).send(buffer);
  } catch (error) {
    res.status(500).json({ error: "Download proxy failed." });
  }
};
