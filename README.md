# ytm-jam-extension

Chrome extension content script for YouTube Music synchronization.

## What this module does
- Connects to sync server via WebSocket
- Applies room `STATE` to YouTube Music player
- Sends local web controls and queue changes back to server

## Before Starting
- Node.js 20+
- npm
- Chrome (or Chromium)

## Install and build
```bash
npm install
npm run build
```

## Load extension in Chrome
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `extension/` directory (must include `manifest.json`)
5. Click the extension icon and use popup for room create/join

## Connect to a room
1. Open YouTube Music (`https://music.youtube.com`)
2. Click extension icon and enter room id
3. Click **Create/Join**
4. Popup shows current room and now playing track (auto refresh)
5. Control songs directly in YouTube Music UI (play/pause/seek/queue)
6. Queue sync is applied to native YTM queue in background
7. When a track ends, next track is driven by shared queue (`SKIP`)
8. Ensure server endpoint is reachable at `wss://ytm-jam.stuckgwak.com`

## Local verification
1. Start `ytm-jam-server`
2. Load extension
3. Use CLI to `play/pause/seek`
4. Confirm player follows server state and local web controls are reflected back

## Troubleshooting
- Extension not loading: confirm `dist/content.js` exists after build
- No sync: check server is reachable and room id matches CLI room
