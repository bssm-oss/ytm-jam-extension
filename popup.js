const statusEl = document.getElementById("status");
const roomInput = document.getElementById("roomId");
const chipEl = document.getElementById("connectionChip");
const currentRoomEl = document.getElementById("currentRoom");
const currentTrackEl = document.getElementById("currentTrack");

const setStatus = (text, ok = true, connected = true) => {
  statusEl.textContent = text;
  statusEl.style.color = ok ? "#9aa7c7" : "#fca5a5";
  chipEl.textContent = connected ? "Connected" : "Disconnected";
  chipEl.style.color = connected ? "#d1fae5" : "#fecaca";
  chipEl.style.background = connected ? "rgb(29 185 84 / 18%)" : "rgb(220 38 38 / 20%)";
  chipEl.style.borderColor = connected ? "rgb(29 185 84 / 45%)" : "rgb(220 38 38 / 45%)";
};

const withActiveYtmTab = (handler) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab || !tab.id || !tab.url || !tab.url.startsWith("https://music.youtube.com/")) {
      setStatus("Open music.youtube.com tab first.", false);
      return;
    }
    handler(tab.id);
  });
};

const sendCommand = (payload, onResponse) => {
  withActiveYtmTab((tabId) => {
    chrome.tabs.sendMessage(tabId, payload, (response) => {
      if (chrome.runtime.lastError) {
        setStatus(chrome.runtime.lastError.message, false, false);
        return;
      }
      if (!response) {
        setStatus("No response from content script.", false, false);
        return;
      }
      setStatus(response.message, response.ok, true);
      if (response.roomId) {
        roomInput.value = response.roomId;
        chrome.storage.local.set({ ytmjamRoom: response.roomId });
        currentRoomEl.textContent = response.roomId;
      }
      if (response.nowPlaying) {
        currentTrackEl.textContent = response.nowPlaying;
      }
      if (!response.nowPlaying && response.trackId === null) {
        currentTrackEl.textContent = "No track";
      }
      if (onResponse) {
        onResponse(response);
      }
    });
  });
};

document.getElementById("createRoom").addEventListener("click", () => {
  const roomId = roomInput.value.trim() || "default";
  sendCommand({ type: "YTMJAM_JOIN", roomId });
});

document.getElementById("refreshStatus").addEventListener("click", () => {
  sendCommand({ type: "YTMJAM_STATUS" });
});

chrome.storage.local.get(["ytmjamRoom"], (data) => {
  if (data.ytmjamRoom) {
    roomInput.value = data.ytmjamRoom;
    currentRoomEl.textContent = data.ytmjamRoom;
  }
  sendCommand({ type: "YTMJAM_STATUS" });
});

setStatus("Loading...", true, false);
setInterval(() => sendCommand({ type: "YTMJAM_STATUS" }), 2000);
