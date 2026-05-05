const STORAGE_KEY = "blockedSites";
const TIMER_STORAGE_KEY = "pomodoroTimer";
const POMODORO_ALARM_NAME = "pomodoro-timer-complete";
const OFFSCREEN_DOCUMENT_PATH = "offscreen.html";

function normalizeInputToHostname(input) {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  const candidate = trimmed.includes("://") ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(candidate);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function normalizeRedirectUrl(value) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const candidate = trimmed.includes("://") ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(candidate);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function findBlockedEntry(hostname, blockedSites) {
  const normalizedHost = hostname.replace(/^www\./, "").toLowerCase();
  return blockedSites.find((entry) => {
    if (!entry.enabled) {
      return null;
    }

    if (normalizedHost === entry.host) {
      return entry;
    }

    return normalizedHost.endsWith(`.${entry.host}`) ? entry : null;
  });
}

function normalizeStoredEntry(value) {
  if (typeof value === "string") {
    return { host: value, enabled: true, redirectUrl: "" };
  }

  if (
    value &&
    typeof value === "object" &&
    typeof value.host === "string" &&
    typeof value.enabled === "boolean"
  ) {
    return {
      host: value.host,
      enabled: value.enabled,
      redirectUrl: normalizeRedirectUrl(value.redirectUrl)
    };
  }

  return null;
}

async function getBlockedSites() {
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  const list = result[STORAGE_KEY];
  if (!Array.isArray(list)) {
    return [];
  }

  return list.map(normalizeStoredEntry).filter((value) => value !== null);
}

function getLiveTimerState(state) {
  if (!state?.isRunning || typeof state.startedAt !== "number") {
    return state;
  }

  const duration = typeof state.duration === "number" ? state.duration : 0;
  const elapsed = Math.floor((Date.now() - state.startedAt) / 1000);
  const remaining = Math.max(0, Math.min(duration, duration - elapsed));

  return {
    ...state,
    remaining,
    startedAt: remaining === 0 ? null : state.startedAt,
    isRunning: remaining > 0
  };
}

async function syncPomodoroAlarm(state) {
  const liveState = getLiveTimerState(state);

  if (!liveState?.isRunning || liveState.remaining <= 0) {
    await chrome.alarms.clear(POMODORO_ALARM_NAME);
    return;
  }

  await chrome.alarms.create(POMODORO_ALARM_NAME, {
    when: Date.now() + liveState.remaining * 1000
  });
}

async function ensureOffscreenDocument() {
  if (!chrome.offscreen) {
    return false;
  }

  const documentUrl = chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH);
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [documentUrl]
  });

  if (existingContexts.length > 0) {
    return true;
  }

  await chrome.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT_PATH,
    reasons: ["AUDIO_PLAYBACK"],
    justification: "Play a short Pomodoro alarm when the timer finishes."
  });
  return true;
}

async function playPomodoroAlarm() {
  const hasOffscreenDocument = await ensureOffscreenDocument();
  if (!hasOffscreenDocument) {
    return;
  }

  await chrome.runtime.sendMessage({ type: "play-pomodoro-alarm" });
}

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) {
    return;
  }

  if (details.url.startsWith(chrome.runtime.getURL(""))) {
    return;
  }

  let hostname;
  try {
    hostname = new URL(details.url).hostname;
  } catch {
    return;
  }

  const blockedSites = await getBlockedSites();
  if (blockedSites.length === 0) {
    return;
  }

  const blockedEntry = findBlockedEntry(hostname, blockedSites);
  if (blockedEntry) {
    const blockedPage = chrome.runtime.getURL("blocked.html");
    const redirectUrl =
      blockedEntry.redirectUrl ||
      `${blockedPage}?url=${encodeURIComponent(details.url)}`;
    chrome.tabs.update(details.tabId, { url: redirectUrl });
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await getBlockedSites();
  if (existing.length === 0) {
    await chrome.storage.sync.set({ [STORAGE_KEY]: [] });
  }

  const result = await chrome.storage.local.get(TIMER_STORAGE_KEY);
  await syncPomodoroAlarm(result[TIMER_STORAGE_KEY]);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "normalize-hostname") {
    sendResponse({ hostname: normalizeInputToHostname(message.value || "") });
    return;
  }

  if (message?.type === "pomodoro-timer-updated") {
    syncPomodoroAlarm(message.state).then(() => sendResponse({ ok: true }));
    return true;
  }
});

chrome.runtime.onStartup.addListener(async () => {
  const result = await chrome.storage.local.get(TIMER_STORAGE_KEY);
  await syncPomodoroAlarm(result[TIMER_STORAGE_KEY]);
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== POMODORO_ALARM_NAME) {
    return;
  }

  const result = await chrome.storage.local.get(TIMER_STORAGE_KEY);
  const liveState = getLiveTimerState(result[TIMER_STORAGE_KEY]);

  if (liveState?.isRunning && liveState.remaining > 0) {
    await syncPomodoroAlarm(liveState);
    return;
  }

  if (liveState) {
    await chrome.storage.local.set({ [TIMER_STORAGE_KEY]: liveState });
  }

  await playPomodoroAlarm();
});
