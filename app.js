const form = document.getElementById("download-form");
const input = document.getElementById("tiktok-url");
const statusNode = document.getElementById("status");
const resultContent = document.getElementById("result-content");
const template = document.getElementById("result-template");
const pasteButton = document.getElementById("paste-button");
const submitButton = document.getElementById("submit-button");

const isGitHubPages = window.location.hostname.endsWith("github.io");
const isStaticHost = isGitHubPages || window.location.protocol === "file:";
const localDownloadEndpoint = new URL("./api/download", window.location.href).toString();
const localProxyEndpoint = new URL("./api/proxy", window.location.href).toString();
let backendMode = "unknown";

function formatNumber(value) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
}

function setStatus(message, tone = "muted") {
  statusNode.textContent = message;
  statusNode.style.color = tone === "error" ? "#ffb09a" : tone === "success" ? "#b9f5d0" : "";
}

function formatPhoneClock(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function formatLockDay(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric"
  }).format(date);
}

function sanitizePayload(rawUrl, data) {
  const isGallery = Array.isArray(data.images) && data.images.length > 0;

  return {
    sourceUrl: rawUrl,
    type: isGallery ? "gallery" : "video",
    title: data.title || "Untitled TikTok",
    cover: data.cover || data.origin_cover || null,
    duration: data.duration ?? null,
    durationLabel: Number.isFinite(Number(data.duration))
      ? `${Math.floor(Number(data.duration) / 60)}:${String(Number(data.duration) % 60).padStart(2, "0")}`
      : null,
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
}

function showNotification(stack, title, body) {
  const notification = document.createElement("article");
  notification.className = "notification-card";
  notification.innerHTML = `
    <div class="notification-icon">TT</div>
    <div>
      <p class="notification-title">${title}</p>
      <p class="notification-body">${body}</p>
    </div>
  `;

  stack.prepend(notification);

  setTimeout(() => {
    notification.classList.add("fade-out");
    setTimeout(() => notification.remove(), 320);
  }, 2800);
}

function createDownloadButton(label, target, name, ext, variant, notify) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `download-button${variant === "primary" ? " primary" : ""}`;
  button.textContent = label;
  button.addEventListener("click", () => handleDownload(button, target, name, ext, label, notify));
  return button;
}

