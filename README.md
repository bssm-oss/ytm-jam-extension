# ytm-jam-extension

Chrome extension content script for YouTube Music synchronization.

## What this module does
- Connects to sync server via WebSocket
- Applies room `STATE` to YouTube Music player
- Sends local web controls (play/pause/seek) back to server

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

## Connect to a room
1. Open YouTube Music (`https://music.youtube.com`)
2. Add query param for room (optional, default room is used otherwise):
```text
https://music.youtube.com/watch?v=<trackId>&ytmjamRoom=study
```
3. Ensure server is running at `ws://localhost:3000` (or adjust code/config)

## Local verification
1. Start `ytm-jam-server`
2. Load extension
3. Use CLI to `play/pause/seek`
4. Confirm player follows server state and local web controls are reflected back

## Troubleshooting
- Extension not loading: confirm `dist/content.js` exists after build
- No sync: check server is reachable and room id matches CLI room
