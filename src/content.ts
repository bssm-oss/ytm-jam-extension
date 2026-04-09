type PlaybackState = {
  trackId: string | null;
  startedAt: number | null;
  paused: boolean;
  pausedAt: number | null;
  queue: string[];
};

type ClientToServer =
  | { t: "JOIN"; roomId: string }
  | { t: "PLAY"; trackId: string }
  | { t: "PAUSE" }
  | { t: "SEEK"; time: number }
  | { t: "QUEUE_ADD"; trackId: string }
  | { t: "SKIP" }
  | { t: "PING" };

type ServerToClient = { t: "STATE"; state: PlaybackState };

type PopupCommand =
  | { type: "YTMJAM_JOIN"; roomId: string }
  | { type: "YTMJAM_STATUS" };

type PopupResponse = {
  ok: boolean;
  message: string;
  roomId?: string;
  nowPlaying?: string;
  trackId?: string | null;
};

const WS_URL = "wss://ytm-jam.stuckgwak.com/ws";
const DEFAULT_ROOM = "default";
const DRIFT_THRESHOLD = 1;
const HEARTBEAT_MS = 20000;

const roomFromQuery = new URL(location.href).searchParams.get("ytmjamRoom");
let roomId = roomFromQuery ?? localStorage.getItem("ytmjam-room") ?? DEFAULT_ROOM;
localStorage.setItem("ytmjam-room", roomId);

let socket: WebSocket | null = null;
let socketConnected = false;
let heartbeatTimer: number | null = null;
let applyingRemoteState = false;
let syncingNativeQueue = false;
let lastTrackId: string | null = null;
let pendingRemoteState: PlaybackState | null = null;
let lastKnownState: PlaybackState = {
  trackId: null,
  startedAt: null,
  paused: false,
  pausedAt: null,
  queue: [],
};

const getVideo = (): HTMLVideoElement | null =>
  document.querySelector("video.html5-main-video, video");

const getTrackIdFromUrl = (): string | null => new URL(location.href).searchParams.get("v");

const getNowPlayingTitle = (): string => {
  const titleSelectors = [
    "ytmusic-player-bar .title.style-scope.ytmusic-player-bar",
    "ytmusic-player-bar .content-info-wrapper .title.style-scope.ytmusic-player-bar",
    "ytmusic-player-bar .content-info-wrapper .title",
    "ytmusic-player-bar .content-info-wrapper yt-formatted-string.title",
    "ytmusic-player-bar .content-info-wrapper a",
    "#song-title yt-formatted-string",
  ];
  for (const selector of titleSelectors) {
    const element = document.querySelector<HTMLElement>(selector);
    const text = element?.textContent?.trim();
    if (text) {
      return text;
    }
  }

  const mediaTitle = navigator.mediaSession?.metadata?.title?.trim();
  if (mediaTitle) {
    return mediaTitle;
  }

  const titleFromDocument = document.title
    .replace(/\s*-\s*YouTube Music\s*$/i, "")
    .trim();
  if (titleFromDocument && titleFromDocument.toLowerCase() !== "youtube music") {
    return titleFromDocument;
  }
  return "No track";
};

const send = (event: ClientToServer): void => {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return;
  }
  socket.send(JSON.stringify(event));
};

const stopHeartbeat = (): void => {
  if (heartbeatTimer !== null) {
    window.clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
};

const startHeartbeat = (): void => {
  stopHeartbeat();
  heartbeatTimer = window.setInterval(() => {
    send({ t: "PING" });
  }, HEARTBEAT_MS);
};

const getCurrentTime = (state: PlaybackState): number => {
  if (state.startedAt === null) {
    return 0;
  }
  if (state.paused) {
    return state.pausedAt ?? 0;
  }
  return Math.max(0, Date.now() / 1000 - state.startedAt);
};

const snapshotQueueTrackIds = (): string[] => {
  const links = document.querySelectorAll<HTMLAnchorElement>(
    'ytmusic-player-queue a[href*="watch?v="], ytmusic-player-queue-item a[href*="watch?v="]',
  );
  const ids: string[] = [];
  for (const link of links) {
    const href = link.getAttribute("href");
    const match = href?.match(/[?&]v=([^&]+)/);
    if (match) {
      ids.push(match[1]);
    }
  }
  return ids;
};

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, ms));