function triggerBrowserDownload(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

async function handleDownload(button, target, name, ext, label, notify) {
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = "Saving...";

  try {
    const fetchTarget = backendMode === "local"
      ? `${localProxyEndpoint}?${new URLSearchParams({ target, name, ext }).toString()}`
      : target;

    const response = await fetch(fetchTarget);
    if (!response.ok) {
      throw new Error(`Download failed with status ${response.status}.`);
    }

    const blob = await response.blob();
    triggerBrowserDownload(blob, `${name}.${ext}`);
    setStatus(`${label} downloaded successfully.`, "success");
    notify("Saved to Files", `${label} is ready on your device.`);
  } catch (error) {
    if (backendMode !== "local") {
      window.open(target, "_blank", "noopener,noreferrer");
      setStatus("GitHub Pages can only use direct mode, so if the remote host blocks browser downloads the media will open in a new tab instead.", "error");
      notify("Action required", "The file host blocked direct browser saving, so the media opened separately.");
    } else {
      setStatus(error.message || "Download failed.", "error");
      notify("Download failed", error.message || "Please try again.");
    }
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

function renderMedia(data, frame) {
  frame.innerHTML = "";

  if (data.type === "gallery" && data.downloads.images.length) {
    const grid = document.createElement("div");
    grid.className = "gallery-grid";

    data.downloads.images.slice(0, 4).forEach((imageUrl) => {
      const image = document.createElement("img");
      image.src = imageUrl;
      image.alt = data.title;
      grid.appendChild(image);
    });

    frame.appendChild(grid);
    return;
  }

  if (data.downloads.video) {
    const video = document.createElement("video");
    video.src = data.downloads.video;
    video.controls = true;
    video.playsInline = true;
    video.poster = data.cover || "";
    video.preload = "metadata";
    frame.appendChild(video);
    return;
  }

  if (data.cover) {
    const image = document.createElement("img");
    image.src = data.cover;
    image.alt = data.title;
    frame.appendChild(image);
  }
}

function setPageState(appPages, pageDots, pageIndex) {
  appPages.classList.toggle("page-1", pageIndex === 1);
  pageDots.forEach((dot, index) => {
    dot.classList.toggle("active", index === pageIndex);
  });
}

function installSwipeGestures(phoneScreen, lockOverlay, unlock, appPages, pageDots) {
  let startX = 0;
  let startY = 0;

  phoneScreen.addEventListener("touchstart", (event) => {
    startX = event.touches[0].clientX;
    startY = event.touches[0].clientY;
  }, { passive: true });

  phoneScreen.addEventListener("touchend", (event) => {
    const dx = event.changedTouches[0].clientX - startX;
    const dy = event.changedTouches[0].clientY - startY;

    if (!lockOverlay.classList.contains("unlocked")) {
      if (dy < -70) {
        unlock();
      }
      return;
    }

    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy)) {
      const nextPage = dx < 0 ? 1 : 0;
      setPageState(appPages, pageDots, nextPage);
    }
  }, { passive: true });
}

function renderResult(data) {
  const fragment = template.content.cloneNode(true);
  const phoneTime = fragment.getElementById("phone-time");
  const lockDay = fragment.getElementById("lock-day");
  const lockTime = fragment.getElementById("lock-time");
  const lockOverlay = fragment.getElementById("lock-overlay");
  const faceIdCopy = fragment.getElementById("face-id-copy");
  const notificationStack = fragment.getElementById("notification-stack");
  const frame = fragment.getElementById("media-frame");
  const authorAvatar = fragment.getElementById("author-avatar");
  const authorName = fragment.getElementById("author-name");
  const authorHandle = fragment.getElementById("author-handle");
  const postTitle = fragment.getElementById("post-title");
  const viewsCount = fragment.getElementById("views-count");
  const likesCount = fragment.getElementById("likes-count");
  const commentsCount = fragment.getElementById("comments-count");
  const sharesCount = fragment.getElementById("shares-count");
  const downloadGroup = fragment.getElementById("download-group");
  const appPages = fragment.getElementById("app-pages");
  const phoneScreen = fragment.getElementById("phone-screen");
  const unlockButton = fragment.getElementById("unlock-button");
  const dynamicIsland = fragment.getElementById("dynamic-island");
  const pageDots = Array.from(fragment.querySelectorAll(".page-dot"));

  const syncClock = () => {
    const now = new Date();
    const timeText = formatPhoneClock(now);
    phoneTime.textContent = timeText;
    lockTime.textContent = timeText;
    lockDay.textContent = formatLockDay(now);
  };

  syncClock();
  setTimeout(syncClock, 1000);

  renderMedia(data, frame);

  authorAvatar.src = data.author.avatar || data.cover || "";
  authorAvatar.alt = data.author.nickname;
  authorName.textContent = data.author.nickname;
  authorHandle.textContent = data.author.username ? `@${data.author.username}` : data.durationLabel || "Public TikTok post";
  postTitle.textContent = data.title;
  viewsCount.textContent = formatNumber(data.stats.plays);
  likesCount.textContent = formatNumber(data.stats.likes);
  commentsCount.textContent = formatNumber(data.stats.comments);
  sharesCount.textContent = formatNumber(data.stats.shares);

  const baseName = `${data.author.username || "tiktok"}-${Date.now()}`;
  const notify = (title, body) => showNotification(notificationStack, title, body);

  if (data.downloads.hdVideo) {
    downloadGroup.appendChild(createDownloadButton("Save HD Video", data.downloads.hdVideo, baseName, "mp4", "primary", notify));
  }

  if (data.downloads.video) {
    downloadGroup.appendChild(createDownloadButton("Save Video", data.downloads.video, baseName, "mp4", "default", notify));
  }

  if (data.downloads.watermarkedVideo) {
    downloadGroup.appendChild(createDownloadButton("Save WM Video", data.downloads.watermarkedVideo, `${baseName}-wm`, "mp4", "default", notify));
  }

  if (data.downloads.audio) {
    downloadGroup.appendChild(createDownloadButton("Save Audio", data.downloads.audio, `${baseName}-audio`, "mp3", "default", notify));
  }

  if (data.type === "gallery") {
    data.downloads.images.forEach((imageUrl, index) => {
      downloadGroup.appendChild(createDownloadButton(`Save Photo ${index + 1}`, imageUrl, `${baseName}-${index + 1}`, "jpg", "default", notify));
    });
  }

  const unlock = () => {
    lockOverlay.classList.add("unlocked");
    faceIdCopy.textContent = "Unlocked";
    dynamicIsland.classList.add("active");
    notify("Unlocked", "Swipe left to open Downloads.");
  };

  unlockButton.addEventListener("click", unlock);
  lockOverlay.addEventListener("click", unlock);
  installSwipeGestures(phoneScreen, lockOverlay, unlock, appPages, pageDots);

  resultContent.replaceChildren(fragment);

  dynamicIsland.classList.add("active");
  notify("TikTok loaded", isGitHubPages ? "GitHub Pages mode is active. Swipe up to enter the app." : "Face ID complete. Swipe up to enter the app.");

  setTimeout(() => {
    faceIdCopy.textContent = "Swipe up to open";
  }, 1400);
}

async function parseJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  throw new Error(text || `Request failed with status ${response.status}.`);
}

