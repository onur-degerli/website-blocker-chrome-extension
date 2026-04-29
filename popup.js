const STORAGE_KEY = "blockedSites";

const currentSiteEl = document.getElementById("current-site");
const questionEl = document.getElementById("question");
const statusEl = document.getElementById("status");
const addButton = document.getElementById("add-button");

let currentHost = null;

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

refreshView();