const clickQueueMenuItem = async (): Promise<boolean> => {
  const selectors = [
    "tp-yt-paper-item",
    "ytmusic-menu-service-item-renderer",
    "ytmusic-menu-navigation-item-renderer",
  ];
  const keywords = ["add to queue", "queue", "대기열", "다음에 재생"];

  for (const selector of selectors) {
    const items = document.querySelectorAll<HTMLElement>(selector);
    for (const item of items) {
      const text = (item.textContent ?? "").toLowerCase().trim();
      if (!text) {
        continue;
      }
      if (!keywords.some((k) => text.includes(k))) {
        continue;
      }
      item.click();
      await wait(120);
      return true;
    }
  }
  return false;
};

const enqueueTrackToNativeQueue = async (trackId: string): Promise<boolean> => {
  const link = document.querySelector<HTMLAnchorElement>(`a[href*="watch?v=${trackId}"]`);
  if (!link) {
    return false;
  }

  const row =
    link.closest(
      "ytmusic-responsive-list-item-renderer, ytmusic-player-queue-item, ytmusic-two-row-item-renderer, ytmusic-list-item-renderer",
    ) ?? link.parentElement;
  const menuButton = row?.querySelector<HTMLElement>(
    "button[aria-label*='More'], button[aria-label*='more'], button[aria-label*='더보기'], tp-yt-paper-icon-button[aria-label*='More'], tp-yt-paper-icon-button[aria-label*='더보기']",
  );
  if (!menuButton) {
    return false;
  }

  menuButton.click();
  await wait(160);
  return clickQueueMenuItem();
};

const syncSharedQueueToNativeQueue = async (sharedQueue: string[]): Promise<void> => {
  if (syncingNativeQueue || sharedQueue.length === 0) {
    return;
  }
  syncingNativeQueue = true;
  try {
    const localSet = new Set(snapshotQueueTrackIds());
    for (const trackId of sharedQueue) {
      if (localSet.has(trackId)) {
        continue;
      }
      const inserted = await enqueueTrackToNativeQueue(trackId);
      if (inserted) {
        localSet.add(trackId);
      }
      await wait(120);
    }
  } finally {
    syncingNativeQueue = false;
  }
};

const applyState = async (state: PlaybackState): Promise<boolean> => {
  const video = getVideo();
  if (!video) {
    lastKnownState = state;
    return false;
  }

  applyingRemoteState = true;
  try {
    if (state.trackId) {
      const currentTrackId = getTrackIdFromUrl();
      if (currentTrackId !== state.trackId) {
        location.href = `https://music.youtube.com/watch?v=${state.trackId}&ytmjamRoom=${encodeURIComponent(roomId)}`;
        return true;
      }
    }

    const targetTime = getCurrentTime(state);
    if (Math.abs(video.currentTime - targetTime) > DRIFT_THRESHOLD) {
      video.currentTime = targetTime;
    }

    if (state.paused) {
      video.pause();
    } else {
      await video.play().catch(() => undefined);
    }
    return true;
  } finally {
    lastKnownState = state;
    setTimeout(() => {
      applyingRemoteState = false;
    }, 50);
  }
};

const applyPendingRemoteState = (): void => {
  if (!pendingRemoteState || applyingRemoteState) {
    return;
  }
  void applyState(pendingRemoteState).then((applied) => {
    if (applied) {
      pendingRemoteState = null;
    }
  });
};

