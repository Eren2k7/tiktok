# Tokyo Drop

A polished TikTok downloader website with a cinematic frontend and a simple serverless backend.

## Stack

- Static frontend: `index.html`, `styles.css`, `app.js`
- Backend: Vercel serverless functions in `api/download.js` and `api/proxy.js`
- Upstream media lookup: `tikwm.com`

## What it does

- Accepts a public TikTok URL
- Fetches download metadata from the backend
- Shows a premium preview card with creator info and metrics
- Downloads HD video, standard video, watermarked video, audio, and gallery images when available

## Deploy

1. Install Node.js 18 or newer on your machine.
2. Install Vercel CLI: `npm i -g vercel`
3. From this folder, run: `vercel`
4. For local development, run: `vercel dev`

## Notes

- The backend proxies the actual media file so downloads trigger cleanly from your own domain.
- TikTok and third-party download providers can change their response format over time. If that happens, update `api/download.js`.
- Only use this with content you have the right to download.
