const STORAGE_KEY = "blockedSites";
const TIMER_STORAGE_KEY = "pomodoroTimer";
const TIMER_DURATIONS = {
  focus: 25 * 60,
  break: 5 * 60
};

const currentSiteEl = document.getElementById("current-site");
const questionEl = document.getElementById("question");
const statusEl = document.getElementById("status");
const addButton = document.getElementById("add-button");
const timerDisplayEl = document.getElementById("timer-display");
const timerModeEl = document.getElementById("timer-mode");
const focusButton = document.getElementById("focus-button");
const breakButton = document.getElementById("break-button");
const timerToggleButton = document.getElementById("timer-toggle");
const timerResetButton = document.getElementById("timer-reset");

let currentHost = null;
let timerState = createDefaultTimerState("focus");
let timerInterval = null;

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
      redirectUrl: typeof value.redirectUrl === "string" ? value.redirectUrl : ""
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

async function setBlockedSites(sites) {
  await chrome.storage.sync.set({ [STORAGE_KEY]: sites });
}

function normalizeHostFromUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return host || null;
  } catch {
    return null;
  }
}

async function getCurrentTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.style.color = isError ? "#b42318" : "#1b6f3f";
}

function createDefaultTimerState(mode) {
  const duration = TIMER_DURATIONS[mode] || TIMER_DURATIONS.focus;
  return {
    mode,
    duration,
    remaining: duration,
    startedAt: null,
    isRunning: false
  };
}

function normalizeTimerState(value) {
  if (!value || typeof value !== "object") {
    return createDefaultTimerState("focus");
  }

  const mode = value.mode === "break" ? "break" : "focus";
  const duration = TIMER_DURATIONS[mode];
  const startedAt = typeof value.startedAt === "number" ? value.startedAt : null;
  const remaining =
    typeof value.remaining === "number" && value.remaining >= 0
      ? Math.min(value.remaining, duration)
      : duration;

  return {
    mode,
    duration,
    remaining,
    startedAt,
    isRunning: value.isRunning === true && startedAt !== null
  };
}

function getLiveTimerState(state) {
  if (!state.isRunning || !state.startedAt) {
    return state;
  }

  const elapsed = Math.floor((Date.now() - state.startedAt) / 1000);
  const remaining = Math.max(0, Math.min(state.duration, state.duration - elapsed));
  return {
    ...state,
    remaining,
    startedAt: remaining === 0 ? null : state.startedAt,
    isRunning: remaining > 0
  };
}

async function saveTimerState(state) {
  await chrome.storage.local.set({ [TIMER_STORAGE_KEY]: state });
}

async function syncPomodoroAlarm(state) {
  await chrome.runtime.sendMessage({
    type: "pomodoro-timer-updated",
    state
  });
}

async function loadTimerState() {
  const result = await chrome.storage.local.get(TIMER_STORAGE_KEY);
  timerState = getLiveTimerState(normalizeTimerState(result[TIMER_STORAGE_KEY]));
  await saveTimerState(timerState);
  renderTimer();
}

function formatSeconds(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function renderTimer() {
  timerDisplayEl.textContent = formatSeconds(timerState.remaining);
  timerModeEl.textContent = timerState.mode === "break" ? "Break" : "Focus";
  timerToggleButton.textContent = timerState.isRunning ? "Pause" : "Start";
  focusButton.classList.toggle("active", timerState.mode === "focus");
  breakButton.classList.toggle("active", timerState.mode === "break");
}

function startTimerInterval() {
  if (timerInterval) {
    clearInterval(timerInterval);
  }

  timerInterval = setInterval(async () => {
    timerState = getLiveTimerState(timerState);
    renderTimer();

    if (!timerState.isRunning) {
      clearInterval(timerInterval);
      timerInterval = null;
      await saveTimerState(timerState);
    }
  }, 1000);
}

async function switchTimerMode(mode) {
  timerState = createDefaultTimerState(mode);
  await saveTimerState(timerState);
  await syncPomodoroAlarm(timerState);
  renderTimer();

  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

async function toggleTimer() {
  timerState = getLiveTimerState(timerState);

  if (timerState.isRunning) {
    timerState = {
      ...timerState,
      startedAt: null,
      isRunning: false
    };
    await saveTimerState(timerState);
    await syncPomodoroAlarm(timerState);
    renderTimer();
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    return;
  }

  const remaining =
    timerState.remaining > 0 ? timerState.remaining : timerState.duration;
  timerState = {
    ...timerState,
    remaining,
    startedAt: Date.now() - (timerState.duration - remaining) * 1000,
    isRunning: true
  };
  await saveTimerState(timerState);
  await syncPomodoroAlarm(timerState);
  renderTimer();
  startTimerInterval();
}

async function resetTimer() {
  timerState = createDefaultTimerState(timerState.mode);
  await saveTimerState(timerState);
  await syncPomodoroAlarm(timerState);
  renderTimer();

  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

async function refreshView() {
  const tab = await getCurrentTab();
  const host = tab?.url ? normalizeHostFromUrl(tab.url) : null;

  if (!host) {
    currentSiteEl.textContent = "Unsupported page";
    questionEl.textContent = "Open a regular website tab to add it.";
    addButton.disabled = true;
    return;
  }

  currentHost = host;
  currentSiteEl.textContent = host;

  const sites = await getBlockedSites();
  const existing = sites.find((entry) => entry.host === host);

  if (!existing) {
    questionEl.textContent = "Do you want to add this page to blocked websites?";
    addButton.textContent = "Add to blocked list";
    addButton.disabled = false;
    return;
  }

  if (existing.enabled) {
    questionEl.textContent = "This page is already blocked.";
    addButton.textContent = "Already blocked";
    addButton.disabled = true;
    return;
  }

  questionEl.textContent = "This page exists in your list but is turned off.";
  addButton.textContent = "Turn blocking on";
  addButton.disabled = false;
}

addButton.addEventListener("click", async () => {
  if (!currentHost) {
    return;
  }

  const sites = await getBlockedSites();
  const existing = sites.find((entry) => entry.host === currentHost);

  if (!existing) {
    await setBlockedSites([
      ...sites,
      { host: currentHost, enabled: true, redirectUrl: "" }
    ]);
    setStatus(`${currentHost} added and blocking enabled.`);
    await refreshView();
    return;
  }

  if (!existing.enabled) {
    const updated = sites.map((entry) =>
      entry.host === currentHost ? { ...entry, enabled: true } : entry
    );
    await setBlockedSites(updated);
    setStatus(`${currentHost} blocking turned on.`);
    await refreshView();
  }
});

focusButton.addEventListener("click", () => switchTimerMode("focus"));
breakButton.addEventListener("click", () => switchTimerMode("break"));
timerToggleButton.addEventListener("click", toggleTimer);
timerResetButton.addEventListener("click", resetTimer);

refreshView();
loadTimerState().then(() => {
  if (timerState.isRunning) {
    startTimerInterval();
  }
});