const bindTrackChangeWatcher = (): void => {
  lastTrackId = getTrackIdFromUrl();
  window.setInterval(() => {
    const current = getTrackIdFromUrl();
    if (!current || applyingRemoteState) {
      return;
    }
    if (current !== lastTrackId) {
      lastTrackId = current;
      send({ t: "PLAY", trackId: current });
    }
  }, 1000);
};

const bindQueueWatcher = (): void => {
  let lastQueueSnapshot = snapshotQueueTrackIds();
  let debounceTimer: number | null = null;

  const observer = new MutationObserver(() => {
    if (debounceTimer) {
      window.clearTimeout(debounceTimer);
    }
    debounceTimer = window.setTimeout(() => {
      if (applyingRemoteState || syncingNativeQueue) {
        return;
      }
      const current = snapshotQueueTrackIds();
      const before = new Set(lastQueueSnapshot);
      for (const trackId of current) {
        if (!before.has(trackId)) {
          send({ t: "QUEUE_ADD", trackId });
        }
      }
      lastQueueSnapshot = current;
    }, 500);
  });

  observer.observe(document.body, { childList: true, subtree: true });
};

const bindLocalPlayerEvents = (): void => {
  const interval = window.setInterval(() => {
    const video = getVideo();
    if (!video) {
      return;
    }
    window.clearInterval(interval);
    applyPendingRemoteState();

    video.addEventListener("play", () => {
      if (applyingRemoteState) {
        return;
      }
      const trackId = getTrackIdFromUrl();
      if (trackId) {
        send({ t: "PLAY", trackId });
      }
    });

    video.addEventListener("pause", () => {
      if (!applyingRemoteState) {
        send({ t: "PAUSE" });
      }
    });

    video.addEventListener("seeked", () => {
      if (!applyingRemoteState) {
        send({ t: "SEEK", time: video.currentTime });
      }
    });

    video.addEventListener("ended", () => {
      if (!applyingRemoteState && lastKnownState.queue.length > 0) {
        send({ t: "SKIP" });
      }
    });
  }, 1000);
};

const currentStatusResponse = (): PopupResponse => ({
  ok: true,
  message: socketConnected ? `Connected room: ${roomId}` : `Disconnected room: ${roomId}`,
  roomId,
  nowPlaying: getNowPlayingTitle(),
  trackId: getTrackIdFromUrl(),
});

const applyPopupCommand = (message: PopupCommand): PopupResponse => {
  const commandType = String(message.type ?? "").toUpperCase();
  if (commandType === "YTMJAM_JOIN") {
    const requestedRoomId = (message as { roomId?: string }).roomId;
    roomId = (requestedRoomId ?? "").trim() || DEFAULT_ROOM;
    localStorage.setItem("ytmjam-room", roomId);
    send({ t: "JOIN", roomId });
    return {
      ok: true,
      message: `Joined room: ${roomId}`,
      roomId,
      nowPlaying: getNowPlayingTitle(),
      trackId: getTrackIdFromUrl(),
    };
  }
  return currentStatusResponse();
};

const connect = (): void => {
  socket = new WebSocket(WS_URL);
  socket.addEventListener("open", () => {
    socketConnected = true;
    send({ t: "JOIN", roomId });
    startHeartbeat();
  });
  socket.addEventListener("message", (event) => {
    try {
      const parsed = JSON.parse(event.data as string) as ServerToClient;
      if (parsed.t !== "STATE") {
        return;
      }
      pendingRemoteState = parsed.state;
      applyPendingRemoteState();
      void syncSharedQueueToNativeQueue(parsed.state.queue);
    } catch {
      // Ignore malformed payload.
    }
  });
  socket.addEventListener("close", () => {
    socketConnected = false;
    stopHeartbeat();
    setTimeout(connect, 1500);
  });
};

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse: (response: PopupResponse) => void) => {
    if (!message || typeof message !== "object" || !("type" in message)) {
      return;
    }
    sendResponse(applyPopupCommand(message as PopupCommand));
  },
);

bindLocalPlayerEvents();
bindTrackChangeWatcher();
bindQueueWatcher();
connect();