async function fetchLocalDownload(url) {
  const response = await fetch(`${localDownloadEndpoint}?url=${encodeURIComponent(url)}`);
  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.error || "Local API request failed.");
  }

  backendMode = "local";
  return data;
}

async function fetchDirectDownload(url) {
  const response = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`);
  const payload = await parseJsonResponse(response);
  const data = payload?.data;

  if (!response.ok || !data) {
    throw new Error(payload?.error || "Direct TikTok lookup failed.");
  }

  backendMode = "direct";
  return sanitizePayload(url, data);
}

async function fetchDownload(url) {
  if (isStaticHost) {
    const directResult = await fetchDirectDownload(url);
    setStatus("GitHub Pages mode detected. The app is using direct mode automatically.", "success");
    return directResult;
  }

  try {
    return await fetchLocalDownload(url);
  } catch {
    try {
      const directResult = await fetchDirectDownload(url);
      setStatus("Local API was missing, so the phone switched to direct mode.", "success");
      return directResult;
    } catch {
      throw new Error("The local API is unavailable and direct mode also failed. If you are on a restricted network, deploy the Vercel backend or enable internet access.");
    }
  }
}

pasteButton.addEventListener("click", async () => {
  try {
    const clip = await navigator.clipboard.readText();
    if (clip) {
      input.value = clip.trim();
      setStatus("Link pasted. Load it into the phone when ready.", "success");
    }
  } catch {
    setStatus("Clipboard access was blocked. Paste the link manually instead.", "error");
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const url = input.value.trim();
  if (!url) {
    setStatus("Paste a TikTok link first.", "error");
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Loading...";
  setStatus(isGitHubPages ? "GitHub Pages detected. Loading the phone app in static mode..." : "Injecting your TikTok into the iPhone app shell...");

  try {
    const data = await fetchDownload(url);
    renderResult(data);
    if (backendMode === "local") {
      setStatus("The phone app is ready. Unlock it and swipe between Preview and Downloads.", "success");
    } else {
      setStatus(isGitHubPages
        ? "The phone app is ready on GitHub Pages. Unlock it and use the in-app save buttons."
        : "The phone app is ready in direct mode. Unlock it and try the save actions inside the app.", "success");
    }
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Load Into Phone";
  }
});
