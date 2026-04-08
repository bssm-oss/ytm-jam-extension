type PlaybackState = {
  trackId: string | null;
  startedAt: number | null;
  paused: boolean;
  pausedAt: number | null;
  queue: string[];
};

type ServerToClient = { t: "STATE"; state: PlaybackState };
type ClientToServer =
  | { t: "JOIN"; roomId: string }
  | { t: "PLAY"; trackId: string }
  | { t: "PAUSE" }
  | { t: "SEEK"; time: number }
  | { t: "QUEUE_ADD"; trackId: string }
  | { t: "SKIP" };

const WS_URL = "ws://localhost:3000";
const DEFAULT_ROOM = "default";
const DRIFT_THRESHOLD = 1;

const roomFromQuery = new URL(location.href).searchParams.get("ytmjamRoom");
const roomId = roomFromQuery ?? localStorage.getItem("ytmjam-room") ?? DEFAULT_ROOM;
localStorage.setItem("ytmjam-room", roomId);

let socket: WebSocket | null = null;
let applyingRemoteState = false;

const getVideo = (): HTMLVideoElement | null =>
  document.querySelector("video.html5-main-video, video");

const getTrackIdFromUrl = (): string | null => new URL(location.href).searchParams.get("v");

const send = (event: ClientToServer): void => {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return;
  }
  socket.send(JSON.stringify(event));
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

const applyState = async (state: PlaybackState): Promise<void> => {
  const video = getVideo();
  if (!video) {
    return;
  }

  applyingRemoteState = true;
  try {
    if (state.trackId) {
      const currentTrackId = getTrackIdFromUrl();
      if (currentTrackId !== state.trackId) {
        location.href = `https://music.youtube.com/watch?v=${state.trackId}&ytmjamRoom=${encodeURIComponent(roomId)}`;
        return;
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
  } finally {
    setTimeout(() => {
      applyingRemoteState = false;
    }, 50);
  }
};

const bindLocalPlayerEvents = (): void => {
  const interval = window.setInterval(() => {
    const video = getVideo();
    if (!video) {
      return;
    }

    window.clearInterval(interval);
    video.addEventListener("play", () => {
      if (applyingRemoteState) {
        return;
      }
      const trackId = getTrackIdFromUrl();
      if (!trackId) {
        return;
      }
      send({ t: "PLAY", trackId });
    });

    video.addEventListener("pause", () => {
      if (applyingRemoteState) {
        return;
      }
      send({ t: "PAUSE" });
    });

    video.addEventListener("seeked", () => {
      if (applyingRemoteState) {
        return;
      }
      send({ t: "SEEK", time: video.currentTime });
    });
  }, 1000);
};

const connect = (): void => {
  socket = new WebSocket(WS_URL);
  socket.addEventListener("open", () => {
    send({ t: "JOIN", roomId });
  });

  socket.addEventListener("message", (event) => {
    try {
      const parsed = JSON.parse(event.data as string) as ServerToClient;
      if (parsed.t !== "STATE") {
        return;
      }

      void applyState(parsed.state);
    } catch {
      // Ignore malformed payload.
    }
  });

  socket.addEventListener("close", () => {
    setTimeout(connect, 1500);
  });
};

bindLocalPlayerEvents();
connect();
