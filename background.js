const STORAGE_KEY = "blockedSites";

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

function isBlockedHost(hostname, blockedSites) {
  const normalizedHost = hostname.replace(/^www\./, "").toLowerCase();
  return blockedSites.some((entry) => {
    if (!entry.enabled) {
      return false;
    }

    if (normalizedHost === entry.host) {
      return true;
    }

    return normalizedHost.endsWith(`.${entry.host}`);
  });
}

function normalizeStoredEntry(value) {
  if (typeof value === "string") {
    return { host: value, enabled: true };
  }

  if (
    value &&
    typeof value === "object" &&
    typeof value.host === "string" &&
    typeof value.enabled === "boolean"
  ) {
    return { host: value.host, enabled: value.enabled };
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

  if (isBlockedHost(hostname, blockedSites)) {
    const blockedPage = chrome.runtime.getURL("blocked.html");
    const redirectUrl = `${blockedPage}?url=${encodeURIComponent(details.url)}`;
    chrome.tabs.update(details.tabId, { url: redirectUrl });
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await getBlockedSites();
  if (existing.length === 0) {
    await chrome.storage.sync.set({ [STORAGE_KEY]: [] });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "normalize-hostname") {
    sendResponse({ hostname: normalizeInputToHostname(message.value || "") });
  }
});
